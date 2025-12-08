import { NextFunction, Request, Response } from 'express';
import { getAuthUrl, getTokensFromCode, setCredentials } from '../../packages/google/oAuth2Client';
import { throwError } from '../../packages/common/utils/error.handler.utils';
import prisma from '../../packages/lib/db';

export const getGoogleAuthUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUrl = getAuthUrl();

    return res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
};

export const handleGoogleCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      throwError('Authorization code is required', 400);
      return;
    }

    const tokens = await getTokensFromCode(code);

    if (!tokens) {
      throwError('Failed to get tokens from authorization code', 400);
      return;
    }

    setCredentials(tokens);

    const tokenInfo = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    };

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      throwError('Failed to get tokens from authorization code', 400);
      return;
    }

    if (!process.env.GOOGLE_CALENDAR_ID) {
      throwError('Google Calendar ID is not set', 400);
      return;
    }

    await prisma.googleCalendarToken.create({
      data: {
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: BigInt(tokens.expiry_date),
      },
    });

    res.status(200).json({
      message: '✅ Google Calendar authorized successfully!',
      tokens: tokenInfo,
    });
  } catch (error) {
    next(error);
  }
};

export const checkGoogleAuthStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getStoredTokens } = await import('../../packages/google/oAuth2Client');
    const tokens = getStoredTokens();

    if (tokens) {
      res.status(200).json({
        authorized: true,
        message: 'Google Calendar is authorized',
      });
    } else {
      res.status(200).json({
        authorized: false,
        message: 'Google Calendar is not authorized',
        authUrl: getAuthUrl(),
      });
    }
  } catch (error) {
    next(error);
  }
};
