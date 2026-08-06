import request from 'supertest';
import type { Application } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPrismaMock } from '../helpers/prismaMock';

const prismaMock = createPrismaMock();
const deleteCalendarEvent = vi.fn(async () => true);

vi.mock('../../src/packages/lib/db', () => ({ default: prismaMock, PrismaClient: class {} }));
vi.mock('../../src/packages/google/oAuth2Client', () => ({
  addReservationToGoogleCalendar: vi.fn(),
  createReservationCalendarEvent: vi.fn(),
  updateReservationInGoogleCalendar: vi.fn(),
  deleteReservationFromGoogleCalendar: deleteCalendarEvent,
  getAuthUrl: () => 'https://accounts.google.com',
  getTokensFromCode: vi.fn(),
  setCredentials: vi.fn(),
  getStoredTokens: vi.fn(async () => null),
  setupCalendarWatch: vi.fn(),
  getCalendarEvent: vi.fn(),
  listRecentCalendarEvents: vi.fn(async () => []),
  listCalendars: vi.fn(async () => []),
  verifyOAuthState: vi.fn(() => true),
}));

const { loadApp } = await import('../helpers/testApp');
const { signReservationCancelToken } = await import('../../src/packages/common/utils/reservation-cancel.utils');

let app: Application;

const RESERVATION_ID = 'a1b2c3d4-0000-4444-8888-abcdefabcdef';

const reservationStartingIn = (minutes: number, overrides: Record<string, unknown> = {}) => {
  const date = new Date(Date.now() + minutes * 60_000);

  return {
    id: RESERVATION_ID,
    date,
    endDate: new Date(date.getTime() + 45 * 60_000),
    status: 'PENDING',
    googleEventId: null,
    barberId: 'barber-1',
    service: { nameFr: 'Coupe & barbe', nameEn: 'Haircut & beard' },
    barber: { name: 'Karim', googleCalendarId: null },
    ...overrides,
  };
};

const cancelUrl = (reservation: { id: string; date: Date }, locale?: string) => {
  const params = new URLSearchParams({
    rid: reservation.id,
    token: signReservationCancelToken(reservation.id, reservation.date) as string,
  });
  if (locale) params.set('locale', locale);

  return `/api/reservations/cancel?${params.toString()}`;
};

const postCancel = (reservation: { id: string; date: Date }, locale = 'fr') =>
  request(app)
    .post('/api/reservations/cancel')
    .type('form')
    .send({
      rid: reservation.id,
      token: signReservationCancelToken(reservation.id, reservation.date) as string,
      locale,
    });

beforeAll(async () => {
  app = await loadApp();
});

beforeEach(() => {
  deleteCalendarEvent.mockClear();
  prismaMock.reservation.delete.mockImplementation(async ({ where }: any) => ({ id: where.id }));
});

describe('GET the cancellation page', () => {
  it('shows a confirmation form in French', async () => {
    const reservation = reservationStartingIn(180);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);

    const response = await request(app).get(cancelUrl(reservation, 'fr'));

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).toContain('Voulez-vous vraiment annuler cette réservation?');
    expect(response.text).toContain('Coupe &amp; barbe');
    expect(response.text).toContain('<form method="post"');
  });

  it('shows the same page in English when asked', async () => {
    const reservation = reservationStartingIn(180);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);

    const response = await request(app).get(cancelUrl(reservation, 'en'));

    expect(response.text).toContain('Do you really want to cancel this reservation?');
    expect(response.text).toContain('Haircut &amp; beard');
    expect(response.text).not.toContain('Voulez-vous');
  });

  it('falls back to French when the link carries no locale', async () => {
    const reservation = reservationStartingIn(180);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);

    const response = await request(app).get(cancelUrl(reservation));

    expect(response.text).toContain('<html lang="fr">');
  });

  it('never cancels anything, so email clients pre-fetching the link are harmless', async () => {
    const reservation = reservationStartingIn(180);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);

    await request(app).get(cancelUrl(reservation, 'fr'));

    expect(prismaMock.reservation.delete).not.toHaveBeenCalled();
    expect(deleteCalendarEvent).not.toHaveBeenCalled();
  });

  it('rejects a tampered token with 403', async () => {
    const reservation = reservationStartingIn(180);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);

    const response = await request(app).get(`/api/reservations/cancel?rid=${RESERVATION_ID}&token=nope&locale=fr`);

    expect(response.status).toBe(403);
    expect(response.text).toContain('Ce lien d&#039;annulation est invalide');
  });

  it('rejects a token that was issued before the reservation was moved', async () => {
    const reservation = reservationStartingIn(180);
    const url = cancelUrl(reservation, 'en');
    prismaMock.reservation.findUnique.mockResolvedValue({
      ...reservation,
      date: new Date(reservation.date.getTime() + 30 * 60_000),
    });

    expect((await request(app).get(url)).status).toBe(403);
  });

  it('answers 400 when the link is missing parameters', async () => {
    expect((await request(app).get('/api/reservations/cancel?locale=en')).status).toBe(400);
  });

  it('answers 404 for a reservation that no longer exists', async () => {
    const reservation = reservationStartingIn(180);
    prismaMock.reservation.findUnique.mockResolvedValue(null);

    const response = await request(app).get(cancelUrl(reservation, 'en'));

    expect(response.status).toBe(404);
    expect(response.text).toContain('This reservation no longer exists');
  });

  it('refuses inside the 15 minute window and offers the shop phone number', async () => {
    const reservation = reservationStartingIn(10);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);

    const response = await request(app).get(cancelUrl(reservation, 'fr'));

    expect(response.status).toBe(409);
    expect(response.text).toContain('Il est trop tard pour annuler en ligne');
    expect(response.text).toContain('+1 514 555 0199');
    expect(response.text).not.toContain('<form method="post"');
  });

  it('refuses for an appointment that already started', async () => {
    const reservation = reservationStartingIn(-30);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);

    expect((await request(app).get(cancelUrl(reservation, 'fr'))).status).toBe(409);
  });
});

