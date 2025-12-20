import { NextFunction, Request, Response } from 'express';
import prisma from '../../packages/lib/db';
import { ReservationStatus } from '@prisma/client';
import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { throwError } from '../../packages/common/utils/error.handler.utils';
import { addReservationToGoogleCalendar } from '../../packages/google/oAuth2Client';
import {
  CANADA_TIMEZONE,
  SLOT_MINUTES,
  getReservationTimeUTC,
  minutesToTime,
  parseTimeToMinutes,
} from '../../packages/common/utils/reservation-time.utils';

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

    const allTimes: string[] = [];

    for (const schedule of barberSchedules) {
      const startTotalMinutes = parseTimeToMinutes(schedule.startTime);
      const endTotalMinutes = parseTimeToMinutes(schedule.endTime);

      for (let minutes = startTotalMinutes; minutes + serviceDuration <= endTotalMinutes; minutes += SLOT_MINUTES) {
        const timeSlot = minutesToTime(minutes);

        if (!allTimes.includes(timeSlot)) {
          allTimes.push(timeSlot);
        }
      }
    }

    allTimes.sort();

    const existingReservations = await prisma.reservation.findMany({
      where: {
        barberId,
        date: {
          gte: startOfDayUTC,
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

    const occupiedSlots = new Set<string>();

    existingReservations.forEach(reservation => {
      const reservationDateCanada = toZonedTime(reservation.date, CANADA_TIMEZONE);
      const reservationStartMinutes = reservationDateCanada.getHours() * 60 + reservationDateCanada.getMinutes();
      const reservationDuration = reservation.service.duration;

      for (let min = reservationStartMinutes; min < reservationStartMinutes + reservationDuration; min += SLOT_MINUTES) {
        occupiedSlots.add(minutesToTime(min));
      }
    });

    // Block out vacations / time off
    const timeOffs = await prisma.barberTimeOff.findMany({
      where: {
        barberId,
        isActive: true,
        startAt: { lte: endOfDayUTC },
        endAt: { gte: startOfDayUTC },
      },
    });

    timeOffs.forEach(timeOff => {
      const startLocal = toZonedTime(timeOff.startAt, CANADA_TIMEZONE);
      const endLocal = toZonedTime(timeOff.endAt, CANADA_TIMEZONE);

      const startOfNextDayLocal = new Date(year, month, day + 1, 0, 0, 0, 0);

      const clampedStartMs = Math.max(startLocal.getTime(), startOfDayLocal.getTime());
      const clampedEndMs = Math.min(endLocal.getTime(), startOfNextDayLocal.getTime());

      const startMinutes = Math.max(0, Math.floor((clampedStartMs - startOfDayLocal.getTime()) / 60_000));
      const endMinutes = Math.min(24 * 60, Math.ceil((clampedEndMs - startOfDayLocal.getTime()) / 60_000));

      for (let min = startMinutes; min < endMinutes; min += SLOT_MINUTES) {
        occupiedSlots.add(minutesToTime(min));
      }
    });

    const availableTimes = allTimes.filter(timeSlot => {
      const [hourStr, minStr] = timeSlot.split(':');
      const slotStartMinutes = parseInt(hourStr) * 60 + parseInt(minStr);

      for (let min = slotStartMinutes; min < slotStartMinutes + serviceDuration; min += SLOT_MINUTES) {
        if (occupiedSlots.has(minutesToTime(min))) {
          return false;
        }
      }

      return true;
    });

    res.status(200).json(availableTimes);
  } catch (error) {
    next(error);
  }
};

export const getReservations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservations = await prisma.reservation.findMany({
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

export const createReservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId, date, time, clientName, clientPhone, clientEmail, serviceId } = req.body;
    if (!barberId || !date || !time || !clientName || !clientPhone || !clientEmail || !serviceId) {
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

    const utcDate = getReservationTime(date, time);

    if (!utcDate) {
      throwError('Invalid date or time format', 400);
      return;
    }

    const utcEndDate = new Date(utcDate.getTime() + service.duration * 60_000);

    // Validate requested interval is inside weekly schedule
    const localStart = toZonedTime(utcDate, CANADA_TIMEZONE);
    const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][localStart.getDay()];

    const schedules = await prisma.barberSchedule.findMany({
      where: { barberId, dayOfWeek: dayOfWeek as any, isActive: true },
    });

    const localStartMinutes = localStart.getHours() * 60 + localStart.getMinutes();
    const localEndMinutes = localStartMinutes + service.duration;

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
        startAt: { lt: utcEndDate },
        endAt: { gt: utcDate },
      },
    });

    if (overlappingTimeOff) {
      throwError('Barber is not available (time off)', 400);
      return;
    }

    // Prevent overlaps (not just same start time)
    const startOfDayLocal = new Date(localStart.getFullYear(), localStart.getMonth(), localStart.getDate(), 0, 0, 0, 0);
    const endOfDayLocal = new Date(localStart.getFullYear(), localStart.getMonth(), localStart.getDate(), 23, 59, 59, 999);
    const startOfDayUTC = fromZonedTime(startOfDayLocal, CANADA_TIMEZONE);
    const endOfDayUTC = fromZonedTime(endOfDayLocal, CANADA_TIMEZONE);

    const existingReservations = await prisma.reservation.findMany({
      where: {
        barberId,
        date: { gte: startOfDayUTC, lte: endOfDayUTC },
        status: { not: 'CANCELLED' },
      },
      include: { service: true },
    });

    const overlaps = existingReservations.some(r => {
      const rStart = r.date;
      const rEnd = (r as any).endDate ? (r as any).endDate : new Date(r.date.getTime() + r.service.duration * 60_000);
      return rStart < utcEndDate && rEnd > utcDate;
    });

    if (overlaps) {
      throwError('Selected time overlaps an existing reservation', 400);
      return;
    }

    const data = {
      barberId,
      date: utcDate,
      endDate: utcEndDate,
      status: ReservationStatus.PENDING,
      clientName,
      clientPhone,
      clientEmail,
      serviceId: service.id,
    };

    await addReservationToGoogleCalendar({
      barberId,
      clientName,
      clientPhone,
      clientEmail,
      service: service,
      date: utcDate,
    });

    const reservation = await prisma.reservation.create({
      data,
    });

    if (!reservation) {
      throwError('Failed to create reservation', 400);
      return;
    }

    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
};

