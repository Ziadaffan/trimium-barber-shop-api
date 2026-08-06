import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  formatReservationDay,
  formatReservationTime,
  isLocale,
  resolveLocale,
} from '../../src/packages/common/i18n/locale';
import { getReservationStrings } from '../../src/packages/common/i18n/reservation.strings';

describe('resolveLocale', () => {
  it('defaults to French, the language of the shop', () => {
    expect(DEFAULT_LOCALE).toBe('fr');
    expect(resolveLocale()).toBe('fr');
    expect(resolveLocale(undefined, null, '')).toBe('fr');
  });

  it('accepts plain codes and region tags, case insensitively', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('EN')).toBe('en');
    expect(resolveLocale('en-CA')).toBe('en');
    expect(resolveLocale('fr-CA')).toBe('fr');
  });

  it('reads an Accept-Language header and honours its order', () => {
    expect(resolveLocale('en-US,en;q=0.9,fr;q=0.8')).toBe('en');
    expect(resolveLocale('fr-CA,fr;q=0.9,en;q=0.8')).toBe('fr');
  });

  it('skips unsupported languages and falls through to the next candidate', () => {
    expect(resolveLocale('de')).toBe('fr');
    expect(resolveLocale('es-ES,en;q=0.7')).toBe('en');
    expect(resolveLocale(undefined, 'en')).toBe('en');
    expect(resolveLocale(42, { locale: 'en' }, 'en')).toBe('en');
  });

  it('takes the first candidate that is supported, body before header', () => {
    expect(resolveLocale('fr', 'en-US')).toBe('fr');
    expect(resolveLocale(undefined, 'en-US')).toBe('en');
  });

  it('guards the locale type', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe('date formatting', () => {
  const start = new Date('2026-08-12T18:30:00.000Z'); // 14:30 in Toronto

  it('formats in the shop timezone regardless of the machine timezone', () => {
    expect(formatReservationTime(start, 'fr')).toBe('14:30');
    expect(formatReservationTime(start, 'en')).toBe('2:30 PM');
  });

  it('writes the day in the requested language', () => {
    expect(formatReservationDay(start, 'fr')).toBe('mercredi 12 août 2026');
    expect(formatReservationDay(start, 'en')).toBe('Wednesday, August 12, 2026');
  });

  it('uses 24 hour time in French and 12 hour time in English', () => {
    const evening = new Date('2026-08-12T23:00:00.000Z'); // 19:00 in Toronto

    expect(formatReservationTime(evening, 'fr')).toBe('19:00');
    expect(formatReservationTime(evening, 'en')).toBe('7:00 PM');
  });

  it('handles the winter offset too', () => {
    const winter = new Date('2026-01-14T19:30:00.000Z'); // EST, UTC-5 -> 14:30

    expect(formatReservationTime(winter, 'fr')).toBe('14:30');
    expect(formatReservationDay(winter, 'fr')).toBe('mercredi 14 janvier 2026');
  });
});

describe('translations', () => {
  it('exposes the same keys for both languages', () => {
    const fr = getReservationStrings('fr');
    const en = getReservationStrings('en');

    expect(Object.keys(fr.email).sort()).toEqual(Object.keys(en.email).sort());
    expect(Object.keys(fr.cancelPage).sort()).toEqual(Object.keys(en.cancelPage).sort());
    expect(fr.htmlLang).toBe('fr');
    expect(en.htmlLang).toBe('en');
  });

  it('never returns an empty string, so no label can render blank', () => {
    for (const locale of ['fr', 'en'] as const) {
      const strings = getReservationStrings(locale);

      for (const section of [strings.email, strings.cancelPage]) {
        for (const [key, value] of Object.entries(section)) {
          const rendered =
            typeof value === 'function'
              ? (value as (arg: any) => string)({
                  clientName: 'X',
                  serviceName: 'S',
                  day: 'D',
                  time: 'T',
                  minutes: 15,
                  deadlineTime: 'T',
                  phone: 'P',
                })
              : value;

          expect(rendered, `${locale}.${key}`).toBeTruthy();
        }
      }
    }
  });
});
