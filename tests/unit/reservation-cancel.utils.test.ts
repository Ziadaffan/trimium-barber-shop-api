import { afterEach, describe, expect, it } from 'vitest';

import {
  CANCELLATION_CUTOFF_MINUTES,
  buildReservationCancelUrl,
  canCancelReservation,
  getCancellationDeadline,
  getPublicApiBaseUrl,
  signReservationCancelToken,
  verifyReservationCancelToken,
} from '../../src/packages/common/utils/reservation-cancel.utils';

const RESERVATION_ID = 'a1b2c3d4-0000-4444-8888-abcdefabcdef';
const START = new Date('2026-08-12T18:30:00.000Z');

describe('cancellation tokens', () => {
  it('accepts a token it produced for the same reservation and start time', () => {
    const token = signReservationCancelToken(RESERVATION_ID, START) as string;

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyReservationCancelToken(RESERVATION_ID, START, token)).toBe(true);
  });

  it('rejects a token issued for another reservation', () => {
    const token = signReservationCancelToken(RESERVATION_ID, START) as string;

    expect(verifyReservationCancelToken('some-other-id', START, token)).toBe(false);
  });

  it('stops working once the reservation is rescheduled', () => {
    const token = signReservationCancelToken(RESERVATION_ID, START) as string;
    const movedByOneMinute = new Date(START.getTime() + 60_000);

    expect(verifyReservationCancelToken(RESERVATION_ID, movedByOneMinute, token)).toBe(false);
  });

  it('rejects tampered, truncated and missing tokens without throwing', () => {
    const token = signReservationCancelToken(RESERVATION_ID, START) as string;

    expect(verifyReservationCancelToken(RESERVATION_ID, START, `${token.slice(0, -1)}0`)).toBe(false);
    expect(verifyReservationCancelToken(RESERVATION_ID, START, token.slice(0, 10))).toBe(false);
    expect(verifyReservationCancelToken(RESERVATION_ID, START, '')).toBe(false);
    expect(verifyReservationCancelToken(RESERVATION_ID, START, undefined)).toBe(false);
    expect(verifyReservationCancelToken(RESERVATION_ID, START, 42)).toBe(false);
  });

  it('changes when the signing secret changes', () => {
    const withDefaultSecret = signReservationCancelToken(RESERVATION_ID, START);

    process.env.RESERVATION_CANCEL_SECRET = 'a-dedicated-secret';
    const withDedicatedSecret = signReservationCancelToken(RESERVATION_ID, START);
    delete process.env.RESERVATION_CANCEL_SECRET;

    expect(withDedicatedSecret).not.toBe(withDefaultSecret);
  });

  it('produces no token at all when no secret is configured', () => {
    const { API_SECRET, JWT_SECRET } = process.env;
    delete process.env.API_SECRET;
    delete process.env.JWT_SECRET;

    expect(signReservationCancelToken(RESERVATION_ID, START)).toBeNull();
    expect(verifyReservationCancelToken(RESERVATION_ID, START, 'anything')).toBe(false);

    process.env.API_SECRET = API_SECRET;
    process.env.JWT_SECRET = JWT_SECRET;
  });
});

describe('the 15 minute cutoff', () => {
  it('is exactly 15 minutes before the start', () => {
    expect(CANCELLATION_CUTOFF_MINUTES).toBe(15);
    expect(getCancellationDeadline(START).toISOString()).toBe('2026-08-12T18:15:00.000Z');
  });

  it('allows cancelling before the deadline and refuses from the deadline onwards', () => {
    const at = (minutesFromStart: number) => new Date(START.getTime() + minutesFromStart * 60_000);

    expect(canCancelReservation(START, at(-16))).toBe(true);
    expect(canCancelReservation(START, at(-15.01))).toBe(true);
    expect(canCancelReservation(START, at(-15))).toBe(false);
    expect(canCancelReservation(START, at(-14))).toBe(false);
    expect(canCancelReservation(START, at(0))).toBe(false);
    expect(canCancelReservation(START, at(60))).toBe(false);
  });
});

describe('cancellation link', () => {
  afterEach(() => {
    process.env.PUBLIC_API_URL = 'https://api.trimium.test';
    delete process.env.VERCEL_URL;
  });

  it('points at the public cancel route and carries the reservation, token and locale', () => {
    const url = buildReservationCancelUrl({ reservationId: RESERVATION_ID, startAtUtc: START, locale: 'fr' }) as string;
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://api.trimium.test');
    expect(parsed.pathname).toBe('/api/reservations/cancel');
    expect(parsed.searchParams.get('rid')).toBe(RESERVATION_ID);
    expect(parsed.searchParams.get('locale')).toBe('fr');
    expect(verifyReservationCancelToken(RESERVATION_ID, START, parsed.searchParams.get('token'))).toBe(true);
  });

  it('prefers PUBLIC_API_URL, then VERCEL_URL, then the request origin', () => {
    expect(getPublicApiBaseUrl('http://localhost:3000')).toBe('https://api.trimium.test');

    delete process.env.PUBLIC_API_URL;
    process.env.VERCEL_URL = 'trimium-api.vercel.app';
    expect(getPublicApiBaseUrl('http://localhost:3000')).toBe('https://trimium-api.vercel.app');

    delete process.env.VERCEL_URL;
    expect(getPublicApiBaseUrl('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(getPublicApiBaseUrl()).toBeNull();
  });

  it('trims trailing slashes so the path is never doubled', () => {
    process.env.PUBLIC_API_URL = 'https://api.trimium.test///';

    const url = buildReservationCancelUrl({ reservationId: RESERVATION_ID, startAtUtc: START, locale: 'en' }) as string;

    expect(url.startsWith('https://api.trimium.test/api/reservations/cancel?')).toBe(true);
  });

  it('returns null instead of a broken link when no base URL can be determined', () => {
    delete process.env.PUBLIC_API_URL;

    expect(buildReservationCancelUrl({ reservationId: RESERVATION_ID, startAtUtc: START, locale: 'fr' })).toBeNull();
  });
});
