import { NextFunction, Request, Response } from 'express';
import prisma from '@/packages/lib/db';
import { ReservationStatus } from '@prisma/client';
import { parse } from 'date-fns';

export const getAvailableTimes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, barberId, serviceType } = req.body;
    
    // Vérifier que le barbier existe
    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      throw new Error('Barber not found');
    }

    // Vérifier que le service existe
    const service = await prisma.service.findUnique({
      where: { type: serviceType },
    });

    if (!service) {
      throw new Error('Service not found');
    }

    // Obtenir le jour de la semaine
    const requestedDate = new Date(date);
    const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][requestedDate.getDay()];

    // Récupérer l'horaire du barbier pour ce jour
    const barberSchedule = await prisma.barberSchedule.findUnique({
      where: {
        barberId_dayOfWeek: {
          barberId,
          dayOfWeek: dayOfWeek as any
        }
      }
    });

    if (!barberSchedule || !barberSchedule.isActive) {
      return res.status(200).json({
        date,
        barberId,
        serviceType,
        availableTimes: [],
        totalSlots: 0,
        bookedSlots: 0,
        message: 'Barber not available on this day'
      });
    }

    // Générer les heures disponibles selon l'horaire du barbier
    const startHour = parseInt(barberSchedule.startTime.split(':')[0]);
    const endHour = parseInt(barberSchedule.endTime.split(':')[0]);
    
    const allTimes = [];
    for (let hour = startHour; hour < endHour; hour++) {
      allTimes.push(`${hour.toString().padStart(2, '0')}:00`);
    }

    // Récupérer les réservations existantes pour cette date et ce barbier
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingReservations = await prisma.reservation.findMany({
      where: {
        barberId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          not: 'CANCELLED'
        }
      },
    });

    // Convertir les réservations existantes en heures
    const bookedTimes = existingReservations.map(reservation => {
      const reservationDate = new Date(reservation.date);
      return `${reservationDate.getHours().toString().padStart(2, '0')}:00`;
    });

    // Filtrer les heures disponibles
    const availableTimes = allTimes.filter(time => !bookedTimes.includes(time));

    res.status(200).json({
      date,
      barberId,
      serviceType,
      availableTimes,
      totalSlots: allTimes.length,
      bookedSlots: bookedTimes.length,
      barberSchedule: {
        startTime: barberSchedule.startTime,
        endTime: barberSchedule.endTime,
        dayOfWeek: barberSchedule.dayOfWeek
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getReservations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservations = await prisma.reservation.findMany();
    res.status(200).json(reservations);
  } catch (error) {
    next(error);
  }
};

export const createReservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId, date, time, name, phone, email, serviceType } = req.body;

    const combinedDateTime = parse(`${date} ${time}`, 'yyyy-MM-dd h:mm a', new Date());

    const service = await prisma.service.findUnique({
      where: { type: serviceType },
    });

    if (!service) {
      throw new Error('Service not found');
    }

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      throw new Error('Barber not found');
    }

    const data = {
      barberId,
      date: combinedDateTime,
      status: ReservationStatus.PENDING,
      clientName: name,
      clientPhone: phone,
      clientEmail: email,
      serviceId: service.id,
    };

    const reservation = await prisma.reservation.create({
      data,
    });

    if (!reservation) {
      throw new Error('Failed to create reservation');
    }

    res.status(201).send();
  } catch (error) {
    next(error);
  }
};

export const updateReservation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { date, barberId } = req.body;

    if (!date || !barberId) {
      throw new Error('Date and barberId are required');
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
      throw new Error('Reservation ID is required');
    }

    const reservation = await prisma.reservation.delete({
      where: { id },
    });

    if (!reservation) {
      throw new Error('Failed to delete reservation');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
