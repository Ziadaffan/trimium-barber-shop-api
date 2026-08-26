import jwt from 'jsonwebtoken';
import type { Application } from 'express';

import { signApiRequest } from '../../src/api/middlewares/auth.middleware';

/**
 * Loads the express app. Callers must have registered their vi.mock() calls first, since those
 * are hoisted above this import by vitest.
 */
export const loadApp = async (): Promise<Application> => (await import('../../src/app')).default;

export const adminJwt = (): string =>
  jwt.sign({ email: 'admin@trimium.test' }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

export const expiredJwt = (): string =>
  jwt.sign({ email: 'admin@trimium.test' }, process.env.JWT_SECRET as string, { expiresIn: -10 });

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Signature headers as the trusted backend would produce them. */
export const signedHeaders = (method: string, url: string, timestamp: number = Date.now()) => ({
  'x-timestamp': String(timestamp),
  'x-signature': signApiRequest(method, url, timestamp, process.env.API_SECRET as string),
});
