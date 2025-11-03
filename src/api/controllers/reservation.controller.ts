import { NextFunction, Request, Response } from 'express';
import prisma from '@/packages/lib/db';
import { ReservationStatus } from '@prisma/client';
import { parse, format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { throwError } from '@/packages/common/utils/error.handler.utils';

export const getAvailableTimes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, barberId, serviceType } = req.body;

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      throwError('Barber not found', 404);
    }

    const service = await prisma.service.findUnique({
      where: { type: serviceType },
    });

    if (!service) {
      throwError('Service not found', 404);
      return;
    }

    const serviceDuration = service.duration; // Duration in minutes

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

    const barberSchedule = await prisma.barberSchedule.findUnique({
      where: {
        barberId_dayOfWeek: {
          barberId,
          dayOfWeek: dayOfWeek as any,
        },
      },
    });

    if (!barberSchedule || !barberSchedule.isActive) {
      throwError('Barber schedule not found', 404);
      return;
    }

    const [startHourStr, startMinStr] = barberSchedule.startTime.split(':');
    const [endHourStr, endMinStr] = barberSchedule.endTime.split(':');
    const startHour = parseInt(startHourStr);
    const startMin = parseInt(startMinStr || '0');
    const endHour = parseInt(endHourStr);
    const endMin = parseInt(endMinStr || '0');

    // Calculate total minutes for start and end
    const startTotalMinutes = startHour * 60 + startMin;
    const endTotalMinutes = endHour * 60 + endMin;

    // Generate all possible time slots based on service duration
    const allTimes = [];
    for (let minutes = startTotalMinutes; minutes + serviceDuration <= endTotalMinutes; minutes += 30) {
      // 30-minute intervals
      const hour = Math.floor(minutes / 60);
      const min = minutes % 60;
      allTimes.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    }

    // Get existing reservations
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

    // Create a set of occupied time slots
    const occupiedSlots = new Set<string>();

    existingReservations.forEach(reservation => {
      const reservationDateCanada = toZonedTime(reservation.date, canadaTimezone);
      const reservationStartMinutes = reservationDateCanada.getHours() * 60 + reservationDateCanada.getMinutes();
      const reservationDuration = reservation.service.duration;

      // Mark all 30-minute slots occupied by this reservation
      for (let min = reservationStartMinutes; min < reservationStartMinutes + reservationDuration; min += 30) {
        const hour = Math.floor(min / 60);
        const minute = min % 60;
        occupiedSlots.add(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    });

    // Check which time slots have enough consecutive free time for the service
    const availableTimes = allTimes.filter(timeSlot => {
      const [hourStr, minStr] = timeSlot.split(':');
      const slotStartMinutes = parseInt(hourStr) * 60 + parseInt(minStr);

      // Check if all required 30-minute slots are free
      for (let min = slotStartMinutes; min < slotStartMinutes + serviceDuration; min += 30) {
        const hour = Math.floor(min / 60);
        const minute = min % 60;
        const slot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        if (occupiedSlots.has(slot)) {
          return false; // This time slot is not available
        }
      }

      return true; // All required slots are free
    });

    res.status(200).json({
      date,
      barberId,
      serviceType,
      serviceDuration,
      availableTimes,
      totalSlots: allTimes.length,
      bookedSlots: existingReservations.length,
      barberSchedule: {
        startTime: barberSchedule.startTime,
        endTime: barberSchedule.endTime,
        dayOfWeek: barberSchedule.dayOfWeek,
      },
    });
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
        date: 'desc',
      },
    });
    res.status(200).json(reservations);
  } catch (error) {
    next(error);
  }
};

export const createReservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId, date, time, name, phone, email, serviceType } = req.body;
    const canadaTimezone = 'America/Toronto';

    const dateTimeString = `${date} ${time}`;
    const parsedDate = parse(dateTimeString, 'yyyy-MM-dd h:mm a', new Date());

    const utcDate = fromZonedTime(parsedDate, canadaTimezone);

    const service = await prisma.service.findUnique({
      where: { type: serviceType },
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

    const data = {
      barberId,
      date: utcDate,
      status: ReservationStatus.PENDING,
      clientName: name,
      clientPhone: phone,
      clientEmail: email,
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
    const { date, barberId } = req.body;

    if (!date || !barberId) {
      throwError('Date and barberId are required', 400);
      return;
    }

    const reservation = await prisma.reservation.update({
      where: { id },
      data: { date, barberId },
    });

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
