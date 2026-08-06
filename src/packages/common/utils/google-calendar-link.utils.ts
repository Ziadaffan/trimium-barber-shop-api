interface GoogleCalendarEventUrlInput {
  title: string;
  startAtUtc: Date;
  endAtUtc: Date;
  details?: string;
  location?: string;
}

/** Google expects basic-format UTC stamps: 20260804T183000Z */
const toGoogleUtcStamp = (date: Date): string =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/**
 * Builds a "add to calendar" link that opens Google Calendar with the event prefilled.
 * Works for any client on any device — nothing is written to our own calendars.
 */
export const buildGoogleCalendarEventUrl = ({
  title,
  startAtUtc,
  endAtUtc,
  details,
  location,
}: GoogleCalendarEventUrlInput): string => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toGoogleUtcStamp(startAtUtc)}/${toGoogleUtcStamp(endAtUtc)}`,
  });

  if (details) params.set('details', details);
  if (location) params.set('location', location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
