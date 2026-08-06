import { describe, expect, it } from 'vitest';

import { buildGoogleCalendarEventUrl } from '../../src/packages/common/utils/google-calendar-link.utils';

const START = new Date('2026-08-12T18:30:00.000Z');
const END = new Date('2026-08-12T19:15:00.000Z');

describe('buildGoogleCalendarEventUrl', () => {
  it('builds a Google Calendar template link with UTC stamps', () => {
    const url = new URL(buildGoogleCalendarEventUrl({ title: 'Haircut', startAtUtc: START, endAtUtc: END }));

    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Haircut');
    expect(url.searchParams.get('dates')).toBe('20260812T183000Z/20260812T191500Z');
  });

  it('omits optional fields when they are not provided', () => {
    const url = new URL(buildGoogleCalendarEventUrl({ title: 'Haircut', startAtUtc: START, endAtUtc: END }));

    expect(url.searchParams.has('details')).toBe(false);
    expect(url.searchParams.has('location')).toBe(false);
  });

  it('round trips accents, ampersands and newlines through the query string', () => {
    const url = new URL(
      buildGoogleCalendarEventUrl({
        title: 'Coupe & barbe — Trimium',
        startAtUtc: START,
        endAtUtc: END,
        details: 'Service: Coupe & barbe\nBarbier: Karim',
        location: '123 Rue Sainte-Catherine, Montréal, QC',
      })
    );

    expect(url.searchParams.get('text')).toBe('Coupe & barbe — Trimium');
    expect(url.searchParams.get('details')).toBe('Service: Coupe & barbe\nBarbier: Karim');
    expect(url.searchParams.get('location')).toBe('123 Rue Sainte-Catherine, Montréal, QC');

    // Raw separators must be encoded so they cannot break out of their parameter.
    const raw = url.toString();
    expect(raw).not.toContain('Coupe & barbe&dates');
    expect(raw).not.toContain('\n');
  });

  it('keeps the slash between the two stamps encoded as a parameter value', () => {
    const raw = buildGoogleCalendarEventUrl({ title: 'x', startAtUtc: START, endAtUtc: END });

    expect(raw).toContain('dates=20260812T183000Z%2F20260812T191500Z');
  });
});
