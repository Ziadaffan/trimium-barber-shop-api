import request from 'supertest';
import type { Application } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPrismaMock } from '../helpers/prismaMock';

const prismaMock = createPrismaMock();

vi.mock('../../src/packages/lib/db', () => ({ default: prismaMock, PrismaClient: class {} }));
vi.mock('../../src/packages/google/oAuth2Client', () => ({
  getAuthUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth?state=signed',
  getTokensFromCode: vi.fn(),
  setCredentials: vi.fn(),
  getStoredTokens: vi.fn(async () => null),
  setupCalendarWatch: vi.fn(),
  getCalendarEvent: vi.fn(),
  listRecentCalendarEvents: vi.fn(async () => []),
  listCalendars: vi.fn(async () => []),
  verifyOAuthState: vi.fn(() => false),
}));

const { adminJwt, bearer, expiredJwt, loadApp, signedHeaders } = await import('../helpers/testApp');

let app: Application;

beforeAll(async () => {
  app = await loadApp();
});

beforeEach(() => {
  prismaMock.reservation.findMany.mockResolvedValue([]);
  prismaMock.comment.findMany.mockResolvedValue([]);
  prismaMock.barber.findMany.mockResolvedValue([]);
  prismaMock.service.findMany.mockResolvedValue([]);
});

describe('routes that expose or mutate shop data', () => {
  const protectedRoutes: Array<[string, string]> = [
    ['get', '/api/reservations'],
    ['put', '/api/reservations/some-id'],
    ['delete', '/api/reservations/some-id'],
    ['post', '/api/barbers'],
    ['put', '/api/barbers/some-id'],
    ['delete', '/api/barbers/some-id'],
    ['post', '/api/services'],
    ['put', '/api/services/some-id'],
    ['delete', '/api/services/some-id'],
    ['post', '/api/products'],
    ['delete', '/api/products/some-id'],
    ['post', '/api/gallery'],
    ['delete', '/api/gallery/some-id'],
    ['delete', '/api/comments/some-id'],
    ['post', '/api/schedules/barber/b1'],
    ['delete', '/api/schedules/barber/b1/s1'],
    ['post', '/api/timeoffs/barber/b1'],
    ['delete', '/api/timeoffs/barber/b1/t1'],
    ['get', '/api/google/auth'],
    ['get', '/api/google/status'],
    ['get', '/api/google/calendars'],
    ['post', '/api/google/webhook/setup'],
    ['post', '/api/signature'],
    ['get', '/api/cron/renew-watches'],
  ];

  it.each(protectedRoutes)('rejects an anonymous %s %s with 401', async (method, url) => {
    const response = await (request(app) as any)[method](url);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Unauthorized');
  });

  it('accepts the admin JWT', async () => {
    const response = await request(app).get('/api/reservations').set(bearer(adminJwt()));

    expect(response.status).toBe(200);
    expect(prismaMock.reservation.findMany).toHaveBeenCalled();
  });

  it('accepts an HMAC signed request', async () => {
    const url = '/api/reservations';
    const response = await request(app).get(url).set(signedHeaders('GET', url));

    expect(response.status).toBe(200);
  });
});

describe('credentials that must not be accepted', () => {
  it('rejects an expired JWT', async () => {
    const response = await request(app).get('/api/reservations').set(bearer(expiredJwt()));

    expect(response.status).toBe(401);
  });

  it('rejects a JWT signed with the wrong secret', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const forged = jwt.sign({ email: 'attacker@example.com' }, 'not-our-secret');

    expect((await request(app).get('/api/reservations').set(bearer(forged))).status).toBe(401);
  });

  it('rejects a malformed authorization header', async () => {
    expect((await request(app).get('/api/reservations').set({ Authorization: 'Basic abc' })).status).toBe(401);
    expect((await request(app).get('/api/reservations').set({ Authorization: 'Bearer' })).status).toBe(401);
  });

  it('rejects a signature bound to a different method or url', async () => {
    const wrongUrl = await request(app).get('/api/reservations').set(signedHeaders('GET', '/api/barbers'));
    const wrongMethod = await request(app).get('/api/reservations').set(signedHeaders('POST', '/api/reservations'));

    expect(wrongUrl.status).toBe(401);
    expect(wrongMethod.status).toBe(401);
  });

  it('rejects a signature whose timestamp is outside the accepted window', async () => {
    const url = '/api/reservations';
    const tooOld = Date.now() - 6 * 60 * 1000;
    const tooFarAhead = Date.now() + 6 * 60 * 1000;

    expect(
      (
        await request(app)
          .get(url)
          .set(signedHeaders('GET', url, tooOld))
      ).status
    ).toBe(401);
    expect(
      (
        await request(app)
          .get(url)
          .set(signedHeaders('GET', url, tooFarAhead))
      ).status
    ).toBe(401);
  });

  it('rejects a signature that does not match the secret', async () => {
    const url = '/api/reservations';
    const response = await request(app)
      .get(url)
      .set({ 'x-timestamp': String(Date.now()), 'x-signature': 'f'.repeat(64) });

    expect(response.status).toBe(401);
  });
});

