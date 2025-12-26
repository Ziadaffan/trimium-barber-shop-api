import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import { CANADA_TIMEZONE } from '../../common/utils/reservation-time.utils';

export interface ReservationConfirmationEmailInput {
  reservationId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  barberName: string;
  serviceName: string;
  startAtUtc: Date;
  endAtUtc: Date;
}

export function renderReservationConfirmationSubject(input: ReservationConfirmationEmailInput): string {
  const startLocal = toZonedTime(input.startAtUtc, CANADA_TIMEZONE);
  const day = format(startLocal, 'PPP');
  const time = format(startLocal, 'HH:mm');
  return `Reservation confirmed • ${input.serviceName} • ${day} ${time}`;
}

export function renderReservationConfirmationText(input: ReservationConfirmationEmailInput): string {
  const startLocal = toZonedTime(input.startAtUtc, CANADA_TIMEZONE);
  const endLocal = toZonedTime(input.endAtUtc, CANADA_TIMEZONE);

  const day = format(startLocal, 'PPP');
  const startTime = format(startLocal, 'HH:mm');
  const endTime = format(endLocal, 'HH:mm');

  return [
    `Hi ${input.clientName},`,
    '',
    'Votre réservation est confirmée.',
    '',
    `Service: ${input.serviceName}`,
    `Barbier: ${input.barberName}`,
    `Quand: ${day} ${startTime}–${endTime} (${CANADA_TIMEZONE})`,
    input.clientPhone ? `Téléphone: ${input.clientPhone}` : undefined,
    '',
    'À bientôt!',
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderReservationConfirmationHtml(input: ReservationConfirmationEmailInput): string {
  const startLocal = toZonedTime(input.startAtUtc, CANADA_TIMEZONE);
  const endLocal = toZonedTime(input.endAtUtc, CANADA_TIMEZONE);

  const day = format(startLocal, 'PPP');
  const startTime = format(startLocal, 'HH:mm');
  const endTime = format(endLocal, 'HH:mm');

  const safe = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Réservation confirmée</title>
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
                      <div style="font-size:16px;font-weight:700;">Réservation confirmée</div>
                    </td>
                  </tr>
                </table>
                <div style="font-size:13px;opacity:0.85;margin-top:4px;">${safe(input.serviceName)} • ${safe(day)} ${safe(
                  startTime
                )}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px;color:#0b1220;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.45;">Hi ${safe(
                  input.clientName
                )}, votre réservation est confirmée.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:14px;">
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #eef2f6;">
                      <span style="color:#64748b;font-size:12px;">Service</span><br />
                      <span style="font-size:14px;font-weight:600;">${safe(input.serviceName)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #eef2f6;">
                      <span style="color:#64748b;font-size:12px;">Barbier</span><br />
                      <span style="font-size:14px;font-weight:600;">${safe(input.barberName)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;">
                      <span style="color:#64748b;font-size:12px;">Quand</span><br />
                      <span style="font-size:14px;font-weight:600;">${safe(day)} ${safe(startTime)}–${safe(
                        endTime
                      )} (${safe(CANADA_TIMEZONE)})</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0 0;font-size:12px;color:#64748b;line-height:1.5;">
                  Si vous n'avez pas fait cette réservation, vous pouvez ignorer cet email.
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
