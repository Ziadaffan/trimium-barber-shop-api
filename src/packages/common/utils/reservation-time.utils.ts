import { parse } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

export const CANADA_TIMEZONE = 'America/Toronto';
export const SLOT_MINUTES = 30;

export function parseTimeToMinutes(time: string) {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? '0', 10);
  return h * 60 + m;
}

export function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function getReservationTimeUTC(date: string, time: string) {
  const dateTimeString = `${date} ${time}`;
  let parsedDate = parse(dateTimeString, 'yyyy-MM-dd HH:mm', new Date());

  if (isNaN(parsedDate.getTime())) {
    parsedDate = parse(dateTimeString, 'yyyy-MM-dd h:mm a', new Date());
  }

  if (isNaN(parsedDate.getTime())) {
    return null;
  }

  return fromZonedTime(parsedDate, CANADA_TIMEZONE);
}

