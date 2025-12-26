import { NextFunction, Request, Response } from 'express';
import { throwError } from '../../packages/common/utils/error.handler.utils';
import crypto from 'crypto';

export const apiSecureMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const timestamp = req.headers['x-timestamp'];
    const signature = req.headers['x-signature'];

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
    let body = '';
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string') {
        body = req.body;
      } else {
        body = JSON.stringify(req.body);
      }
    }

    const payload = `${method.toUpperCase()}\n${url}\n${body}\n${timestamp}`;
    const calculatedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    console.log('calculated signature', calculatedSignature);
    if (calculatedSignature !== signature) {
      throwError('Invalid signature', 401);
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
