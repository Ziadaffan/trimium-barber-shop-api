import { NextFunction, Request, Response } from 'express';
import prisma from '../../packages/lib/db';
import { DayOfWeek, BarberTimeOffType } from '@prisma/client';

export const getBarberSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId } = req.params;

    const schedules = await prisma.barberSchedule.findMany({
      where: {
        barberId,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' },
        { endTime: 'asc' },
      ],
    });

    res.status(200).json(schedules);
  } catch (error) {
    next(error);
  }
};

export const createBarberSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId } = req.params;
    const { dayOfWeek, startTime, endTime } = req.body;

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      throw new Error('Barber not found');
    }

    const schedule = await prisma.barberSchedule.create({
      data: {
        barberId,
        dayOfWeek: dayOfWeek as DayOfWeek,
        startTime,
        endTime,
      },
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
        isActive,
      },
    });

    res.status(200).json(schedule);
  } catch (error) {
    next(error);
  }
};

export const deleteBarberSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId, id } = req.params;

    const barber = await prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber) {
      throw new Error('Barber not found');
    }

    await prisma.barberSchedule.delete({
      where: { id, barberId },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getBarberTimeOffs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId } = req.params;

    const timeOffs = await prisma.barberTimeOff.findMany({
      where: { barberId },
      orderBy: [{ startAt: 'asc' }, { endAt: 'asc' }],
    });

    res.status(200).json(timeOffs);
  } catch (error) {
    next(error);
  }
};

export const createBarberTimeOff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId } = req.params;
    const { startAt, endAt, type, note } = req.body as {
      startAt: string;
      endAt: string;
      type?: BarberTimeOffType;
      note?: string;
    };

    if (!startAt || !endAt) {
      res.status(400).json({ message: 'startAt and endAt are required (ISO date strings)' });
      return;
    }

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ message: 'Invalid startAt/endAt (must be ISO dates)' });
      return;
    }

    if (start >= end) {
      res.status(400).json({ message: 'startAt must be before endAt' });
      return;
    }

    const barber = await prisma.barber.findUnique({ where: { id: barberId } });
    if (!barber) {
      res.status(404).json({ message: 'Barber not found' });
      return;
    }

    const timeOff = await prisma.barberTimeOff.create({
      data: {
        barberId,
        startAt: start,
        endAt: end,
        type: (type ?? 'VACATION') as BarberTimeOffType,
        note,
      },
    });

    res.status(201).json(timeOff);
  } catch (error) {
    next(error);
  }
};

export const updateBarberTimeOff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId, id, timeOffId } = req.params as any;
    const resolvedId = timeOffId ?? id;
    const { startAt, endAt, type, note, isActive } = req.body as {
      startAt?: string;
      endAt?: string;
      type?: BarberTimeOffType;
      note?: string;
      isActive?: boolean;
    };

    if (!resolvedId) {
      res.status(400).json({ message: 'timeOffId is required' });
      return;
    }

    const data: any = {};
    if (typeof note !== 'undefined') data.note = note;
    if (typeof isActive !== 'undefined') data.isActive = isActive;
    if (typeof type !== 'undefined') data.type = type;
    if (typeof startAt !== 'undefined') data.startAt = new Date(startAt);
    if (typeof endAt !== 'undefined') data.endAt = new Date(endAt);

    if (data.startAt && isNaN(data.startAt.getTime())) {
      res.status(400).json({ message: 'Invalid startAt' });
      return;
    }
    if (data.endAt && isNaN(data.endAt.getTime())) {
      res.status(400).json({ message: 'Invalid endAt' });
      return;
    }

    // If both present, validate order
    if (data.startAt && data.endAt && data.startAt >= data.endAt) {
      res.status(400).json({ message: 'startAt must be before endAt' });
      return;
    }

    const updated = await prisma.barberTimeOff.update({
      where: { id: resolvedId, barberId },
      data,
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

export const deleteBarberTimeOff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId, id, timeOffId } = req.params as any;
    const resolvedId = timeOffId ?? id;

    if (!resolvedId) {
      res.status(400).json({ message: 'timeOffId is required' });
      return;
    }

    await prisma.barberTimeOff.delete({
      where: { id: resolvedId, barberId },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
