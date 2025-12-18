import { NextFunction, Request, Response } from 'express';
import { getAuthUrl, getTokensFromCode, getStoredTokensForBarber } from '../../packages/google/oAuth2Client';
import { throwError } from '../../packages/common/utils/error.handler.utils';
import prisma from '../../packages/lib/db';

export const getGoogleAuthUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId } = req.query;
    if (!barberId || typeof barberId !== 'string') {
      throwError('barberId is required', 400);
      return;
    }

    const barber = await prisma.barber.findUnique({ where: { id: barberId } });
    if (!barber) {
      throwError('Barber not found', 404);
      return;
    }

    const authUrl = getAuthUrl(barberId);
    return res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
};

export const handleGoogleCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      throwError('Authorization code is required', 400);
      return;
    }

    if (!state || typeof state !== 'string') {
      throwError('Missing state (barberId)', 400);
      return;
    }

    const barberId = state;
    const barber = await prisma.barber.findUnique({ where: { id: barberId } });
    if (!barber) {
      throwError('Barber not found', 404);
      return;
    }

    const tokens = await getTokensFromCode(code);
    if (!tokens) {
      throwError('Failed to get tokens from authorization code', 400);
      return;
    }

    if (!tokens.access_token || !tokens.expiry_date) {
      throwError('Failed to get access token from authorization code', 400);
      return;
    }

    const existing = await prisma.barberGoogleToken.findUnique({ where: { barberId } });
    const refreshToken = tokens.refresh_token || existing?.refreshToken;
    if (!refreshToken) {
      throwError('Failed to get refresh token. Please re-authorize (prompt=consent) to grant offline access.', 400);
      return;
    }

    await prisma.barberGoogleToken.upsert({
      where: { barberId },
      update: {
        accessToken: tokens.access_token,
        refreshToken,
        expiryDate: BigInt(tokens.expiry_date),
      },
      create: {
        barberId,
        accessToken: tokens.access_token,
        refreshToken,
        expiryDate: BigInt(tokens.expiry_date),
      },
    });

    res.status(200).json({
      message: '✅ Google Calendar authorized successfully!',
      barberId,
    });
  } catch (error) {
    next(error);
  }
};

export const checkGoogleAuthStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId } = req.query;
    if (!barberId || typeof barberId !== 'string') {
      throwError('barberId is required', 400);
      return;
    }

    const tokens = await getStoredTokensForBarber(barberId);

    if (tokens) {
      res.status(200).json({
        authorized: true,
        message: 'Google Calendar is authorized',
      });
    } else {
      res.status(200).json({
        authorized: false,
        message: 'Google Calendar is not authorized',
        authUrl: getAuthUrl(barberId),
      });
    }
  } catch (error) {
    next(error);
  }
};
