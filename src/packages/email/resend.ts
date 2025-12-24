import { Resend } from 'resend';
import { logger } from '../common/logger';

import {
  type ReservationConfirmationEmailInput,
  renderReservationConfirmationHtml,
  renderReservationConfirmationSubject,
  renderReservationConfirmationText,
} from './templates/reservationConfirmation';

type SendReservationConfirmationResult =
  | { ok: true; id?: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: unknown };

const getResendConfig = () => {
  const enabled = (process.env.RESEND_ENABLED ?? 'true').toLowerCase() !== 'false';
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const replyTo = process.env.RESEND_REPLY_TO;
  const bcc = process.env.RESEND_BCC;

  return { enabled, apiKey, from, replyTo, bcc };
};

export async function sendReservationConfirmationEmail(
  input: ReservationConfirmationEmailInput
): Promise<SendReservationConfirmationResult> {
  const { enabled, apiKey, from, replyTo, bcc } = getResendConfig();

  if (!enabled) {
    return { ok: false, skipped: true, reason: 'RESEND_ENABLED=false' };
  }

  if (!apiKey) {
    return { ok: false, skipped: true, reason: 'RESEND_API_KEY is not set' };
  }

  if (!from) {
    return { ok: false, skipped: true, reason: 'RESEND_FROM is not set' };
  }

  try {
    const resend = new Resend(apiKey);
    const subject = renderReservationConfirmationSubject(input);

    const { data, error } = await resend.emails.send({
      from,
      to: input.clientEmail,
      subject,
      html: renderReservationConfirmationHtml(input),
      text: renderReservationConfirmationText(input),
      replyTo: replyTo || undefined,
      bcc: bcc ? bcc.split(',').map(v => v.trim()).filter(Boolean) : undefined,
      tags: [{ name: 'type', value: 'reservation_confirmation' }],
    });

    if (error) {
      logger.error(error);
      return { ok: false, skipped: false, error };
    }

    return { ok: true, id: (data as any)?.id };
  } catch (error) {
    logger.error(error as any);
    return { ok: false, skipped: false, error };
  }
}


