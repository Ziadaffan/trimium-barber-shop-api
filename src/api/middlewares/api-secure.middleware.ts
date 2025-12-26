import { NextFunction, Request, Response } from 'express';
import { throwError } from '../../packages/common/utils/error.handler.utils';
import crypto from 'crypto';

export const apiSecureMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const isDev = process.env.ENV !== 'production';

    const timestamp = req.get('x-timestamp');
    const signature = req.get('x-signature');

    if (isDev) {
      console.log('received x-signature (raw)', signature);
    }

    if (isDev) {
      console.log('apiSecureMiddleware request', {
        method: req.method,
        url: req.originalUrl || req.url,
        origin: req.get('origin'),
        referer: req.get('referer'),
        userAgent: req.get('user-agent'),
        timestamp,
        signature: signature ? `${signature.slice(0, 8)}…(${signature.length})` : null,
      });
    }

    if (!timestamp || !signature) {
      if (isDev) {
        console.log('apiSecureMiddleware missing headers', {
          timestamp: Boolean(timestamp),
          signature: Boolean(signature),
        });
      }
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
      if (isDev) {
        console.log('apiSecureMiddleware invalid timestamp', {
          timestamp,
          requestedTimestamp,
          now,
          diffMs: isNaN(requestedTimestamp) ? null : Math.abs(requestedTimestamp - now),
        });
      }
      throwError('Invalid timestamp', 401);
      return;
    }

    const method = req.method;
    const url = req.originalUrl || req.url;

    const payload = `${method.toUpperCase()}\n${url}\n${timestamp}`;
    const calculatedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    console.log('signature payload (verifier)', { method: method.toUpperCase(), url, timestamp });
    if (isDev) {
      console.log('signature raw payload (verifier)', payload);
    }
    console.log('calculated signature', calculatedSignature);
    if (calculatedSignature !== signature) {
      if (isDev) {
        console.log('apiSecureMiddleware signature mismatch', {
          receivedSignature: signature,
          calculatedSignature,
        });
      }
      throwError('Invalid signature', 401);
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
