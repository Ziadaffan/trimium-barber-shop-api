import { NextFunction, Request, Response } from 'express';
import prisma from '@/packages/lib/db';
import { ReservationStatus } from '@prisma/client';
import { parse } from 'date-fns';

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
