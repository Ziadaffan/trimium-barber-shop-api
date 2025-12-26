import { NextFunction, Request, Response } from 'express';
import { throwError } from '../../packages/common/utils/error.handler.utils';
import crypto from 'crypto';

export const apiSecureMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const timestamp = req.get('x-timestamp');
    const signature = req.get('x-signature');

    if (!timestamp || !signature) {
      throwError('Missing required headers', 401);
      return;
    }

    const secret = process.env.API_SECRET;
    if (!secret) {
      throwError('Server misconfiguration: API_SECRET is missing', 500);
      return;
    }

    const now = Date.now();
    const requestedTimestamp = Number(timestamp);
    if (isNaN(requestedTimestamp) || Math.abs(requestedTimestamp - now) > 5 * 60 * 1000) {
      throwError('Invalid timestamp', 401);
      return;
    }

    const method = req.method;
    const url = req.originalUrl || req.url;

    const payload = `${method.toUpperCase()}\n${url}\n${timestamp}`;
    const calculatedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (calculatedSignature !== signature) {
      throwError('Invalid signature', 401);
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
