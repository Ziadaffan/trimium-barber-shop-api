import { NextFunction, Request, Response } from 'express';
import prisma from '../../packages/lib/db';
import { ReservationStatus } from '@prisma/client';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { throwError } from '../../packages/common/utils/error.handler.utils';
import {
  type ReservationEventDetails,
  addReservationToGoogleCalendar,
  createReservationCalendarEvent,
  deleteReservationFromGoogleCalendar,
  updateReservationInGoogleCalendar,
} from '../../packages/google/oAuth2Client';
import { logger } from '../../packages/common/logger';
import { sendReservationConfirmationEmail } from '../../packages/email/resend';
import { CANADA_TIMEZONE, parseTimeToMinutes } from '../../packages/common/utils/reservation-time.utils';
import {
  computeAvailableSlots,
  earliestBookableMinute,
  wallClockMinutesFrom,
} from '../../packages/common/utils/availability.utils';
import { isValidReservationStatus, parseReservationStartEnd } from '../../packages/common/utils/reservation.utils';
import { hiddenTestBarberFilter } from '../../packages/common/utils/test-barber.utils';
import { type Locale, resolveLocale } from '../../packages/common/i18n/locale';
import { getReservationStrings } from '../../packages/common/i18n/reservation.strings';
import {
  CANCELLATION_CUTOFF_MINUTES,
  canCancelReservation,
  verifyReservationCancelToken,
} from '../../packages/common/utils/reservation-cancel.utils';
import {
  renderCancelReservationConfirmPage,
  renderCancelReservationErrorPage,
  renderCancelReservationSuccessPage,
} from '../../packages/views/reservation-cancel.view';

/** Last-resort base URL for the email links when PUBLIC_API_URL / VERCEL_URL are not set. */
const getRequestOrigin = (req: Request): string | undefined => {
  const host = req.get('host');
  if (!host) return undefined;

  const proto = (req.get('x-forwarded-proto') || '').split(',')[0].trim() || req.protocol;
  return `${proto}://${host}`;
};

export const getAvailableTimes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, barberId, serviceId } = req.query as { date: string; barberId: string; serviceId: string };

    if (!date || !barberId || !serviceId) {
      throwError('Date, barberId, and serviceId are required', 400);
      return;
    }

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      throwError('Barber not found', 404);
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throwError('Service not found', 404);
      return;
    }

    const serviceDuration = service.duration;

    const [yearStr, monthStr, dayStr] = date.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    const startOfDayLocal = new Date(year, month, day, 0, 0, 0, 0);
    const endOfDayLocal = new Date(year, month, day, 23, 59, 59, 999);

    const startOfDayUTC = fromZonedTime(startOfDayLocal, CANADA_TIMEZONE);
    const endOfDayUTC = fromZonedTime(endOfDayLocal, CANADA_TIMEZONE);

    const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
      startOfDayLocal.getDay()
    ];

    const barberSchedules = await prisma.barberSchedule.findMany({
      where: {
        barberId,
        dayOfWeek: dayOfWeek as any,
        isActive: true,
      },
    });

    if (!barberSchedules || barberSchedules.length === 0) {
      res.status(200).json({
        message: 'No available times',
        availableTimes: [],
        totalSlots: 0,
        bookedSlots: 0,
        barberSchedule: null,
      });
      return;
    }

    const workingRanges = barberSchedules.map(schedule => ({
      startMinutes: parseTimeToMinutes(schedule.startTime),
      endMinutes: parseTimeToMinutes(schedule.endTime),
    }));

    // A reservation or time off starting the previous day can still run into this one, so the
    // window is widened by a day on the left and clamped back to the day below.
    const previousDayUTC = new Date(startOfDayUTC.getTime() - 24 * 60 * 60_000);

    const existingReservations = await prisma.reservation.findMany({
      where: {
        barberId,
        date: {
          gte: previousDayUTC,
          lte: endOfDayUTC,
        },
        status: {
          not: 'CANCELLED',
        },
      },
      include: {
        service: true,
      },
    });

    const timeOffs = await prisma.barberTimeOff.findMany({
      where: {
        barberId,
        isActive: true,
        startAt: { lte: endOfDayUTC },
        endAt: { gte: startOfDayUTC },
      },
    });

    // Working hours are wall clock ("09:00"), so busy intervals are converted to wall clock
    // minutes too. Measuring elapsed UTC minutes instead would shift everything by an hour on
    // the two daylight saving change days.
    const toWallClockMinutes = (utc: Date) => wallClockMinutesFrom(startOfDayLocal, toZonedTime(utc, CANADA_TIMEZONE));

    const toMinuteRange = (startUtc: Date, endUtc: Date) => ({
      startMinutes: toWallClockMinutes(startUtc),
      endMinutes: toWallClockMinutes(endUtc),
    });

    const busyRanges = [
      ...existingReservations.map(reservation =>
        toMinuteRange(
          reservation.date,
          reservation.endDate ?? new Date(reservation.date.getTime() + reservation.service.duration * 60_000)
        )
      ),
      ...timeOffs.map(timeOff => toMinuteRange(timeOff.startAt, timeOff.endAt)),
    ];

    const availableTimes = computeAvailableSlots({
      workingRanges,
      busyRanges,
      serviceDurationMinutes: serviceDuration,
      // Never offer a slot that has already passed, so the list agrees with what
      // createReservation will accept.
      minStartMinutes: earliestBookableMinute(startOfDayLocal, toZonedTime(new Date(), CANADA_TIMEZONE)),
    });

    res.status(200).json(availableTimes);
  } catch (error) {
    next(error);
  }
};

