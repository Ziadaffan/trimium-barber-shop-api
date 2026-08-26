import { DEFAULT_LOCALE, type Locale, formatReservationDay, formatReservationTime } from '../../common/i18n/locale';
import { getReservationStrings } from '../../common/i18n/reservation.strings';
import { CANADA_TIMEZONE } from '../../common/utils/reservation-time.utils';
import { buildGoogleCalendarEventUrl } from '../../common/utils/google-calendar-link.utils';
import {
  CANCELLATION_CUTOFF_HOURS,
  buildReservationCancelUrl,
  getCancellationDeadline,
} from '../../common/utils/reservation-cancel.utils';
import { escapeHtml } from '../../common/utils/html.utils';

export interface ReservationConfirmationEmailInput {
  reservationId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  barberName?: string;
  serviceName?: string;
  startAtUtc: Date;
  endAtUtc: Date;
  locale?: Locale;
  /** Fallback base URL for the cancellation link when PUBLIC_API_URL is not configured. */
  requestOrigin?: string;
}

const SHOP_NAME = process.env.SHOP_NAME || 'Trimium';

interface ReservationView {
  locale: Locale;
  strings: ReturnType<typeof getReservationStrings>;
  day: string;
  startTime: string;
  endTime: string;
  deadlineTime: string;
  serviceName: string;
  barberName: string;
  googleCalendarUrl: string;
  cancelUrl: string | null;
}

const buildView = (input: ReservationConfirmationEmailInput): ReservationView => {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const strings = getReservationStrings(locale);
  const serviceName = input.serviceName ?? '';
  const barberName = input.barberName ?? '';

  const day = formatReservationDay(input.startAtUtc, locale);
  const startTime = formatReservationTime(input.startAtUtc, locale);
  const endTime = formatReservationTime(input.endAtUtc, locale);
  const deadlineTime = formatReservationTime(getCancellationDeadline(input.startAtUtc), locale);

  const details = [
    `${strings.email.labelService}: ${serviceName}`,
    barberName ? `${strings.email.labelBarber}: ${barberName}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  const googleCalendarUrl = buildGoogleCalendarEventUrl({
    title: serviceName ? `${serviceName} — ${SHOP_NAME}` : SHOP_NAME,
    startAtUtc: input.startAtUtc,
    endAtUtc: input.endAtUtc,
    details,
    location: process.env.SHOP_ADDRESS || undefined,
  });

  const cancelUrl = buildReservationCancelUrl({
    reservationId: input.reservationId,
    startAtUtc: input.startAtUtc,
    locale,
    requestOrigin: input.requestOrigin,
  });

  return {
    locale,
    strings,
    day,
    startTime,
    endTime,
    deadlineTime,
    serviceName,
    barberName,
    googleCalendarUrl,
    cancelUrl,
  };
};

export function renderReservationConfirmationSubject(input: ReservationConfirmationEmailInput): string {
  const { strings, serviceName, day, startTime } = buildView(input);
  return strings.email.subject({ serviceName, day, time: startTime });
}

export function renderReservationConfirmationText(input: ReservationConfirmationEmailInput): string {
  const { strings, day, startTime, endTime, deadlineTime, serviceName, barberName, googleCalendarUrl, cancelUrl } =
    buildView(input);

  return [
    strings.email.greeting(input.clientName),
    '',
    strings.email.intro,
    '',
    `${strings.email.labelService}: ${serviceName}`,
    barberName ? `${strings.email.labelBarber}: ${barberName}` : undefined,
    `${strings.email.labelWhen}: ${day} ${startTime}–${endTime} (${CANADA_TIMEZONE})`,
    input.clientPhone ? `${strings.email.labelPhone}: ${input.clientPhone}` : undefined,
    '',
    `${strings.email.addToGoogleCalendar}: ${googleCalendarUrl}`,
    cancelUrl ? `${strings.email.cancelCta}: ${cancelUrl}` : undefined,
    cancelUrl ? strings.email.cancelPolicy({ hours: CANCELLATION_CUTOFF_HOURS, deadlineTime }) : undefined,
    '',
    strings.email.signature,
  ]
    .filter(line => line !== undefined)
    .join('\n');
}

export function renderReservationConfirmationHtml(input: ReservationConfirmationEmailInput): string {
  const { strings, day, startTime, endTime, deadlineTime, serviceName, barberName, googleCalendarUrl, cancelUrl } =
    buildView(input);

  const row = (label: string, value: string, isLast = false) => `
                  <tr>
                    <td style="padding:10px 0;${isLast ? '' : 'border-bottom:1px solid #eef2f6;'}">
                      <span style="color:#64748b;font-size:12px;">${escapeHtml(label)}</span><br />
                      <span style="font-size:14px;font-weight:600;">${value}</span>
                    </td>
                  </tr>`;

  const detailRows = [
    row(strings.email.labelService, escapeHtml(serviceName)),
    barberName ? row(strings.email.labelBarber, escapeHtml(barberName)) : '',
    row(
      strings.email.labelWhen,
      `${escapeHtml(day)} ${escapeHtml(startTime)}–${escapeHtml(endTime)} (${escapeHtml(CANADA_TIMEZONE)})`,
      !input.clientPhone
    ),
    input.clientPhone ? row(strings.email.labelPhone, escapeHtml(input.clientPhone), true) : '',
  ].join('');

  const cancelButton = cancelUrl
    ? `
                  <tr>
                    <td style="padding:10px 0 0 0;">
                      <a href="${escapeHtml(cancelUrl)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#ffffff;border:1px solid #e11d48;color:#e11d48;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(
                        strings.email.cancelCta
                      )}</a>
                    </td>
                  </tr>`
    : '';

  const cancelPolicy = cancelUrl
    ? `
                <p style="margin:14px 0 0 0;font-size:12px;color:#64748b;line-height:1.5;">
                  ${escapeHtml(strings.email.cancelPolicy({ hours: CANCELLATION_CUTOFF_HOURS, deadlineTime }))}
                </p>`
    : '';

  return `<!doctype html>
<html lang="${strings.htmlLang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(strings.email.title)}</title>
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
                      <img src="https://res.cloudinary.com/djhjhwelu/image/upload/v1766767146/logo_qppald.png" alt="${escapeHtml(
                        SHOP_NAME
                      )}" style="height:40px;width:auto;display:block;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:16px;font-weight:700;">${escapeHtml(strings.email.title)}</div>
                    </td>
                  </tr>
                </table>
                <div style="font-size:13px;opacity:0.85;margin-top:4px;">${escapeHtml(serviceName)} • ${escapeHtml(
                  day
                )} ${escapeHtml(startTime)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px;color:#0b1220;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.45;">${escapeHtml(
                  strings.email.greeting(input.clientName)
                )} ${escapeHtml(strings.email.intro)}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:14px;">${detailRows}
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:22px;">
                  <tr>
                    <td style="padding:0;">
                      <a href="${escapeHtml(
                        googleCalendarUrl
                      )}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#0b1220;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(
                        strings.email.addToGoogleCalendar
                      )}</a>
                    </td>
                  </tr>${cancelButton}
                </table>${cancelPolicy}
                <p style="margin:18px 0 0 0;font-size:12px;color:#64748b;line-height:1.5;">
                  ${escapeHtml(strings.email.ignoreNote)}
                </p>
                <p style="margin:14px 0 0 0;font-size:14px;color:#0b1220;">${escapeHtml(strings.email.signature)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
