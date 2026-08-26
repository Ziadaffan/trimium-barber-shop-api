import { describe, expect, it } from 'vitest';

import {
  computeAvailableSlots,
  earliestBookableMinute,
  localDayIndex,
  rangesOverlap,
  wallClockMinutesFrom,
} from '../../src/packages/common/utils/availability.utils';

const OPEN_9_TO_17 = [{ startMinutes: 9 * 60, endMinutes: 17 * 60 }];

describe('rangesOverlap', () => {
  it('treats ranges as half open, so touching ranges do not overlap', () => {
    const a = { startMinutes: 540, endMinutes: 600 };

    expect(rangesOverlap(a, { startMinutes: 600, endMinutes: 660 })).toBe(false);
    expect(rangesOverlap(a, { startMinutes: 480, endMinutes: 540 })).toBe(false);
    expect(rangesOverlap(a, { startMinutes: 599, endMinutes: 660 })).toBe(true);
    expect(rangesOverlap(a, { startMinutes: 545, endMinutes: 555 })).toBe(true);
  });
});

describe('computeAvailableSlots', () => {
  it('generates slots on the half hour that fit entirely inside opening hours', () => {
    const slots = computeAvailableSlots({
      workingRanges: OPEN_9_TO_17,
      busyRanges: [],
      serviceDurationMinutes: 60,
    });

    expect(slots[0]).toBe('09:00');
    expect(slots.at(-1)).toBe('16:00');
    expect(slots).not.toContain('16:30');
  });

  it('drops slots overlapped by a reservation', () => {
    const slots = computeAvailableSlots({
      workingRanges: OPEN_9_TO_17,
      busyRanges: [{ startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      serviceDurationMinutes: 60,
    });

    expect(slots).not.toContain('10:00');
    expect(slots).not.toContain('09:30');
    expect(slots).toContain('09:00');
    expect(slots).toContain('11:00');
  });

  it('blocks a slot even when the reservation is not aligned to the grid', () => {
    // 09:15 -> 10:00 does not match any 30 minute key, but it still occupies the 09:00 slot.
    const slots = computeAvailableSlots({
      workingRanges: OPEN_9_TO_17,
      busyRanges: [{ startMinutes: 9 * 60 + 15, endMinutes: 10 * 60 }],
      serviceDurationMinutes: 60,
    });

    expect(slots).not.toContain('09:00');
    expect(slots).not.toContain('09:30');
    expect(slots).toContain('10:00');
  });

  it('blocks slots covered by a range that started the previous day', () => {
    const slots = computeAvailableSlots({
      workingRanges: OPEN_9_TO_17,
      busyRanges: [{ startMinutes: -120, endMinutes: 10 * 60 }],
      serviceDurationMinutes: 60,
    });

    expect(slots).not.toContain('09:00');
    expect(slots).toContain('10:00');
  });

  it('hides slots starting before minStartMinutes', () => {
    const slots = computeAvailableSlots({
      workingRanges: OPEN_9_TO_17,
      busyRanges: [],
      serviceDurationMinutes: 60,
      minStartMinutes: 14 * 60,
    });

    expect(slots[0]).toBe('14:00');
    expect(slots).not.toContain('13:30');
  });

  it('merges overlapping schedules without duplicating slots', () => {
    const slots = computeAvailableSlots({
      workingRanges: [
        { startMinutes: 9 * 60, endMinutes: 12 * 60 },
        { startMinutes: 11 * 60, endMinutes: 14 * 60 },
      ],
      busyRanges: [],
      serviceDurationMinutes: 60,
    });

    expect(slots).toEqual([...new Set(slots)]);
    expect(slots).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00']);
  });

  it('returns nothing for a service longer than the working day or with an invalid duration', () => {
    expect(
      computeAvailableSlots({ workingRanges: OPEN_9_TO_17, busyRanges: [], serviceDurationMinutes: 10 * 60 })
    ).toEqual([]);
    expect(computeAvailableSlots({ workingRanges: OPEN_9_TO_17, busyRanges: [], serviceDurationMinutes: 0 })).toEqual(
      []
    );
  });
});

describe('wallClockMinutesFrom', () => {
  const midnight = (year: number, month: number, day: number) => new Date(year, month - 1, day, 0, 0, 0, 0);

  it('measures minutes since the reference midnight', () => {
    expect(wallClockMinutesFrom(midnight(2030, 6, 12), new Date(2030, 5, 12, 9, 30))).toBe(570);
    expect(wallClockMinutesFrom(midnight(2030, 6, 12), new Date(2030, 5, 12, 0, 0))).toBe(0);
  });

  it('goes negative for the previous day and past 1440 for the next', () => {
    expect(wallClockMinutesFrom(midnight(2030, 6, 12), new Date(2030, 5, 11, 23, 30))).toBe(-30);
    expect(wallClockMinutesFrom(midnight(2030, 6, 12), new Date(2030, 5, 13, 1, 0))).toBe(1500);
  });

  it('crosses month and year boundaries', () => {
    expect(wallClockMinutesFrom(midnight(2030, 3, 1), new Date(2030, 1, 28, 23, 0))).toBe(-60);
    expect(wallClockMinutesFrom(midnight(2030, 1, 1), new Date(2029, 11, 31, 22, 0))).toBe(-120);
  });

  it('reads the wall clock, so a daylight saving day is not shifted by an hour', () => {
    // 2030-03-10 loses an hour at 02:00, 2030-11-03 gains one.
    expect(wallClockMinutesFrom(midnight(2030, 3, 10), new Date(2030, 2, 10, 10, 0))).toBe(600);
    expect(wallClockMinutesFrom(midnight(2030, 11, 3), new Date(2030, 10, 3, 13, 0))).toBe(780);
  });

  it('numbers days consistently', () => {
    expect(localDayIndex(new Date(2030, 5, 13, 23, 59)) - localDayIndex(new Date(2030, 5, 12, 0, 1))).toBe(1);
  });
});

describe('hiding slots that already passed', () => {
  const midnight = new Date(2030, 5, 12, 0, 0, 0, 0);
  const nowFilter = (now: Date) =>
    computeAvailableSlots({
      workingRanges: OPEN_9_TO_17,
      busyRanges: [],
      serviceDurationMinutes: 60,
      minStartMinutes: earliestBookableMinute(midnight, now),
    });

  it('stops offering a slot the moment it starts, since booking it would be in the past', () => {
    // The booking endpoint compares exact instants, so 13:00 is already refused at 13:00:01.
    expect(nowFilter(new Date(2030, 5, 12, 13, 0, 0, 0))).toContain('13:00');
    expect(nowFilter(new Date(2030, 5, 12, 13, 0, 1, 0))).not.toContain('13:00');
    expect(nowFilter(new Date(2030, 5, 12, 13, 0, 0, 500))).not.toContain('13:00');
    expect(nowFilter(new Date(2030, 5, 12, 13, 0, 1, 0))).toContain('13:30');
  });

  it('offers the whole day while the day is still ahead', () => {
    expect(nowFilter(new Date(2030, 5, 10, 12, 0))).toContain('09:00');
  });

  it('drops the slots already gone today and keeps the ones still to come', () => {
    const slots = nowFilter(new Date(2030, 5, 12, 13, 15));

    expect(slots).not.toContain('09:00');
    expect(slots).not.toContain('13:00');
    expect(slots).toContain('13:30');
  });

  it('offers nothing once the day is over', () => {
    expect(nowFilter(new Date(2030, 5, 13, 8, 0))).toEqual([]);
  });
});
