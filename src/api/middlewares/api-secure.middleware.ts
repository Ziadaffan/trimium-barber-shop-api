/**
 * Kept as a compatibility shim: the signature verification now lives in auth.middleware.ts,
 * which also accepts the admin JWT.
 */
export { apiSecureMiddleware, requireAdmin } from './auth.middleware';
