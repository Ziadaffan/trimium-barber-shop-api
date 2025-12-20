import { ReservationStatus } from '@prisma/client';
import { getReservationTimeUTC } from '../../../packages/common/utils/reservation-time.utils';

export const isValidReservationStatus = (value: unknown): value is ReservationStatus => {
  if (typeof value !== 'string') return false;
  return (Object.values(ReservationStatus) as string[]).includes(value);
};

const parseLegacyReservationStart = (date: unknown, time: unknown): Date | null => {
  if (typeof date !== 'string') return null;
  if (typeof time !== 'string') return null;
  if (time.trim().length === 0) return null;

  const utcStart = getReservationTimeUTC(date, time);
  if (!utcStart) return null;
  return utcStart;
};

export const parseReservationStartEnd = (input: {
  date: unknown;
  time?: unknown;
  endDate?: unknown;
  serviceDurationMinutes: number;
}): { utcStart: Date | null; utcEnd: Date | null } => {
  const { date, time, endDate, serviceDurationMinutes } = input;

  // Backward-compatible path: date="yyyy-MM-dd" + time="HH:mm" (or "h:mm a")
  if (time != null && endDate == null) {
    const utcStart = parseLegacyReservationStart(date, time);
    if (!utcStart) return { utcStart: null, utcEnd: null };
    return { utcStart, utcEnd: new Date(utcStart.getTime() + serviceDurationMinutes * 60_000) };
  }

  // New frontend path: date/endDate are ISO strings (UTC)
  const utcStart = typeof date === 'string' || date instanceof Date ? new Date(date as any) : null;
  const utcEnd = typeof endDate === 'string' || endDate instanceof Date ? new Date(endDate as any) : null;

  if (!utcStart || Number.isNaN(utcStart.getTime())) return { utcStart: null, utcEnd: null };

  // If endDate missing, compute it from service duration
  if (!utcEnd || Number.isNaN(utcEnd.getTime())) {
    return { utcStart, utcEnd: new Date(utcStart.getTime() + serviceDurationMinutes * 60_000) };
  }

  // Basic sanity: end must be after start
  if (utcEnd <= utcStart) return { utcStart: null, utcEnd: null };

  return { utcStart, utcEnd };
};


