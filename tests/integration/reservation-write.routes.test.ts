import request from 'supertest';
import type { Application } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { toZonedTime } from 'date-fns-tz';

import { createPrismaMock } from '../helpers/prismaMock';

const prismaMock = createPrismaMock();

const addToCalendar = vi.fn();
const createCalendarEvent = vi.fn();
const updateCalendarEvent = vi.fn();
const deleteCalendarEvent = vi.fn();
const sendConfirmationEmail = vi.fn(async () => ({ ok: true as const }));

vi.mock('../../src/packages/lib/db', () => ({ default: prismaMock, PrismaClient: class {} }));
vi.mock('../../src/packages/email/resend', () => ({ sendReservationConfirmationEmail: sendConfirmationEmail }));
vi.mock('../../src/packages/google/oAuth2Client', () => ({
  addReservationToGoogleCalendar: addToCalendar,
  createReservationCalendarEvent: createCalendarEvent,
  updateReservationInGoogleCalendar: updateCalendarEvent,
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

const { adminJwt, bearer, loadApp } = await import('../helpers/testApp');

let app: Application;

const SERVICE = {
  id: 'service-1',
  duration: 45,
  nameEn: 'Haircut & beard',
  nameFr: 'Coupe & barbe',
};

const BARBER = { id: 'barber-1', name: 'Karim', googleCalendarId: 'calendar-1' };

const futureSlot = (daysAhead = 3) => {
  const start = new Date(Date.now() + daysAhead * 24 * 60 * 60_000);
  start.setUTCHours(14, 0, 0, 0); // 09:00 or 10:00 in Toronto depending on the season
  return { start, end: new Date(start.getTime() + SERVICE.duration * 60_000) };
};

const bookingBody = (start: Date, end: Date, extra: Record<string, unknown> = {}) => ({
  barberId: BARBER.id,
  serviceId: SERVICE.id,
  date: start.toISOString(),
  endDate: end.toISOString(),
  clientName: 'Jean-Luc',
  clientPhone: '514-555-0123',
  clientEmail: 'jl@example.com',
  ...extra,
});

beforeAll(async () => {
  app = await loadApp();
});

beforeEach(() => {
  prismaMock.service.findUnique.mockResolvedValue(SERVICE);
  prismaMock.barber.findUnique.mockResolvedValue(BARBER);
  // Open all day so the test does not depend on the weekday of "three days from now".
  prismaMock.barberSchedule.findMany.mockResolvedValue([
    { id: 'schedule-1', barberId: BARBER.id, startTime: '00:00', endTime: '23:59', isActive: true },
  ]);
  prismaMock.barberTimeOff.findFirst.mockResolvedValue(null);
  prismaMock.reservation.findFirst.mockResolvedValue(null);
  prismaMock.reservation.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data }));
});

