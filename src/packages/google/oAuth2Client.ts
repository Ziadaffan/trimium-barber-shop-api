import { google } from 'googleapis';
import { Service } from '@prisma/client';
import { throwError } from '../common/utils/error.handler.utils';
import prisma from '../lib/db';

interface AddReservationToGoogleCalendarProps {
  barberId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  service: Service;
  date: Date;
}

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

export const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const getAuthUrl = (): string => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    throwError(
      'Google OAuth2 credentials are not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI',
      500
    );
  }

  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  return url;
};

export const getTokensFromCode = async (code: string) => {
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    return tokens;
  } catch (error: any) {
    throwError(`Failed to exchange code for tokens: ${error.message}`, 400);
    throw error;
  }
};

export const setCredentials = (tokens: any) => {
  oAuth2Client.setCredentials(tokens);

  oAuth2Client.on('tokens', async newTokens => {
    const calendarId = process.env.GOOGLE_CLIENT_ID;
    if (!calendarId) {
      console.error('GOOGLE_CLIENT_ID is not set, cannot update tokens');
      return;
    }

    if (newTokens.refresh_token) {
      await prisma.googleCalendarToken.upsert({
        where: { calendarId },
        update: { refreshToken: newTokens.refresh_token },
        create: {
          calendarId,
          refreshToken: newTokens.refresh_token,
          accessToken: newTokens.access_token || '',
          expiryDate: newTokens.expiry_date ? BigInt(newTokens.expiry_date) : BigInt(0),
        },
      });
    }

    if (newTokens.access_token && newTokens.expiry_date) {
      const token = await prisma.googleCalendarToken.upsert({
        where: { calendarId },
        update: {
          accessToken: newTokens.access_token,
          expiryDate: BigInt(newTokens.expiry_date),
        },
        create: {
          calendarId,
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token || '',
          expiryDate: BigInt(newTokens.expiry_date),
        },
      });
    }
  });
};

export const getStoredTokens = async () => {
  const calendarId = process.env.GOOGLE_CLIENT_ID;
  if (!calendarId) {
    console.error('GOOGLE_CLIENT_ID is not set, cannot load stored Google Calendar tokens.');
    return null;
  }

  const token = await prisma.googleCalendarToken.findUnique({ where: { calendarId } });

  if (!token) {
    console.error('Google Calendar tokens not found in database.');
    return null;
  }

  const accessToken = token.accessToken;
  const refreshToken = token.refreshToken;
  const expiryDate = token.expiryDate;

  if (!accessToken || !refreshToken) {
    console.error('Google Calendar tokens are missing accessToken/refreshToken in database.');
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate ? Number(expiryDate) : undefined,
  };
};

const ensureAuthorized = async () => {
  const storedTokens = await getStoredTokens();

  if (storedTokens) {
    setCredentials(storedTokens);
    return;
  }

  const currentCredentials = oAuth2Client.credentials;
  if (!currentCredentials.access_token && !currentCredentials.refresh_token) {
    throwError('Google Calendar not authorized', 401);
  }
};

export const createBarberCalendar = async (barberName: string) => {
  await ensureAuthorized();

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

  const response = await calendar.calendars.insert({
    requestBody: {
      summary: `${barberName}`,
      timeZone: 'America/Toronto',
    },
  });

  const calendarId = response.data.id;
  if (!calendarId) {
    throwError('Failed to create Google Calendar (missing calendar id)', 400);
    return null;
  }

  return calendarId;
};

export const deleteCalendarById = async (calendarId: string) => {
  try {
    await ensureAuthorized();
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    await calendar.calendars.delete({ calendarId });
  } catch (error: any) {
    throwError(`Failed to delete Google Calendar: ${error.message || 'Unknown error'}`, 400);
  }
};

export const addReservationToGoogleCalendar = async ({
  barberId,
  clientName,
  clientPhone,
  clientEmail,
  service,
  date,
}: AddReservationToGoogleCalendarProps) => {
  try {
    await ensureAuthorized();

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });
    if (!barber) {
      throwError('Barber not found', 404);
      return;
    }

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const endDate = new Date(date);
    endDate.setMinutes(endDate.getMinutes() + service.duration);

    const event = {
      summary: `Client: ${clientName}`,
      description: `Phone: ${clientPhone}\nEmail: ${clientEmail}\nService: ${service.nameEn}`,
      start: {
        dateTime: date.toISOString(),
        timeZone: 'America/Toronto',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'America/Toronto',
      },
    };

    if (!barber.googleCalendarId) {
      throwError('Barber Google Calendar ID is not set', 400);
      return;
    }

    const response = await calendar.events.insert({
      calendarId: barber.googleCalendarId,
      requestBody: event,
    });

    if (response.status === 200) {
      return response.data;
    } else {
      throwError('Failed to create reservation in Google Calendar', 400);
      return;
    }
  } catch (error: any) {
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      throwError('Google Calendar authorization expired. Please re-authorize at /api/google/auth', 401);
    } else {
      throwError(`Failed to create reservation in Google Calendar: ${error.message || 'Unknown error'}`, 400);
    }
    return;
  }
};
