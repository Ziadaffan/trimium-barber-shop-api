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

export const getAuthUrl = (barberId: string): string => {
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
    state: barberId,
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

const attachTokenPersistor = (oAuth2Client: any, barberId: string) => {
  oAuth2Client.on('tokens', async (newTokens: any) => {
    const tokenUpdate: any = {};
    if (newTokens.access_token) tokenUpdate.accessToken = newTokens.access_token;
    if (newTokens.expiry_date) tokenUpdate.expiryDate = BigInt(newTokens.expiry_date);
    if (newTokens.refresh_token) tokenUpdate.refreshToken = newTokens.refresh_token;

    if (Object.keys(tokenUpdate).length === 0) return;

    await prisma.barberGoogleToken.update({
      where: { barberId },
      data: tokenUpdate,
    });
  });
};

export const getStoredTokensForBarber = async (barberId: string) => {
  const token = await prisma.barberGoogleToken.findUnique({ where: { barberId } });
  if (!token) return null;

  return {
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiryDate ? Number(token.expiryDate) : undefined,
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
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });
    if (!barber) {
      throwError('Barber not found', 404);
      return;
    }

    const storedTokens = await getStoredTokensForBarber(barberId);
    if (!storedTokens) {
      throwError(`Barber Google Calendar not authorized. Please connect at /api/google/auth?barberId=${barberId}`, 401);
      return;
    }

    // Use a per-call OAuth2 client so credentials don't leak between barbers
    const barberOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URL
    );
    attachTokenPersistor(barberOAuth2Client, barberId);
    barberOAuth2Client.setCredentials(storedTokens);

    const calendar = google.calendar({ version: 'v3', auth: barberOAuth2Client });

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

    const response = await calendar.events.insert({
      calendarId: 'primary',
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
      throwError(
        `Google Calendar authorization expired. Please re-authorize at /api/google/auth?barberId=${barberId}`,
        401
      );
    } else {
      throwError(`Failed to create reservation in Google Calendar: ${error.message || 'Unknown error'}`, 400);
    }
    return;
  }
};
