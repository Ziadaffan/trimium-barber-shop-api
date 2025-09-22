import prisma from '@/packages/lib/db';
import { NextFunction, Request, Response } from 'express';

export const getBarbers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const barbers = await prisma.barber.findMany();

    res.status(200).json(barbers);
  } catch (error) {
    next(error);
  }
};
