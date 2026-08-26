import { format } from 'date-fns';
import { enCA, frCA } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

import { CANADA_TIMEZONE } from '../utils/reservation-time.utils';

export type Locale = 'en' | 'fr';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'fr'] as const;
export const DEFAULT_LOCALE: Locale = 'fr';

const dateFnsLocales = { en: enCA, fr: frCA };

const DAY_FORMAT: Record<Locale, string> = {
  en: 'EEEE, MMMM d, yyyy',
  fr: 'EEEE d MMMM yyyy',
};

const TIME_FORMAT: Record<Locale, string> = {
  en: 'h:mm a',
  fr: 'HH:mm',
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value.toLowerCase());

/**
 * Picks the first supported locale among the candidates. Accepts plain codes ("fr"),
 * region tags ("fr-CA") and raw Accept-Language headers ("en-US,en;q=0.9,fr;q=0.8").
 */
export const resolveLocale = (...candidates: unknown[]): Locale => {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;

    for (const part of candidate.split(',')) {
      const tag = part.split(';')[0].trim().toLowerCase().split('-')[0];
      if (isLocale(tag)) return tag;
    }
  }

  return DEFAULT_LOCALE;
};

export const formatReservationDay = (utcDate: Date, locale: Locale): string =>
  format(toZonedTime(utcDate, CANADA_TIMEZONE), DAY_FORMAT[locale], { locale: dateFnsLocales[locale] });

export const formatReservationTime = (utcDate: Date, locale: Locale): string =>
  format(toZonedTime(utcDate, CANADA_TIMEZONE), TIME_FORMAT[locale], { locale: dateFnsLocales[locale] });