export const updateReservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { barberId, date, time, clientName, clientPhone, clientEmail, serviceId, status } = req.body;

    if (!barberId || !date || !time || !clientName || !clientPhone || !clientEmail || !serviceId || !status) {
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

    const utcDate = getReservationTime(date, time);

    if (!utcDate) {
      throwError('Invalid date or time format', 400);
      return;
    }

    const utcEndDate = new Date(utcDate.getTime() + service.duration * 60_000);

    // Validate requested interval is inside weekly schedule
    const localStart = toZonedTime(utcDate, CANADA_TIMEZONE);
    const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][localStart.getDay()];

    const schedules = await prisma.barberSchedule.findMany({
      where: { barberId, dayOfWeek: dayOfWeek as any, isActive: true },
    });

    const localStartMinutes = localStart.getHours() * 60 + localStart.getMinutes();
    const localEndMinutes = localStartMinutes + service.duration;

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
        startAt: { lt: utcEndDate },
        endAt: { gt: utcDate },
      },
    });

    if (overlappingTimeOff) {
      throwError('Barber is not available (time off)', 400);
      return;
    }

    // Prevent overlaps (not just same start time)
    const startOfDayLocal = new Date(localStart.getFullYear(), localStart.getMonth(), localStart.getDate(), 0, 0, 0, 0);
    const endOfDayLocal = new Date(localStart.getFullYear(), localStart.getMonth(), localStart.getDate(), 23, 59, 59, 999);
    const startOfDayUTC = fromZonedTime(startOfDayLocal, CANADA_TIMEZONE);
    const endOfDayUTC = fromZonedTime(endOfDayLocal, CANADA_TIMEZONE);

    const existingReservations = await prisma.reservation.findMany({
      where: {
        barberId,
        date: { gte: startOfDayUTC, lte: endOfDayUTC },
        status: { not: 'CANCELLED' },
        id: { not: id },
      },
      include: { service: true },
    });

    const overlaps = existingReservations.some(r => {
      const rStart = r.date;
      const rEnd = (r as any).endDate ? (r as any).endDate : new Date(r.date.getTime() + r.service.duration * 60_000);
      return rStart < utcEndDate && rEnd > utcDate;
    });

    if (overlaps) {
      throwError('Selected time overlaps an existing reservation', 400);
      return;
    }

    const data = {
      barberId,
      date: utcDate,
      endDate: utcEndDate,
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

    res.status(200).json(reservation);
  } catch (error) {
    next(error);
  }
};

export const deleteReservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id) {
      throwError('Reservation ID is required', 400);
      return;
    }

    const reservation = await prisma.reservation.delete({
      where: { id },
    });

    if (!reservation) {
      throwError('Failed to delete reservation', 400);
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const getReservationTime = (date: string, time: string) => {
  const utcDate = getReservationTimeUTC(date, time);
  if (!utcDate) {
    throwError(
      'Invalid date or time format. Expected date in yyyy-MM-dd format and time in HH:mm or h:mm a format',
      400
    );
    return null;
  }
  return utcDate;
};
