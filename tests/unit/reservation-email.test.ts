import { afterEach, describe, expect, it } from 'vitest';

import {
  type ReservationConfirmationEmailInput,
  renderReservationConfirmationHtml,
  renderReservationConfirmationSubject,
  renderReservationConfirmationText,
} from '../../src/packages/email/templates/reservationConfirmation';
import { verifyReservationCancelToken } from '../../src/packages/common/utils/reservation-cancel.utils';

const baseInput: ReservationConfirmationEmailInput = {
  reservationId: 'a1b2c3d4-0000-4444-8888-abcdefabcdef',
  clientName: 'Jean-Luc',
  clientEmail: 'jl@example.com',
  clientPhone: '514-555-0123',
  barberName: 'Karim',
  serviceName: 'Coupe & barbe',
  startAtUtc: new Date('2026-08-12T18:30:00.000Z'),
  endAtUtc: new Date('2026-08-12T19:15:00.000Z'),
};

/** Extracts hrefs and undoes the HTML escaping, the way a mail client does before navigating. */
const hrefs = (html: string) => (html.match(/href="([^"]+)"/g) ?? []).map(h => h.slice(6, -1).replace(/&amp;/g, '&'));

afterEach(() => {
  process.env.PUBLIC_API_URL = 'https://api.trimium.test';
});

describe('subject line', () => {
  it('is written in the requested language', () => {
    expect(renderReservationConfirmationSubject({ ...baseInput, locale: 'fr' })).toBe(
      'Réservation confirmée • Coupe & barbe • mercredi 12 août 2026 à 14:30'
    );
    expect(renderReservationConfirmationSubject({ ...baseInput, locale: 'en' })).toBe(
      'Reservation confirmed • Coupe & barbe • Wednesday, August 12, 2026 at 2:30 PM'
    );
  });

  it('falls back to French when no locale is given', () => {
    expect(renderReservationConfirmationSubject(baseInput)).toContain('Réservation confirmée');
  });
});

describe('plain text body', () => {
  it('never mixes the two languages', () => {
    const fr = renderReservationConfirmationText({ ...baseInput, locale: 'fr' });
    const en = renderReservationConfirmationText({ ...baseInput, locale: 'en' });

    expect(fr).toContain('Bonjour Jean-Luc,');
    expect(fr).toContain('Votre réservation est confirmée.');
    expect(fr).toContain('Barbier: Karim');
    expect(fr).toContain('Ajouter à Google Agenda:');
    expect(fr).toContain('Annuler ma réservation:');
    expect(fr).not.toMatch(/\bHi\b|Barber:|Cancel my/);

    expect(en).toContain('Hi Jean-Luc,');
    expect(en).toContain('Your reservation is confirmed.');
    expect(en).toContain('Barber: Karim');
    expect(en).toContain('Add to Google Calendar:');
    expect(en).toContain('Cancel my reservation:');
    expect(en).not.toMatch(/Bonjour|Barbier:|Annuler/);
  });

  it('keeps the blank lines that separate the blocks', () => {
    expect(renderReservationConfirmationText({ ...baseInput, locale: 'fr' })).toContain(
      'Bonjour Jean-Luc,\n\nVotre réservation est confirmée.'
    );
  });

  it('states the cancellation deadline as a real time', () => {
    expect(renderReservationConfirmationText({ ...baseInput, locale: 'fr' })).toContain(
      "Vous pouvez annuler en ligne jusqu'à 11:30, soit au plus tard 3 heures"
    );
    expect(renderReservationConfirmationText({ ...baseInput, locale: 'en' })).toContain(
      'You can cancel online until 11:30 AM, that is up to 3 hours'
    );
  });

  it('drops optional lines that have no value', () => {
    const text = renderReservationConfirmationText({
      ...baseInput,
      locale: 'fr',
      clientPhone: undefined,
      barberName: undefined,
    });

    expect(text).not.toContain('Téléphone:');
    expect(text).not.toContain('Barbier:');
    expect(text).not.toContain('undefined');
  });
});

describe('html body', () => {
  it('declares the right document language', () => {
    expect(renderReservationConfirmationHtml({ ...baseInput, locale: 'fr' })).toContain('<html lang="fr">');
    expect(renderReservationConfirmationHtml({ ...baseInput, locale: 'en' })).toContain('<html lang="en">');
  });

  it('carries exactly two buttons: add to calendar and cancel', () => {
    const links = hrefs(renderReservationConfirmationHtml({ ...baseInput, locale: 'fr' }));

    expect(links).toHaveLength(2);
    expect(links[0]).toContain('calendar.google.com/calendar/render');
    expect(links[1]).toContain('/api/reservations/cancel');
  });

  it('signs the cancellation link for this reservation and start time', () => {
    const cancelUrl = new URL(hrefs(renderReservationConfirmationHtml({ ...baseInput, locale: 'fr' }))[1]);

    expect(cancelUrl.searchParams.get('rid')).toBe(baseInput.reservationId);
    expect(cancelUrl.searchParams.get('locale')).toBe('fr');
    expect(
      verifyReservationCancelToken(baseInput.reservationId, baseInput.startAtUtc, cancelUrl.searchParams.get('token'))
    ).toBe(true);
  });

  it('escapes ampersands in the urls so the attributes stay valid', () => {
    const html = renderReservationConfirmationHtml({ ...baseInput, locale: 'fr' });

    expect(html).toContain('&amp;dates=');
    expect(html).toContain('&amp;token=');
  });

  it('escapes client supplied values instead of injecting them raw', () => {
    const html = renderReservationConfirmationHtml({
      ...baseInput,
      locale: 'fr',
      clientName: '<script>alert(1)</script>',
      barberName: 'Karim & "Co"',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Karim &amp; &quot;Co&quot;');
  });

  it('still renders a usable email when no cancellation link can be built', () => {
    delete process.env.PUBLIC_API_URL;

    const html = renderReservationConfirmationHtml({ ...baseInput, locale: 'fr' });
    const text = renderReservationConfirmationText({ ...baseInput, locale: 'fr' });

    expect(hrefs(html)).toHaveLength(1);
    expect(html).toContain('Ajouter à Google Agenda');
    expect(html).not.toContain('Annuler ma réservation');
    expect(text).not.toContain('Annuler ma réservation');
    expect(html).not.toContain('null');
  });

  it('passes the shop address to the calendar link when configured', () => {
    const calendarUrl = new URL(hrefs(renderReservationConfirmationHtml({ ...baseInput, locale: 'en' }))[0]);

    expect(calendarUrl.searchParams.get('location')).toBe('123 Rue Sainte-Catherine, Montréal, QC');
    expect(calendarUrl.searchParams.get('text')).toBe('Coupe & barbe — Trimium');
    expect(calendarUrl.searchParams.get('details')).toContain('Barber: Karim');
  });
});
