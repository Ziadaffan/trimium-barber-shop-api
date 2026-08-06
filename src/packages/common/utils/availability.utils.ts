import { SLOT_MINUTES, minutesToTime } from './reservation-time.utils';

/** Minutes since local midnight, end exclusive. */
export interface MinuteRange {
  startMinutes: number;
  endMinutes: number;
}

export const rangesOverlap = (a: MinuteRange, b: MinuteRange): boolean =>
  a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes;

/** Calendar day number of a local date, immune to daylight saving shifts. */
export const localDayIndex = (localDate: Date): number =>
  Math.floor(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()) / 86_400_000);

/**
 * Wall clock minutes between a reference local midnight and a local date, which may fall on
 * another day (negative when earlier).
 *
 * Read from the calendar fields rather than by subtracting timestamps: on a spring forward day
 * midnight to 10:00 is only nine elapsed hours, which would shift every interval by an hour.
 */
export const wallClockMinutesFrom = (referenceLocalMidnight: Date, localDate: Date): number =>
  (localDayIndex(localDate) - localDayIndex(referenceLocalMidnight)) * 24 * 60 +
  localDate.getHours() * 60 +
  localDate.getMinutes();

/**
 * First minute still bookable, rounded up so a minute that has already partly elapsed counts as
 * past. Without the rounding the 15:00 slot would stay on offer until 15:01 while the booking
 * endpoint, which compares exact instants, already refuses it as being in the past.
 */
export const earliestBookableMinute = (referenceLocalMidnight: Date, nowLocal: Date): number => {
  const minutes = wallClockMinutesFrom(referenceLocalMidnight, nowLocal);
  const startedAlready = nowLocal.getSeconds() > 0 || nowLocal.getMilliseconds() > 0;

  return startedAlready ? minutes + 1 : minutes;
};

export interface ComputeAvailableSlotsInput {
  /** Opening hours of the day, one range per active schedule. */
  workingRanges: MinuteRange[];
  /** Reservations and time off already occupying part of the day. */
  busyRanges: MinuteRange[];
  serviceDurationMinutes: number;
  slotMinutes?: number;
  /**
   * Slots starting before this minute are dropped. Pass the current wall clock minute relative
   * to the same midnight to hide slots that already passed: it is negative for a future day and
   * beyond the end of the day for one that is already over.
   */
  minStartMinutes?: number;
}

/**
 * Interval overlap rather than a set of half-hour keys: a reservation that does not sit on the
 * slot grid (09:15 → 10:00) still blocks the 09:00 slot, which a key-based check would miss.
 */
export const computeAvailableSlots = ({
  workingRanges,
  busyRanges,
  serviceDurationMinutes,
  slotMinutes = SLOT_MINUTES,
  minStartMinutes = 0,
}: ComputeAvailableSlotsInput): string[] => {
  if (serviceDurationMinutes <= 0) return [];

  const starts = new Set<number>();

  for (const range of workingRanges) {
    for (let start = range.startMinutes; start + serviceDurationMinutes <= range.endMinutes; start += slotMinutes) {
      starts.add(start);
    }
  }

  return [...starts]
    .sort((a, b) => a - b)
    .filter(start => start >= minStartMinutes)
    .filter(start => {
      const slot = { startMinutes: start, endMinutes: start + serviceDurationMinutes };
      return !busyRanges.some(busy => rangesOverlap(slot, busy));
    })
    .map(minutesToTime);
};
