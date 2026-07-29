import { format } from 'date-fns';
import { enCA, frCA } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

import { CANADA_TIMEZONE } from '../../common/utils/reservation-time.utils';

export type EmailLanguage = 'en' | 'fr';

export interface ReservationConfirmationEmailInput {
  reservationId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  barberName?: string;
  serviceName?: string;
  startAtUtc: Date;
  endAtUtc: Date;
  language?: EmailLanguage;
}

interface Copy {
  htmlLang: string;
  title: string;
  subject: (service: string, day: string, time: string) => string;
  greeting: (name: string) => string;
  intro: string;
  introHtml: (name: string) => string;
  service: string;
  barber: string;
  when: string;
  phone: string;
  outro: string;
  disclaimer: string;
}

const COPY: Record<EmailLanguage, Copy> = {
  fr: {
    htmlLang: 'fr',
    title: 'Réservation confirmée',
    subject: (service, day, time) => `Réservation confirmée • ${service} • ${day} ${time}`,
    greeting: name => `Bonjour ${name},`,
    intro: 'Votre réservation est confirmée.',
    introHtml: name => `Bonjour ${name}, votre réservation est confirmée.`,
    service: 'Service',
    barber: 'Barbier',
    when: 'Quand',
    phone: 'Téléphone',
    outro: 'À bientôt!',
    disclaimer: "Si vous n'avez pas fait cette réservation, vous pouvez ignorer cet email.",
  },
  en: {
    htmlLang: 'en',
    title: 'Reservation confirmed',
    subject: (service, day, time) => `Reservation confirmed • ${service} • ${day} ${time}`,
    greeting: name => `Hi ${name},`,
    intro: 'Your reservation is confirmed.',
    introHtml: name => `Hi ${name}, your reservation is confirmed.`,
    service: 'Service',
    barber: 'Barber',
    when: 'When',
    phone: 'Phone',
    outro: 'See you soon!',
    disclaimer: "If you didn't make this reservation, you can ignore this email.",
  },
};

const getCopy = (language?: EmailLanguage): Copy => COPY[language === 'en' ? 'en' : 'fr'];

const formatParts = (input: ReservationConfirmationEmailInput) => {
  const locale = input.language === 'en' ? enCA : frCA;
  const startLocal = toZonedTime(input.startAtUtc, CANADA_TIMEZONE);
  const endLocal = toZonedTime(input.endAtUtc, CANADA_TIMEZONE);

  return {
    day: format(startLocal, 'PPP', { locale }),
    startTime: format(startLocal, 'HH:mm'),
    endTime: format(endLocal, 'HH:mm'),
  };
};

export function renderReservationConfirmationSubject(input: ReservationConfirmationEmailInput): string {
  const copy = getCopy(input.language);
  const { day, startTime } = formatParts(input);
  return copy.subject(input.serviceName || '', day, startTime);
}

export function renderReservationConfirmationText(input: ReservationConfirmationEmailInput): string {
  const copy = getCopy(input.language);
  const { day, startTime, endTime } = formatParts(input);

  return [
    copy.greeting(input.clientName),
    '',
    copy.intro,
    '',
    `${copy.service}: ${input.serviceName}`,
    `${copy.barber}: ${input.barberName}`,
    `${copy.when}: ${day} ${startTime}–${endTime} (${CANADA_TIMEZONE})`,
    input.clientPhone ? `${copy.phone}: ${input.clientPhone}` : undefined,
    '',
    copy.outro,
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderReservationConfirmationHtml(input: ReservationConfirmationEmailInput): string {
  const copy = getCopy(input.language);
  const { day, startTime, endTime } = formatParts(input);

  const safe = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  return `<!doctype html>
<html lang="${copy.htmlLang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${copy.title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e9edf2;">
            <tr>
              <td style="padding:20px 22px;background:#0b1220;color:#ffffff;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:8px;">
                  <tr>
                    <td style="padding-right:12px;vertical-align:middle;">
                      <img src="https://res.cloudinary.com/djhjhwelu/image/upload/v1766767146/logo_qppald.png" alt="Trimium Logo" style="height:40px;width:auto;display:block;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:16px;font-weight:700;">${copy.title}</div>
                    </td>
                  </tr>
                </table>
                <div style="font-size:13px;opacity:0.85;margin-top:4px;">${safe(input.serviceName || '')} • ${safe(day)} ${safe(
                  startTime
                )}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px;color:#0b1220;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.45;">${copy.introHtml(safe(input.clientName))}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:14px;">
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #eef2f6;">
                      <span style="color:#64748b;font-size:12px;">${copy.service}</span><br />
                      <span style="font-size:14px;font-weight:600;">${safe(input.serviceName || '')}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #eef2f6;">
                      <span style="color:#64748b;font-size:12px;">${copy.barber}</span><br />
                      <span style="font-size:14px;font-weight:600;">${safe(input.barberName || '')}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;">
                      <span style="color:#64748b;font-size:12px;">${copy.when}</span><br />
                      <span style="font-size:14px;font-weight:600;">${safe(day)} ${safe(startTime)}–${safe(
                        endTime
                      )} (${safe(CANADA_TIMEZONE)})</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0 0;font-size:12px;color:#64748b;line-height:1.5;">
                  ${copy.disclaimer}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