export const getReservations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservations = await prisma.reservation.findMany({
      where: { barber: hiddenTestBarberFilter() },
      include: {
        barber: true,
        service: true,
      },
      orderBy: {
        date: 'asc',
      },
    });
    res.status(200).json(reservations);
  } catch (error) {
    next(error);
  }
};

/**
 * Overlap detection done by the database on the stored interval, so a reservation starting the
 * previous day but running into this one is still found.
 */
const findOverlappingReservation = (barberId: string, utcStart: Date, utcEnd: Date, excludeId?: string) =>
  prisma.reservation.findFirst({
    where: {
      barberId,
      status: { not: ReservationStatus.CANCELLED },
      date: { lt: utcEnd },
      endDate: { gt: utcStart },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

export const createReservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId, date, time, endDate, clientName, clientPhone, clientEmail, serviceId, status, language } =
      req.body;

    if (!barberId || !date || !clientName || !clientPhone || !clientEmail || !serviceId) {
      throwError('All fields are required', 400);
      return;
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      throwError('Service not found', 404);
      return;
    }

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });
    if (!barber) {
      throwError('Barber not found', 404);
      return;
    }

    const { utcStart, utcEnd } = parseReservationStartEnd({
      date,
      time,
      endDate,
      serviceDurationMinutes: service.duration,
    });

    if (!utcStart || !utcEnd) {
      throwError('Invalid date/time/endDate format', 400);
      return;
    }

    if (utcStart.getTime() < Date.now()) {
      throwError('Cannot book a reservation in the past', 400);
      return;
    }

    const localStart = toZonedTime(utcStart, CANADA_TIMEZONE);
    const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
      localStart.getDay()
    ];

    const schedules = await prisma.barberSchedule.findMany({
      where: { barberId, dayOfWeek: dayOfWeek as any, isActive: true },
    });

    const localStartMinutes = localStart.getHours() * 60 + localStart.getMinutes();
    const localEnd = toZonedTime(utcEnd, CANADA_TIMEZONE);
    const localEndMinutes = localEnd.getHours() * 60 + localEnd.getMinutes();

    const fitsSomeSchedule = schedules.some(s => {
      const sStart = parseTimeToMinutes(s.startTime);
      const sEnd = parseTimeToMinutes(s.endTime);
      return localStartMinutes >= sStart && localEndMinutes <= sEnd;
    });

    if (!fitsSomeSchedule) {
      throwError('Selected time is outside barber schedule', 400);
      return;
    }

    const overlappingTimeOff = await prisma.barberTimeOff.findFirst({
      where: {
        barberId,
        isActive: true,
        startAt: { lt: utcEnd },
        endAt: { gt: utcStart },
      },
    });

    if (overlappingTimeOff) {
      throwError('Barber is not available (time off)', 400);
      return;
    }

    if (await findOverlappingReservation(barberId, utcStart, utcEnd)) {
      throwError('Selected time overlaps an existing reservation', 400);
      return;
    }

    const data = {
      barberId,
      date: utcStart,
      endDate: utcEnd,
      status: isValidReservationStatus(status) ? (status as ReservationStatus) : ReservationStatus.PENDING,
      clientName,
      clientPhone,
      clientEmail,
      serviceId: service.id,
    };

    const reservation = await prisma.reservation.create({
      data,
    });

    if (!reservation) {
      throwError('Failed to create reservation', 400);
      return;
    }

    // Best effort: the booking is already committed, so a calendar outage is logged and the
    // client still gets a confirmation instead of an error on a reservation that exists.
    const googleEvent = await addReservationToGoogleCalendar({
      barberId,
      clientName,
      clientPhone,
      clientEmail,
      service: service,
      date: utcStart,
      endDate: utcEnd,
    });

    if (googleEvent?.id) {
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { googleEventId: googleEvent.id },
      });
    }

    // `language` is what the booking form sends; `locale` is accepted too, then the query
    // string and finally the Accept-Language header. Falls back to French.
    const locale = resolveLocale(req.body?.locale, language, req.query?.locale, req.get('accept-language'));

    await sendReservationConfirmationEmail({
      requestOrigin: getRequestOrigin(req),
      reservationId: reservation.id,
      clientName,
      clientEmail,
      clientPhone,
      barberName: barber.name,
      serviceName: locale === 'fr' ? service.nameFr : service.nameEn,
      startAtUtc: reservation.date,
      endAtUtc: reservation.endDate,
      locale,
    });

    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
};

