import request from 'supertest';
import type { Application } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPrismaMock } from '../helpers/prismaMock';

const prismaMock = createPrismaMock();

const getToken = vi.fn(async () => ({
  tokens: { access_token: 'access-token-value', refresh_token: 'refresh-token-value', expiry_date: 1_800_000_000_000 },
}));

class FakeOAuth2 {
  credentials: Record<string, unknown> = {};
  getToken = getToken;
  setCredentials = vi.fn();
  on = vi.fn();
  generateAuthUrl = vi.fn(
    ({ state }: { state?: string }) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`
  );
}

vi.mock('../../src/packages/lib/db', () => ({ default: prismaMock, PrismaClient: class {} }));
vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: FakeOAuth2 },
    calendar: vi.fn(() => ({ events: {}, calendars: {}, calendarList: { list: vi.fn() } })),
  },
}));

const { adminJwt, bearer, loadApp } = await import('../helpers/testApp');
const { createOAuthState, verifyOAuthState } = await import('../../src/packages/google/oAuth2Client');

let app: Application;

beforeAll(async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'https://api.trimium.test/api/google/callback';
  app = await loadApp();
});

beforeEach(() => {
  prismaMock.googleCalendarToken.upsert.mockResolvedValue({});
});

describe('OAuth state', () => {
  it('accepts a state it just minted', () => {
    expect(verifyOAuthState(createOAuthState())).toBe(true);
  });

  it('rejects a missing, malformed or tampered state', () => {
    expect(verifyOAuthState(undefined)).toBe(false);
    expect(verifyOAuthState('')).toBe(false);
    expect(verifyOAuthState('not-a-state')).toBe(false);
    expect(verifyOAuthState(`${Date.now() + 60_000}.deadbeef`)).toBe(false);

    const [expiresAt, signature] = (createOAuthState() as string).split('.');
    // Extending the deadline invalidates the signature, so the window cannot be stretched.
    expect(verifyOAuthState(`${Number(expiresAt) + 60_000}.${signature}`)).toBe(false);
  });

  it('expires', () => {
    const state = createOAuthState(Date.now() - 60 * 60_000);

    expect(verifyOAuthState(state)).toBe(false);
  });

  it('is bound to the server secret', () => {
    const state = createOAuthState();
    const { API_SECRET, JWT_SECRET } = process.env;

    process.env.API_SECRET = 'a-different-secret';
    delete process.env.JWT_SECRET;
    expect(verifyOAuthState(state)).toBe(false);

    process.env.API_SECRET = API_SECRET;
    process.env.JWT_SECRET = JWT_SECRET;
  });
});

describe('GET /api/google/auth', () => {
  it('returns an authorization url carrying a verifiable state', async () => {
    const response = await request(app).get('/api/google/auth').set(bearer(adminJwt()));

    expect(response.status).toBe(200);

    const state = new URL(response.body.authUrl).searchParams.get('state');
    expect(verifyOAuthState(state)).toBe(true);
  });
});

describe('GET /api/google/callback', () => {
  it('refuses a callback without a valid state, so nobody can inject their own account', async () => {
    const response = await request(app).get('/api/google/callback').query({ code: 'attacker-code' });

    expect(response.status).toBe(403);
    expect(getToken).not.toHaveBeenCalled();
    expect(prismaMock.googleCalendarToken.upsert).not.toHaveBeenCalled();
  });

  it('refuses an expired state', async () => {
    const response = await request(app)
      .get('/api/google/callback')
      .query({ code: 'some-code', state: createOAuthState(Date.now() - 60 * 60_000) });

    expect(response.status).toBe(403);
    expect(prismaMock.googleCalendarToken.upsert).not.toHaveBeenCalled();
  });

  it('requires the authorization code', async () => {
    const response = await request(app).get('/api/google/callback').query({ state: createOAuthState() });

    expect(response.status).toBe(400);
  });

  it('stores the tokens and never echoes them back to the browser', async () => {
    const response = await request(app)
      .get('/api/google/callback')
      .query({ code: 'valid-code', state: createOAuthState() });

    expect(response.status).toBe(200);
    expect(prismaMock.googleCalendarToken.upsert).toHaveBeenCalled();

    const body = JSON.stringify(response.body);
    expect(body).not.toContain('access-token-value');
    expect(body).not.toContain('refresh-token-value');
    expect(response.body.tokens).toBeUndefined();
    expect(response.body.authorized).toBe(true);
  });
});
