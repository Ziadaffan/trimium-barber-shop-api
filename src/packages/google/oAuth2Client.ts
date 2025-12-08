import { google } from 'googleapis';
import { Reservation, Service } from '@prisma/client';
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
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URL;

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !redirectUri) {
    throwError(
      'Google OAuth2 credentials are not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URL',
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
      console.log('token', token);
    }
  });
};

export const getStoredTokens = async () => {
  const token = await prisma.googleCalendarToken.findUnique({ where: { calendarId: process.env.GOOGLE_CLIENT_ID } });

  if (!token) {
    console.error('Google Calendar tokens not found in database.');
    return null;
  }

  const accessToken = token.accessToken;
  const refreshToken = token.refreshToken;
  const expiryDate = token.expiryDate;

  if (!accessToken || !refreshToken) {
    console.error('Google Calendar tokens not found in environment variables.');
    console.error('Required: GOOGLE_ACCESS_TOKEN, GOOGLE_REFRESH_TOKEN');
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate ? expiryDate.toString() : undefined,
  };
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
    const storedTokens = await getStoredTokens();

    if (storedTokens) {
      setCredentials(storedTokens);
    } else {
      const currentCredentials = oAuth2Client.credentials;

      if (!currentCredentials.access_token && !currentCredentials.refresh_token) {
        throwError('Google Calendar not authorized', 401);
        return;
      }
    }

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
      description: `Phone: ${clientPhone} | Email: ${clientEmail} \n Service: ${service.nameEn}`,
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
