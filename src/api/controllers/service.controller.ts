import prisma from '@/packages/lib/db';
import { ServiceType } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';

interface GetServicesResponse {
  id: string;
  type: ServiceType;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export const getServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { language } = req.query;

    if (!language) {
      language = 'fr';
    }
    const services = await prisma.service.findMany();

    const formattedServices: GetServicesResponse[] = services.map(service => ({
      id: service.id,
      type: service.type,
      name: language === 'fr' ? service.nameFr : service.nameEn,

      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    }));

    res.status(200).json(formattedServices);
  } catch (error) {
    next(error);
  }
};

export const createService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, nameEn, nameFr } = req.body;
    const service = await prisma.service.create({
      data: { type, nameEn, nameFr },
    });

    if (!service) {
      throw new Error('Failed to create service');
    }

    res.status(201).send();
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { type, nameEn, nameFr } = req.body;
    const service = await prisma.service.update({
      where: { id },
      data: { type, nameEn, nameFr },
    });

    if (!service) {
      throw new Error('Failed to update service');
    }

    res.status(200).send();
  } catch (error) {
    next(error);
  }
};

export const deleteService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const service = await prisma.service.delete({
      where: { id },
    });

    if (!service) {
      throw new Error('Failed to delete service');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
