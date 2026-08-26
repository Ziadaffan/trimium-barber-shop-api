import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { throwError } from '../../packages/common/utils/error.handler.utils';
import { hmacHex, timingSafeEqualString } from '../../packages/common/utils/hmac.utils';
import { logger } from '../../packages/common/logger';

/** A signed request is only accepted inside this window, to bound replays. */
export const SIGNATURE_MAX_SKEW_MS = 5 * 60 * 1000;

export const buildSignaturePayload = (method: string, url: string, timestamp: string | number): string =>
  `${method.toUpperCase()}\n${url}\n${timestamp}`;

export const signApiRequest = (method: string, url: string, timestamp: string | number, secret: string): string =>
  hmacHex(buildSignaturePayload(method, url, timestamp), secret);

export const hasValidSignature = (req: Request): boolean => {
  const timestamp = req.get('x-timestamp');
  const signature = req.get('x-signature');

  if (!timestamp || !signature) return false;

  const secret = process.env.API_SECRET;
  if (!secret) {
    logger.error(new Error('API_SECRET is missing, signed requests cannot be verified'));
    return false;
  }

  const requestedTimestamp = Number(timestamp);
  if (Number.isNaN(requestedTimestamp) || Math.abs(requestedTimestamp - Date.now()) > SIGNATURE_MAX_SKEW_MS) {
    return false;
  }

  const expected = signApiRequest(req.method, req.originalUrl || req.url, timestamp, secret);
  return timingSafeEqualString(expected, signature);
};

export const hasValidAdminJwt = (req: Request): boolean => {
  const header = req.get('authorization');
  if (!header) return false;

  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return false;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.error(new Error('JWT_SECRET is missing, admin tokens cannot be verified'));
    return false;
  }

  try {
    jwt.verify(token, secret);
    return true;
  } catch {
    return false;
  }
};

/**
 * Guards everything that exposes client data or mutates shop data. Accepts either the admin
 * JWT issued by /api/auth/login or an HMAC-signed request from a trusted backend.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (hasValidAdminJwt(req) || hasValidSignature(req)) {
      next();
      return;
    }

    throwError('Unauthorized', 401);
  } catch (error) {
    next(error);
  }
};

/**
 * Guards scheduled jobs. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`, so that is
 * accepted alongside the normal admin credentials for manual runs.
 */
export const requireCron = (req: Request, res: Response, next: NextFunction) => {
  const cronSecret = process.env.CRON_SECRET;
  const header = req.get('authorization');

  if (cronSecret && header && timingSafeEqualString(header, `Bearer ${cronSecret}`)) {
    next();
    return;
  }

  requireAdmin(req, res, next);
};

/** @deprecated Kept for compatibility; prefer requireAdmin, which also accepts the admin JWT. */
export const apiSecureMiddleware = requireAdmin;
