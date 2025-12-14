import { NextFunction, Request, Response } from 'express';
import prisma from '../../packages/lib/db';
import { ReservationStatus } from '@prisma/client';
import { parse, format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { throwError } from '../../packages/common/utils/error.handler.utils';
import { addReservationToGoogleCalendar } from '../../packages/google/oAuth2Client';

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

    const canadaTimezone = 'America/Toronto';

    const [yearStr, monthStr, dayStr] = date.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    const startOfDayLocal = new Date(year, month, day, 0, 0, 0, 0);
    const endOfDayLocal = new Date(year, month, day, 23, 59, 59, 999);

    const startOfDayUTC = fromZonedTime(startOfDayLocal, canadaTimezone);
    const endOfDayUTC = fromZonedTime(endOfDayLocal, canadaTimezone);

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
      const [startHourStr, startMinStr] = schedule.startTime.split(':');
      const [endHourStr, endMinStr] = schedule.endTime.split(':');
      const startHour = parseInt(startHourStr);
      const startMin = parseInt(startMinStr || '0');
      const endHour = parseInt(endHourStr);
      const endMin = parseInt(endMinStr || '0');

      const startTotalMinutes = startHour * 60 + startMin;
      const endTotalMinutes = endHour * 60 + endMin;

      for (let minutes = startTotalMinutes; minutes + serviceDuration <= endTotalMinutes; minutes += 30) {
        const hour = Math.floor(minutes / 60);
        const min = minutes % 60;
        const timeSlot = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

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
      const reservationDateCanada = toZonedTime(reservation.date, canadaTimezone);
      const reservationStartMinutes = reservationDateCanada.getHours() * 60 + reservationDateCanada.getMinutes();
      const reservationDuration = reservation.service.duration;

      for (let min = reservationStartMinutes; min < reservationStartMinutes + reservationDuration; min += 30) {
        const hour = Math.floor(min / 60);
        const minute = min % 60;
        occupiedSlots.add(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    });

    const availableTimes = allTimes.filter(timeSlot => {
      const [hourStr, minStr] = timeSlot.split(':');
      const slotStartMinutes = parseInt(hourStr) * 60 + parseInt(minStr);

      for (let min = slotStartMinutes; min < slotStartMinutes + serviceDuration; min += 30) {
        const hour = Math.floor(min / 60);
        const minute = min % 60;
        const slot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        if (occupiedSlots.has(slot)) {
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

    const data = {
      barberId,
      date: utcDate,
      status: ReservationStatus.PENDING,
      clientName,
      clientPhone,
      clientEmail,
      serviceId: service.id,
    };

    const existingReservation = await prisma.reservation.findFirst({
      where: {
        date: utcDate,
        barberId,
      },
    });

    if (existingReservation) {
      throwError('Reservation already exists', 400);
      return;
    }

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

    const existingReservation = await prisma.reservation.findFirst({
      where: {
        date: utcDate,
        barberId,
        id: {
          not: id,
        },
      },
    });

    if (existingReservation) {
      throwError('Reservation already exists', 400);
      return;
    }

    const data = {
      barberId,
      date: utcDate,
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
  const canadaTimezone = 'America/Toronto';

  const dateTimeString = `${date} ${time}`;
  let parsedDate = parse(dateTimeString, 'yyyy-MM-dd HH:mm', new Date());

  if (isNaN(parsedDate.getTime())) {
    parsedDate = parse(dateTimeString, 'yyyy-MM-dd h:mm a', new Date());
  }

  if (isNaN(parsedDate.getTime())) {
    throwError(
      'Invalid date or time format. Expected date in yyyy-MM-dd format and time in HH:mm or h:mm a format',
      400
    );
    return null;
  }

  const utcDate = fromZonedTime(parsedDate, canadaTimezone);
  return utcDate;
};