/**
 * Keeps the barber calendar in step with an edited reservation and returns the event id to
 * store. Handles the four cases: cancelled (drop the event), moved to another barber (recreate
 * on the new calendar), same calendar (patch in place), and no event yet (create one).
 */
const syncReservationCalendarEvent = async ({
  previousCalendarId,
  previousEventId,
  nextCalendarId,
  status,
  details,
}: {
  previousCalendarId: string | null;
  previousEventId: string | null;
  nextCalendarId: string | null;
  status: ReservationStatus;
  details: ReservationEventDetails;
}): Promise<string | null> => {
  const hasExistingEvent = Boolean(previousCalendarId && previousEventId);

  if (status === ReservationStatus.CANCELLED) {
    if (hasExistingEvent) {
      await deleteReservationFromGoogleCalendar(previousCalendarId as string, previousEventId as string);
    }
    return null;
  }

  if (!nextCalendarId) {
    if (hasExistingEvent) {
      await deleteReservationFromGoogleCalendar(previousCalendarId as string, previousEventId as string);
    }
    return null;
  }

  if (hasExistingEvent && previousCalendarId === nextCalendarId) {
    const patched = await updateReservationInGoogleCalendar(nextCalendarId, previousEventId as string, details);
    if (patched) return previousEventId;

    // The event is gone or unreachable: fall through and recreate it.
  }

  if (hasExistingEvent && previousCalendarId !== nextCalendarId) {
    await deleteReservationFromGoogleCalendar(previousCalendarId as string, previousEventId as string);
  }

  return createReservationCalendarEvent(nextCalendarId, details);
};

