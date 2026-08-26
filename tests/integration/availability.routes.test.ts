import request from 'supertest';
import type { Application } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

import { createPrismaMock } from '../helpers/prismaMock';

const prismaMock = createPrismaMock();

vi.mock('../../src/packages/lib/db', () => ({ default: prismaMock, PrismaClient: class {} }));
vi.mock('../../src/packages/google/oAuth2Client', () => ({
  addReservationToGoogleCalendar: vi.fn(),
  createReservationCalendarEvent: vi.fn(),
  updateReservationInGoogleCalendar: vi.fn(),
  deleteReservationFromGoogleCalendar: vi.fn(),
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

const TIMEZONE = 'America/Toronto';
const SERVICE = { id: 'service-1', duration: 60, nameEn: 'Haircut', nameFr: 'Coupe' };

let app: Application;

/** Builds the UTC instant for a wall-clock time in the shop timezone on the given day. */
const shopTime = (day: string, time: string) => fromZonedTime(new Date(`${day}T${time}:00`), TIMEZONE);

const localDayString = (date: Date) => {
  const local = toZonedTime(date, TIMEZONE);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
};

const askAvailability = (day: string) =>
  request(app).get('/api/reservations/available-times').query({
    date: day,
    barberId: 'barber-1',
    serviceId: SERVICE.id,
  });

beforeAll(async () => {
  app = await loadApp();
});

beforeEach(() => {
  prismaMock.barber.findUnique.mockResolvedValue({ id: 'barber-1', name: 'Karim' });
  prismaMock.service.findUnique.mockResolvedValue(SERVICE);
  prismaMock.barberSchedule.findMany.mockResolvedValue([
    { id: 'schedule-1', barberId: 'barber-1', startTime: '09:00', endTime: '17:00', isActive: true },
  ]);
  prismaMock.reservation.findMany.mockResolvedValue([]);
  prismaMock.barberTimeOff.findMany.mockResolvedValue([]);
});

describe('GET /api/reservations/available-times', () => {
  const FUTURE_DAY = '2030-06-12';

  it('offers every slot of an empty day', async () => {
    const response = await askAvailability(FUTURE_DAY);

    expect(response.status).toBe(200);
    expect(response.body[0]).toBe('09:00');
    expect(response.body.at(-1)).toBe('16:00');
  });

  it('removes the slots taken by a reservation, using its stored end time', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      {
        id: 'r1',
        date: shopTime(FUTURE_DAY, '10:00'),
        endDate: shopTime(FUTURE_DAY, '11:30'),
        // A stale service duration must not win over the stored interval.
        service: { duration: 30 },
      },
    ]);

    const response = await askAvailability(FUTURE_DAY);

    expect(response.body).not.toContain('10:00');
    expect(response.body).not.toContain('10:30');
    expect(response.body).not.toContain('11:00');
    expect(response.body).toContain('11:30');
  });

  it('blocks a slot overlapped by a reservation that is off the grid', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      {
        id: 'r1',
        date: shopTime(FUTURE_DAY, '09:15'),
        endDate: shopTime(FUTURE_DAY, '10:00'),
        service: { duration: 45 },
      },
    ]);

    const response = await askAvailability(FUTURE_DAY);

    expect(response.body).not.toContain('09:00');
    expect(response.body).toContain('10:00');
  });

  it('blocks the morning when a reservation from the previous evening runs into it', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      {
        id: 'r1',
        date: shopTime('2030-06-11', '23:30'),
        endDate: shopTime(FUTURE_DAY, '09:30'),
        service: { duration: 600 },
      },
    ]);

    const response = await askAvailability(FUTURE_DAY);

    expect(response.body).not.toContain('09:00');
    expect(response.body).toContain('09:30');
  });

  it('removes the slots covered by a time off', async () => {
    prismaMock.barberTimeOff.findMany.mockResolvedValue([
      { id: 't1', startAt: shopTime(FUTURE_DAY, '12:00'), endAt: shopTime(FUTURE_DAY, '14:00') },
    ]);

    const response = await askAvailability(FUTURE_DAY);

    expect(response.body).not.toContain('12:00');
    expect(response.body).not.toContain('13:00');
    expect(response.body).not.toContain('11:30');
    expect(response.body).toContain('14:00');
  });

  it('does not offer slots that already passed today', async () => {
    const now = new Date();
    const response = await askAvailability(localDayString(now));

    const nowLocal = toZonedTime(now, TIMEZONE);
    const nowMinutes = nowLocal.getHours() * 60 + nowLocal.getMinutes();

    for (const slot of response.body as string[]) {
      const [hour, minute] = slot.split(':').map(Number);
      expect(hour * 60 + minute).toBeGreaterThanOrEqual(nowMinutes);
    }
  });

  it('offers nothing for a day that is already over', async () => {
    const response = await askAvailability('2020-06-12');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('reports no availability when the barber does not work that day', async () => {
    prismaMock.barberSchedule.findMany.mockResolvedValue([]);

    const response = await askAvailability(FUTURE_DAY);

    expect(response.status).toBe(200);
    expect(response.body.availableTimes).toEqual([]);
  });

  it('ignores cancelled reservations when looking for conflicts', async () => {
    await askAvailability(FUTURE_DAY);

    expect(prismaMock.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'CANCELLED' } }),
      })
    );
  });

  it('keeps wall clock alignment on the spring forward day', async () => {
    // 2030-03-10 is the day Toronto jumps from EST to EDT at 02:00.
    const dstDay = '2030-03-10';
    prismaMock.reservation.findMany.mockResolvedValue([
      {
        id: 'r1',
        date: shopTime(dstDay, '10:00'),
        endDate: shopTime(dstDay, '11:00'),
        service: { duration: 60 },
      },
    ]);

    const response = await askAvailability(dstDay);

    expect(response.body).not.toContain('10:00');
    expect(response.body).toContain('09:00');
    expect(response.body).toContain('11:00');
  });

  it('keeps wall clock alignment on the fall back day', async () => {
    // 2030-11-03 is the day Toronto returns from EDT to EST at 02:00.
    const dstDay = '2030-11-03';
    prismaMock.barberTimeOff.findMany.mockResolvedValue([
      { id: 't1', startAt: shopTime(dstDay, '13:00'), endAt: shopTime(dstDay, '14:00') },
    ]);

    const response = await askAvailability(dstDay);

    expect(response.body).not.toContain('13:00');
    expect(response.body).toContain('12:00');
    expect(response.body).toContain('14:00');
  });

  it('validates its query parameters', async () => {
    const response = await request(app).get('/api/reservations/available-times').query({ date: FUTURE_DAY });

    expect(response.status).toBe(400);
  });
});