describe('POST /api/reservations', () => {
  it('creates the reservation, syncs the calendar and emails the client', async () => {
    const { start, end } = futureSlot();
    prismaMock.reservation.create.mockResolvedValue({ id: 'reservation-1', date: start, endDate: end });
    addToCalendar.mockResolvedValue({ id: 'google-event-1' });

    const response = await request(app)
      .post('/api/reservations')
      .send(bookingBody(start, end, { locale: 'fr' }));

    expect(response.status).toBe(201);
    expect(addToCalendar).toHaveBeenCalledWith(expect.objectContaining({ date: start, endDate: end }));
    expect(prismaMock.reservation.update).toHaveBeenCalledWith({
      where: { id: 'reservation-1' },
      data: { googleEventId: 'google-event-1' },
    });
    expect(sendConfirmationEmail).toHaveBeenCalledOnce();
  });

  it('sends the confirmation in the language the booking asked for', async () => {
    const { start, end } = futureSlot();
    prismaMock.reservation.create.mockResolvedValue({ id: 'reservation-1', date: start, endDate: end });
    addToCalendar.mockResolvedValue({ id: 'google-event-1' });

    await request(app)
      .post('/api/reservations')
      .send(bookingBody(start, end, { locale: 'en' }));

    expect(sendConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en', serviceName: 'Haircut & beard' })
    );
  });

  it('uses the French service name for a French booking', async () => {
    const { start, end } = futureSlot();
    prismaMock.reservation.create.mockResolvedValue({ id: 'reservation-1', date: start, endDate: end });
    addToCalendar.mockResolvedValue({ id: 'google-event-1' });

    await request(app)
      .post('/api/reservations')
      .send(bookingBody(start, end, { locale: 'fr' }));

    expect(sendConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'fr', serviceName: 'Coupe & barbe' })
    );
  });

  it('reads the language from Accept-Language when the body does not say', async () => {
    const { start, end } = futureSlot();
    prismaMock.reservation.create.mockResolvedValue({ id: 'reservation-1', date: start, endDate: end });
    addToCalendar.mockResolvedValue({ id: 'google-event-1' });

    await request(app).post('/api/reservations').set('Accept-Language', 'en-CA,en;q=0.9').send(bookingBody(start, end));

    expect(sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' }));
  });

  it('still succeeds and emails the client when Google Calendar is down', async () => {
    const { start, end } = futureSlot();
    prismaMock.reservation.create.mockResolvedValue({ id: 'reservation-1', date: start, endDate: end });
    addToCalendar.mockResolvedValue(null);

    const response = await request(app).post('/api/reservations').send(bookingBody(start, end));

    expect(response.status).toBe(201);
    expect(sendConfirmationEmail).toHaveBeenCalledOnce();
    expect(prismaMock.reservation.update).not.toHaveBeenCalled();
  });

  it('refuses a slot in the past before touching the database', async () => {
    const start = new Date(Date.now() - 60 * 60_000);
    const end = new Date(start.getTime() + SERVICE.duration * 60_000);

    const response = await request(app).post('/api/reservations').send(bookingBody(start, end));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Cannot book a reservation in the past');
    expect(prismaMock.reservation.create).not.toHaveBeenCalled();
  });

  it('refuses a slot that overlaps an existing reservation', async () => {
    const { start, end } = futureSlot();
    prismaMock.reservation.findFirst.mockResolvedValue({ id: 'other-reservation' });

    const response = await request(app).post('/api/reservations').send(bookingBody(start, end));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Selected time overlaps an existing reservation');
    expect(prismaMock.reservation.create).not.toHaveBeenCalled();
  });

  it('asks the database for a real interval overlap, not just the same day', async () => {
    const { start, end } = futureSlot();
    prismaMock.reservation.create.mockResolvedValue({ id: 'reservation-1', date: start, endDate: end });
    addToCalendar.mockResolvedValue(null);

    await request(app).post('/api/reservations').send(bookingBody(start, end));

    expect(prismaMock.reservation.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        barberId: BARBER.id,
        date: { lt: end },
        endDate: { gt: start },
        status: { not: 'CANCELLED' },
      }),
    });
  });

  it('refuses a slot during a time off', async () => {
    const { start, end } = futureSlot();
    prismaMock.barberTimeOff.findFirst.mockResolvedValue({ id: 'time-off-1' });

    const response = await request(app).post('/api/reservations').send(bookingBody(start, end));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Barber is not available (time off)');
  });

  it('accepts the public site payload: a day, a wall clock time and a locale', async () => {
    // The website posts date="yyyy-MM-dd" + time="HH:mm" in shop local time, not ISO instants.
    const day = new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString().slice(0, 10);
    prismaMock.reservation.create.mockImplementation(async ({ data }: any) => ({ id: 'reservation-1', ...data }));
    addToCalendar.mockResolvedValue({ id: 'google-event-1' });

    const response = await request(app).post('/api/reservations').send({
      barberId: BARBER.id,
      serviceId: SERVICE.id,
      clientName: 'Jean-Luc',
      clientPhone: '514-555-0123',
      clientEmail: 'jl@example.com',
      date: day,
      time: '12:00',
      locale: 'en',
    });

    expect(response.status).toBe(201);

    const created = prismaMock.reservation.create.mock.calls[0][0].data;
    const startedAt = toZonedTime(created.date, 'America/Toronto');
    expect(startedAt.getHours()).toBe(12);
    expect(startedAt.getMinutes()).toBe(0);
    // The service lasts 45 minutes, so the end is derived from the duration.
    expect(created.endDate.getTime() - created.date.getTime()).toBe(45 * 60_000);

    expect(sendConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en', serviceName: 'Haircut & beard' })
    );
  });

  it('stays public: no credentials required to book', async () => {
    const { start, end } = futureSlot();
    prismaMock.reservation.create.mockResolvedValue({ id: 'reservation-1', date: start, endDate: end });
    addToCalendar.mockResolvedValue(null);

    expect((await request(app).post('/api/reservations').send(bookingBody(start, end))).status).toBe(201);
  });
});

