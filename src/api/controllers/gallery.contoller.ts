import prisma from '@/packages/lib/db';
import { NextFunction, Request, Response } from 'express';

export const getGallery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gallery = await prisma.gallery.findMany({
      orderBy: {
        position: 'asc',
      },
      take: 6,
    });
    res.status(200).json(gallery);
  } catch (error) {
    next(error);
  }
};
