import type { Locale } from '../i18n/locale';
import { logger } from '../logger';
import { getSecretFromEnv, hmacHex, timingSafeEqualString } from './hmac.utils';

/** A reservation can only be cancelled by the client up to this many hours before it starts. */
export const CANCELLATION_CUTOFF_HOURS = 3;

const getCancellationSecret = (): string | null =>
  getSecretFromEnv('RESERVATION_CANCEL_SECRET', 'API_SECRET', 'JWT_SECRET');

const stripTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

/**
 * PUBLIC_API_URL is the only trustworthy source and should always be set in production;
 * the other two are convenience fallbacks so the feature also works out of the box.
 */
export const getPublicApiBaseUrl = (requestOrigin?: string): string | null => {
  const explicit = process.env.PUBLIC_API_URL;
  if (explicit) return stripTrailingSlashes(explicit);

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${stripTrailingSlashes(vercelHost.replace(/^https?:\/\//, ''))}`;

  if (requestOrigin) return stripTrailingSlashes(requestOrigin);

  return null;
};

/**
 * The reservation start time is part of the signature, so a link stops working as soon as
 * the appointment is rescheduled. Nothing needs to be stored server-side.
 */
export const signReservationCancelToken = (reservationId: string, startAtUtc: Date): string | null => {
  const secret = getCancellationSecret();
  if (!secret) return null;

  return hmacHex(`cancel:${reservationId}:${startAtUtc.toISOString()}`, secret);
};

export const verifyReservationCancelToken = (reservationId: string, startAtUtc: Date, token: unknown): boolean => {
  if (typeof token !== 'string' || token.length === 0) return false;

  const expected = signReservationCancelToken(reservationId, startAtUtc);
  if (!expected) return false;

  return timingSafeEqualString(expected, token);
};

export const getCancellationDeadline = (startAtUtc: Date): Date =>
  new Date(startAtUtc.getTime() - CANCELLATION_CUTOFF_HOURS * 60 * 60_000);

export const canCancelReservation = (startAtUtc: Date, now: Date = new Date()): boolean =>
  now.getTime() < getCancellationDeadline(startAtUtc).getTime();

export const buildReservationCancelUrl = ({
  reservationId,
  startAtUtc,
  locale,
  requestOrigin,
}: {
  reservationId: string;
  startAtUtc: Date;
  locale: Locale;
  requestOrigin?: string;
}): string | null => {
  const baseUrl = getPublicApiBaseUrl(requestOrigin);
  const token = signReservationCancelToken(reservationId, startAtUtc);

  if (!baseUrl) {
    logger.warn('PUBLIC_API_URL is not set, the cancellation button cannot be added to the email');
    return null;
  }

  if (!token) {
    logger.warn('No cancellation secret configured (RESERVATION_CANCEL_SECRET / API_SECRET / JWT_SECRET)');
    return null;
  }

  const params = new URLSearchParams({ rid: reservationId, token, locale });
  return `${baseUrl}/api/reservations/cancel?${params.toString()}`;
};