describe('PUT /api/reservations/:id', () => {
  const updateBody = (start: Date, end: Date, extra: Record<string, unknown> = {}) =>
    bookingBody(start, end, { status: 'PENDING', ...extra });

  it('moves the existing calendar event instead of leaving it at the old time', async () => {
    const { start, end } = futureSlot(4);
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'reservation-1',
      googleEventId: 'google-event-1',
      barber: { googleCalendarId: 'calendar-1' },
    });
    prismaMock.reservation.update.mockResolvedValue({ id: 'reservation-1', status: 'PENDING' });
    updateCalendarEvent.mockResolvedValue(true);

    const response = await request(app)
      .put('/api/reservations/reservation-1')
      .set(bearer(adminJwt()))
      .send(updateBody(start, end));

    expect(response.status).toBe(200);
    expect(updateCalendarEvent).toHaveBeenCalledWith(
      'calendar-1',
      'google-event-1',
      expect.objectContaining({ startAt: start, endAt: end })
    );
    expect(createCalendarEvent).not.toHaveBeenCalled();
    expect(deleteCalendarEvent).not.toHaveBeenCalled();
  });

  it('recreates the event on the new calendar when the barber changes', async () => {
    const { start, end } = futureSlot(4);
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'reservation-1',
      googleEventId: 'google-event-1',
      barber: { googleCalendarId: 'old-calendar' },
    });
    prismaMock.reservation.update.mockResolvedValue({ id: 'reservation-1', status: 'PENDING' });
    createCalendarEvent.mockResolvedValue('google-event-2');

    await request(app).put('/api/reservations/reservation-1').set(bearer(adminJwt())).send(updateBody(start, end));

    expect(deleteCalendarEvent).toHaveBeenCalledWith('old-calendar', 'google-event-1');
    expect(createCalendarEvent).toHaveBeenCalledWith('calendar-1', expect.objectContaining({ startAt: start }));
    expect(prismaMock.reservation.update).toHaveBeenLastCalledWith({
      where: { id: 'reservation-1' },
      data: { googleEventId: 'google-event-2' },
    });
  });

  it('creates an event for a reservation that never had one', async () => {
    const { start, end } = futureSlot(4);
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'reservation-1',
      googleEventId: null,
      barber: { googleCalendarId: 'calendar-1' },
    });
    prismaMock.reservation.update.mockResolvedValue({ id: 'reservation-1', status: 'PENDING' });
    createCalendarEvent.mockResolvedValue('google-event-3');

    await request(app).put('/api/reservations/reservation-1').set(bearer(adminJwt())).send(updateBody(start, end));

    expect(createCalendarEvent).toHaveBeenCalledOnce();
    expect(updateCalendarEvent).not.toHaveBeenCalled();
  });

  it('recreates the event when patching it fails because it disappeared', async () => {
    const { start, end } = futureSlot(4);
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'reservation-1',
      googleEventId: 'google-event-1',
      barber: { googleCalendarId: 'calendar-1' },
    });
    prismaMock.reservation.update.mockResolvedValue({ id: 'reservation-1', status: 'PENDING' });
    updateCalendarEvent.mockResolvedValue(false);
    createCalendarEvent.mockResolvedValue('google-event-4');

    await request(app).put('/api/reservations/reservation-1').set(bearer(adminJwt())).send(updateBody(start, end));

    expect(createCalendarEvent).toHaveBeenCalledWith('calendar-1', expect.anything());
  });

  it('drops the calendar event when the reservation is cancelled', async () => {
    const { start, end } = futureSlot(4);
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'reservation-1',
      googleEventId: 'google-event-1',
      barber: { googleCalendarId: 'calendar-1' },
    });
    prismaMock.reservation.update.mockResolvedValue({ id: 'reservation-1', status: 'CANCELLED' });

    await request(app)
      .put('/api/reservations/reservation-1')
      .set(bearer(adminJwt()))
      .send(updateBody(start, end, { status: 'CANCELLED' }));

    expect(deleteCalendarEvent).toHaveBeenCalledWith('calendar-1', 'google-event-1');
    expect(updateCalendarEvent).not.toHaveBeenCalled();
    expect(prismaMock.reservation.update).toHaveBeenLastCalledWith({
      where: { id: 'reservation-1' },
      data: { googleEventId: null },
    });
  });

  it('answers 404 for a reservation that does not exist', async () => {
    const { start, end } = futureSlot(4);
    prismaMock.reservation.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .put('/api/reservations/missing')
      .set(bearer(adminJwt()))
      .send(updateBody(start, end));

    expect(response.status).toBe(404);
    expect(prismaMock.reservation.update).not.toHaveBeenCalled();
  });

  it('excludes itself from the overlap check so a no-op save is allowed', async () => {
    const { start, end } = futureSlot(4);
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'reservation-1',
      googleEventId: null,
      barber: { googleCalendarId: 'calendar-1' },
    });
    prismaMock.reservation.update.mockResolvedValue({ id: 'reservation-1', status: 'PENDING' });
    createCalendarEvent.mockResolvedValue(null);

    await request(app).put('/api/reservations/reservation-1').set(bearer(adminJwt())).send(updateBody(start, end));

    expect(prismaMock.reservation.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: { not: 'reservation-1' } }),
    });
  });
});

