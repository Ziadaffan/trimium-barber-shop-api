import { NextFunction, Request, Response } from 'express';
import prisma from '@/packages/lib/db';
import { DayOfWeek } from '@prisma/client';

export const getBarberSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId } = req.params;

    const schedules = await prisma.barberSchedule.findMany({
      where: {
        barberId,
        isActive: true
      },
      orderBy: {
        dayOfWeek: 'asc'
      }
    });

    res.status(200).json(schedules);
  } catch (error) {
    next(error);
  }
};

export const createBarberSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId, dayOfWeek, startTime, endTime } = req.body;

    // Vérifier que le barbier existe
    const barber = await prisma.barber.findUnique({
      where: { id: barberId }
    });

    if (!barber) {
      throw new Error('Barber not found');
    }

    const schedule = await prisma.barberSchedule.create({
      data: {
        barberId,
        dayOfWeek: dayOfWeek as DayOfWeek,
        startTime,
        endTime
      }
    });

    res.status(201).json(schedule);
  } catch (error) {
    next(error);
  }
};

export const updateBarberSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, isActive } = req.body;

    const schedule = await prisma.barberSchedule.update({
      where: { id },
      data: {
        startTime,
        endTime,
        isActive
      }
    });

    res.status(200).json(schedule);
  } catch (error) {
    next(error);
  }
};

export const deleteBarberSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.barberSchedule.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