describe('POST the cancellation', () => {
  it('deletes the reservation and confirms in the chosen language', async () => {
    const reservation = reservationStartingIn(180);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);

    const response = await postCancel(reservation, 'fr');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Votre réservation a été annulée');
    expect(prismaMock.reservation.delete).toHaveBeenCalledWith({ where: { id: RESERVATION_ID } });
  });

  it('removes the barber calendar event before deleting the row', async () => {
    const calls: string[] = [];
    const reservation = reservationStartingIn(180, {
      googleEventId: 'google-event-1',
      barber: { name: 'Karim', googleCalendarId: 'calendar-1' },
    });

    prismaMock.reservation.findUnique.mockResolvedValue(reservation);
    deleteCalendarEvent.mockImplementation(async () => {
      calls.push('calendar');
      return true;
    });
    prismaMock.reservation.delete.mockImplementation(async () => {
      calls.push('database');
      return reservation;
    });

    await postCancel(reservation, 'en');

    expect(deleteCalendarEvent).toHaveBeenCalledWith('calendar-1', 'google-event-1');
    expect(calls).toEqual(['calendar', 'database']);
  });

  it('still cancels when the calendar call fails', async () => {
    const reservation = reservationStartingIn(180, {
      googleEventId: 'google-event-1',
      barber: { name: 'Karim', googleCalendarId: 'calendar-1' },
    });

    prismaMock.reservation.findUnique.mockResolvedValue(reservation);
    deleteCalendarEvent.mockResolvedValue(false);

    const response = await postCancel(reservation, 'en');

    expect(response.status).toBe(200);
    expect(prismaMock.reservation.delete).toHaveBeenCalled();
  });

  it('skips the calendar entirely when the reservation has no event', async () => {
    const reservation = reservationStartingIn(180);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);

    await postCancel(reservation, 'fr');

    expect(deleteCalendarEvent).not.toHaveBeenCalled();
  });

  it('does not delete anything when the token is wrong', async () => {
    const reservation = reservationStartingIn(180);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);

    const response = await request(app)
      .post('/api/reservations/cancel')
      .type('form')
      .send({ rid: RESERVATION_ID, token: 'forged', locale: 'en' });

    expect(response.status).toBe(403);
    expect(prismaMock.reservation.delete).not.toHaveBeenCalled();
  });

  it('does not delete anything inside the cutoff window, even by replaying a valid link', async () => {
    const reservation = reservationStartingIn(5);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);

    const response = await postCancel(reservation, 'en');

    expect(response.status).toBe(409);
    expect(prismaMock.reservation.delete).not.toHaveBeenCalled();
    expect(deleteCalendarEvent).not.toHaveBeenCalled();
  });

  it('shows a localized error page instead of a stack trace when the database fails', async () => {
    const reservation = reservationStartingIn(180);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);
    prismaMock.reservation.delete.mockRejectedValue(new Error('connection lost'));

    const response = await postCancel(reservation, 'fr');

    expect(response.status).toBe(500);
    expect(response.text).toContain('Une erreur est survenue');
    expect(response.text).not.toContain('connection lost');
  });

  it('requires no credentials, since the signed token is the credential', async () => {
    const reservation = reservationStartingIn(180);
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);

    expect((await postCancel(reservation, 'fr')).status).toBe(200);
  });
});