describe('DELETE /api/reservations/:id', () => {
  it('removes the calendar event before deleting the row', async () => {
    const calls: string[] = [];
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'reservation-1',
      googleEventId: 'google-event-1',
      barber: { googleCalendarId: 'calendar-1' },
    });
    deleteCalendarEvent.mockImplementation(async () => {
      calls.push('calendar');
      return true;
    });
    prismaMock.reservation.delete.mockImplementation(async () => {
      calls.push('database');
      return { id: 'reservation-1' };
    });

    const response = await request(app).delete('/api/reservations/reservation-1').set(bearer(adminJwt()));

    expect(response.status).toBe(204);
    expect(deleteCalendarEvent).toHaveBeenCalledWith('calendar-1', 'google-event-1');
    expect(calls).toEqual(['calendar', 'database']);
  });

  it('answers 404 instead of throwing for an unknown id', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue(null);

    const response = await request(app).delete('/api/reservations/missing').set(bearer(adminJwt()));

    expect(response.status).toBe(404);
    expect(prismaMock.reservation.delete).not.toHaveBeenCalled();
  });

  it('skips the calendar when there is no event to remove', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'reservation-1',
      googleEventId: null,
      barber: { googleCalendarId: 'calendar-1' },
    });
    prismaMock.reservation.delete.mockResolvedValue({ id: 'reservation-1' });

    await request(app).delete('/api/reservations/reservation-1').set(bearer(adminJwt()));

    expect(deleteCalendarEvent).not.toHaveBeenCalled();
  });
});