export const updateReservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { barberId, date, time, endDate, clientName, clientPhone, clientEmail, serviceId, status } = req.body;

    if (!barberId || !date || !clientName || !clientPhone || !clientEmail || !serviceId || !status) {
      throwError('All fields are required', 400);
      return;
    }

    if (!isValidReservationStatus(status)) {
      throwError('Invalid reservation status', 400);
      return;
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) {
      throwError('Service not found', 404);
      return;
    }

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });
    if (!barber) {
      throwError('Barber not found', 404);
      return;
    }

    const { utcStart, utcEnd } = parseReservationStartEnd({
      date,
      time,
      endDate,
      serviceDurationMinutes: service.duration,
    });

    if (!utcStart || !utcEnd) {
      throwError('Invalid date/time/endDate format', 400);
      return;
    }

    // Validate requested interval is inside weekly schedule
    const localStart = toZonedTime(utcStart, CANADA_TIMEZONE);
    const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
      localStart.getDay()
    ];

    const schedules = await prisma.barberSchedule.findMany({
      where: { barberId, dayOfWeek: dayOfWeek as any, isActive: true },
    });

    const localStartMinutes = localStart.getHours() * 60 + localStart.getMinutes();
    const localEnd = toZonedTime(utcEnd, CANADA_TIMEZONE);
    const localEndMinutes = localEnd.getHours() * 60 + localEnd.getMinutes();

    const fitsSomeSchedule = schedules.some(s => {
      const sStart = parseTimeToMinutes(s.startTime);
      const sEnd = parseTimeToMinutes(s.endTime);
      return localStartMinutes >= sStart && localEndMinutes <= sEnd;
    });

    if (!fitsSomeSchedule) {
      throwError('Selected time is outside barber schedule', 400);
      return;
    }

    // Reject if barber is in vacation/time-off
    const overlappingTimeOff = await prisma.barberTimeOff.findFirst({
      where: {
        barberId,
        isActive: true,
        startAt: { lt: utcEnd },
        endAt: { gt: utcStart },
      },
    });

    if (overlappingTimeOff) {
      throwError('Barber is not available (time off)', 400);
      return;
    }

    if (await findOverlappingReservation(barberId, utcStart, utcEnd, id)) {
      throwError('Selected time overlaps an existing reservation', 400);
      return;
    }

    const previous = await prisma.reservation.findUnique({
      where: { id },
      include: { barber: true },
    });

    if (!previous) {
      throwError('Reservation not found', 404);
      return;
    }

    const data = {
      barberId,
      date: utcStart,
      endDate: utcEnd,
      status: status as ReservationStatus,
      clientName,
      clientPhone,
      clientEmail,
      serviceId: service.id,
    };

    const reservation = await prisma.reservation.update({
      where: { id },
      data,
    });

    if (!reservation) {
      throwError('Failed to update reservation', 400);
      return;
    }

    const googleEventId = await syncReservationCalendarEvent({
      previousCalendarId: previous.barber.googleCalendarId,
      previousEventId: previous.googleEventId,
      nextCalendarId: barber.googleCalendarId,
      status: reservation.status,
      details: {
        clientName,
        clientPhone,
        clientEmail,
        serviceName: service.nameEn,
        startAt: utcStart,
        endAt: utcEnd,
      },
    });

    if (googleEventId !== previous.googleEventId) {
      await prisma.reservation.update({
        where: { id },
        data: { googleEventId },
      });
    }

    res.status(200).json({ ...reservation, googleEventId });
  } catch (error) {
    next(error);
  }
};

const findReservationForCancellation = (id: string) =>
  prisma.reservation.findUnique({
    where: { id },
    include: { service: true, barber: true },
  });

type ReservationForCancellation = NonNullable<Awaited<ReturnType<typeof findReservationForCancellation>>>;

type LoadCancellableResult =
  | { ok: true; reservation: ReservationForCancellation }
  | { ok: false; status: number; message: string };

