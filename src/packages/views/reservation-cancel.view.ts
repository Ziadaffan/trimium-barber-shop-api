import { type Locale, formatReservationDay, formatReservationTime } from '../common/i18n/locale';
import { getReservationStrings } from '../common/i18n/reservation.strings';
import { CANADA_TIMEZONE } from '../common/utils/reservation-time.utils';
import { escapeHtml } from '../common/utils/html.utils';

const SHOP_NAME = process.env.SHOP_NAME || 'Trimium';

export const CANCEL_RESERVATION_PATH = '/api/reservations/cancel';

interface LayoutInput {
  locale: Locale;
  title: string;
  heading: string;
  accent: string;
  body: string;
}

const layout = ({ locale, title, heading, accent, body }: LayoutInput): string => `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px 16px;
        background: #f6f7f9;
        color: #0b1220;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif;
      }
      .card {
        width: 100%;
        max-width: 480px;
        background: #ffffff;
        border: 1px solid #e9edf2;
        border-radius: 12px;
        overflow: hidden;
      }
      .card__header { padding: 20px 22px; background: #0b1220; color: #ffffff; }
      .card__brand { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; }
      .card__title { margin: 6px 0 0; font-size: 18px; font-weight: 700; }
      .card__body { padding: 22px; }
      p { margin: 0 0 12px; font-size: 14px; line-height: 1.5; }
      p:last-child { margin-bottom: 0; }
      .muted { color: #64748b; font-size: 12px; }
      dl { margin: 0 0 20px; }
      .detail { padding: 10px 0; border-bottom: 1px solid #eef2f6; }
      .detail:last-child { border-bottom: 0; }
      .detail dt { color: #64748b; font-size: 12px; }
      .detail dd { margin: 2px 0 0; font-size: 14px; font-weight: 600; }
      button {
        width: 100%;
        padding: 13px 18px;
        border: 0;
        border-radius: 8px;
        background: ${accent};
        color: #ffffff;
        font-size: 14px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
      }
      button:disabled { opacity: 0.6; cursor: default; }
      @media (prefers-color-scheme: dark) {
        body { background: #0b1220; color: #e6e9ef; }
        .card { background: #111a2b; border-color: #1e2a41; }
        .card__header { background: #0b1220; }
        .detail { border-color: #1e2a41; }
        .detail dt, .muted { color: #94a3b8; }
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="card__header">
        <div class="card__brand">${escapeHtml(SHOP_NAME)}</div>
        <h1 class="card__title">${escapeHtml(heading)}</h1>
      </div>
      <div class="card__body">${body}</div>
    </main>
  </body>
</html>`;

export interface CancelReservationSummary {
  serviceName: string;
  barberName: string;
  startAtUtc: Date;
  endAtUtc: Date;
}

/**
 * Confirmation step. The cancellation itself happens on POST so that email clients
 * pre-fetching the link cannot cancel an appointment on the client's behalf.
 */
export const renderCancelReservationConfirmPage = ({
  locale,
  reservationId,
  token,
  summary,
}: {
  locale: Locale;
  reservationId: string;
  token: string;
  summary: CancelReservationSummary;
}): string => {
  const strings = getReservationStrings(locale).cancelPage;

  const detail = (label: string, value: string) => `
          <div class="detail">
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value)}</dd>
          </div>`;

  const when = `${formatReservationDay(summary.startAtUtc, locale)} ${formatReservationTime(
    summary.startAtUtc,
    locale
  )}–${formatReservationTime(summary.endAtUtc, locale)} (${CANADA_TIMEZONE})`;

  const body = `
        <p>${escapeHtml(strings.question)}</p>
        <dl>${summary.serviceName ? detail(strings.labelService, summary.serviceName) : ''}${
          summary.barberName ? detail(strings.labelBarber, summary.barberName) : ''
        }${detail(strings.labelWhen, when)}
        </dl>
        <form method="post" action="${CANCEL_RESERVATION_PATH}">
          <input type="hidden" name="rid" value="${escapeHtml(reservationId)}" />
          <input type="hidden" name="token" value="${escapeHtml(token)}" />
          <input type="hidden" name="locale" value="${escapeHtml(locale)}" />
          <button type="submit">${escapeHtml(strings.confirmCta)}</button>
        </form>
        <p class="muted" style="margin-top:14px;">${escapeHtml(strings.keepNote)}</p>`;

  return layout({ locale, title: strings.title, heading: strings.heading, accent: '#e11d48', body });
};

export const renderCancelReservationSuccessPage = (locale: Locale): string => {
  const strings = getReservationStrings(locale).cancelPage;

  const body = `
        <p>${escapeHtml(strings.successMessage)}</p>
        <p class="muted">${escapeHtml(strings.rebookNote)}</p>`;

  return layout({
    locale,
    title: strings.successTitle,
    heading: strings.successHeading,
    accent: '#0b1220',
    body,
  });
};

export const renderCancelReservationErrorPage = ({ locale, message }: { locale: Locale; message: string }): string => {
  const strings = getReservationStrings(locale).cancelPage;
  const shopPhone = process.env.SHOP_PHONE;

  const body = `
        <p>${escapeHtml(message)}</p>${
          shopPhone ? `\n        <p class="muted">${escapeHtml(strings.callShop(shopPhone))}</p>` : ''
        }`;

  return layout({ locale, title: strings.errorTitle, heading: strings.errorTitle, accent: '#0b1220', body });
};
