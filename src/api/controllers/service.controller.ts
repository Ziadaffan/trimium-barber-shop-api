import prisma from '../../packages/lib/db';
import { NextFunction, Request, Response } from 'express';
import { throwError } from '../../packages/common/utils/error.handler.utils';

export const getServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { evenNotActive } = req.query;
    const services = await prisma.service.findMany({
      where: { isActive: evenNotActive === 'true' ? undefined : true },
    });

    res.status(200).json(services);
  } catch (error) {
    next(error);
  }
};

export const createService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, nameEn, nameFr, descriptionEn, descriptionFr, price, duration, isPremium, isActive } = req.body;

    if (!type || !nameEn || !nameFr || !descriptionEn || !descriptionFr || !price || !duration) {
      throwError('All fields are required', 400);
      return;
    }

    const service = await prisma.service.create({
      data: {
        type,
        nameEn,
        nameFr,
        descriptionEn,
        descriptionFr,
        price: parseFloat(price),
        duration: parseInt(duration),
        isPremium,
        isActive,
      },
    });

    res.status(201).json(service);
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { type, nameEn, nameFr, descriptionEn, descriptionFr, price, duration, isPremium, isActive } = req.body;

    if (!type || !nameEn || !nameFr || !descriptionEn || !descriptionFr || !price || !duration) {
      throwError('All fields are required', 400);
      return;
    }

    const service = await prisma.service.findUnique({
      where: { id },
    });
    if (!service) {
      throwError('Service not found', 404);
      return;
    }

    const updatedService = await prisma.service.update({
      where: { id },
      data: {
        type,
        nameEn,
        nameFr,
        descriptionEn,
        descriptionFr,
        price: parseFloat(price),
        duration: parseInt(duration),
        isPremium,
        isActive,
      },
    });

    res.status(200).json(updatedService);
  } catch (error) {
    next(error);
  }
};

export const deleteService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id) {
      throwError('Service ID is required', 400);
      return;
    }

    const service = await prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throwError('Service not found', 404);
      return;
    }

    const deletedService = await prisma.service.delete({
      where: { id },
    });

    res.status(204).json(deletedService);
  } catch (error) {
    next(error);
  }
};