const sendHtml = (res: Response, status: number, html: string) => {
  res.status(status).set('Cache-Control', 'no-store').type('html').send(html);
};

/**
 * Shared validation for the email cancellation links: the reservation must exist, the HMAC
 * must match its current start time, and we must still be outside the cutoff window.
 */
const loadCancellableReservation = async (
  rid: unknown,
  token: unknown,
  locale: Locale
): Promise<LoadCancellableResult> => {
  const strings = getReservationStrings(locale).cancelPage;

  if (typeof rid !== 'string' || !rid || typeof token !== 'string' || !token) {
    return { ok: false, status: 400, message: strings.invalidLink };
  }

  const reservation = await findReservationForCancellation(rid);

  if (!reservation) {
    return { ok: false, status: 404, message: strings.notFound };
  }

  if (!verifyReservationCancelToken(reservation.id, reservation.date, token)) {
    return { ok: false, status: 403, message: strings.invalidLink };
  }

  if (!canCancelReservation(reservation.date)) {
    return { ok: false, status: 409, message: strings.tooLate({ minutes: CANCELLATION_CUTOFF_MINUTES }) };
  }

  return { ok: true, reservation };
};

export const renderCancelReservationPage = async (req: Request, res: Response) => {
  const locale = resolveLocale(req.query?.locale, req.get('accept-language'));

  try {
    const { rid, token } = req.query as { rid?: string; token?: string };
    const result = await loadCancellableReservation(rid, token, locale);

    if (!result.ok) {
      sendHtml(res, result.status, renderCancelReservationErrorPage({ locale, message: result.message }));
      return;
    }

    const { reservation } = result;

    sendHtml(
      res,
      200,
      renderCancelReservationConfirmPage({
        locale,
        reservationId: reservation.id,
        token: token as string,
        summary: {
          serviceName: locale === 'fr' ? reservation.service.nameFr : reservation.service.nameEn,
          barberName: reservation.barber.name,
          startAtUtc: reservation.date,
          endAtUtc: reservation.endDate,
        },
      })
    );
  } catch (error) {
    logger.error(error as any);
    const strings = getReservationStrings(locale).cancelPage;
    sendHtml(res, 500, renderCancelReservationErrorPage({ locale, message: strings.serverError }));
  }
};

export const cancelReservationFromEmail = async (req: Request, res: Response) => {
  const locale = resolveLocale(req.body?.locale, req.query?.locale, req.get('accept-language'));

  try {
    const { rid, token } = (req.body ?? {}) as { rid?: string; token?: string };
    const result = await loadCancellableReservation(rid, token, locale);

    if (!result.ok) {
      sendHtml(res, result.status, renderCancelReservationErrorPage({ locale, message: result.message }));
      return;
    }

    const { reservation } = result;

    if (reservation.googleEventId && reservation.barber.googleCalendarId) {
      await deleteReservationFromGoogleCalendar(reservation.barber.googleCalendarId, reservation.googleEventId);
    }

    await prisma.reservation.delete({ where: { id: reservation.id } });

    logger.info(`Reservation ${reservation.id} cancelled by the client from the confirmation email`);

    sendHtml(res, 200, renderCancelReservationSuccessPage(locale));
  } catch (error) {
    logger.error(error as any);
    const strings = getReservationStrings(locale).cancelPage;
    sendHtml(res, 500, renderCancelReservationErrorPage({ locale, message: strings.serverError }));
  }
};

export const deleteReservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id) {
      throwError('Reservation ID is required', 400);
      return;
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { barber: true },
    });

    if (!reservation) {
      throwError('Reservation not found', 404);
      return;
    }

    // Remove the barber's event first: a leftover event shows a booking that no longer exists
    // and can be picked up again by the calendar webhook.
    if (reservation.googleEventId && reservation.barber.googleCalendarId) {
      await deleteReservationFromGoogleCalendar(reservation.barber.googleCalendarId, reservation.googleEventId);
    }

    await prisma.reservation.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