describe('the signature endpoint', () => {
  it('no longer hands out signatures to anonymous callers', async () => {
    const response = await request(app)
      .post('/api/signature')
      .send({ method: 'GET', url: '/api/reservations', timestamp: Date.now() });

    expect(response.status).toBe(401);
    expect(response.body.signature).toBeUndefined();
  });

  it('signs for an authenticated admin, and the result opens a protected route', async () => {
    const url = '/api/reservations';
    const timestamp = Date.now();

    const minted = await request(app).post('/api/signature').set(bearer(adminJwt())).send({
      method: 'GET',
      url,
      timestamp,
    });

    expect(minted.status).toBe(200);
    expect(minted.body.signature).toMatch(/^[0-9a-f]{64}$/);

    const used = await request(app)
      .get(url)
      .set({ 'x-timestamp': String(timestamp), 'x-signature': minted.body.signature });

    expect(used.status).toBe(200);
  });

  it('refuses to pre-sign a far future timestamp', async () => {
    const response = await request(app)
      .post('/api/signature')
      .set(bearer(adminJwt()))
      .send({ method: 'GET', url: '/api/reservations', timestamp: Date.now() + 60 * 60 * 1000 });

    expect(response.status).toBe(400);
  });
});

describe('routes the public website needs', () => {
  const publicRoutes: Array<[string, string]> = [
    ['get', '/health'],
    ['get', '/api/barbers'],
    ['get', '/api/services'],
    ['get', '/api/comments'],
    ['get', '/api/reservations/cancel'],
  ];

  it.each(publicRoutes)('leaves %s %s reachable without credentials', async (method, url) => {
    const response = await (request(app) as any)[method](url);

    expect(response.status).not.toBe(401);
  });
});

describe('multipart uploads', () => {
  // The guard runs before multer, so it must not depend on a parsed body. Reaching the
  // controller's own validation ("Image is required") proves the ordering works.
  it('lets an authenticated multipart request through to the controller', async () => {
    const response = await request(app)
      .post('/api/barbers')
      .set(bearer(adminJwt()))
      .field('name', 'Karim')
      .field('email', 'karim@trimium.test')
      .field('phone', '514-555-0123');

    expect(response.status).not.toBe(401);
    expect(response.body.message).toBe('Image is required');
  });

  it('rejects an anonymous multipart request', async () => {
    const response = await request(app)
      .post('/api/barbers')
      .field('name', 'Karim')
      .field('email', 'karim@trimium.test')
      .field('phone', '514-555-0123');

    expect(response.status).toBe(401);
  });
});

describe('the cron route', () => {
  it('accepts the Vercel cron bearer secret', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    prismaMock.googleCalendarWatch.findMany.mockResolvedValue([]);

    const response = await request(app).get('/api/cron/renew-watches').set(bearer('cron-secret'));

    delete process.env.CRON_SECRET;
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });

  it('rejects a wrong cron secret', async () => {
    process.env.CRON_SECRET = 'cron-secret';

    const response = await request(app).get('/api/cron/renew-watches').set(bearer('wrong-secret'));

    delete process.env.CRON_SECRET;
    expect(response.status).toBe(401);
  });
});
