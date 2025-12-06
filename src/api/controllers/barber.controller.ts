import prisma from '../../packages/lib/db';
import { NextFunction, Request, Response } from 'express';

export const getBarbers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const barbers = await prisma.barber.findMany();

    res.status(200).json(barbers);
  } catch (error) {
    next(error);
  }
};

export const createBarber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone } = req.body;
    const barber = await prisma.barber.create({
      data: { name, email, phone },
    });
    res.status(201).json(barber);
  } catch (error) {
    next(error);
  }
};

export const updateBarber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;
    const barber = await prisma.barber.update({
      where: { id },
      data: { name, email, phone },
    });
    res.status(200).json(barber);
  } catch (error) {
    next(error);
  }
};

export const deleteBarber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.barber.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
