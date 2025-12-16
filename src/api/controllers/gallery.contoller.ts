import prisma from '../../packages/lib/db';
import { NextFunction, Request, Response } from 'express';
import { throwError } from '../../packages/common/utils/error.handler.utils';
import { deleteFromCloudinary, updateImageInCloudinary, uploadToCloudinary } from '../../packages/cloudinary/cloudinaryClient';

export const getGalleries = async (req: Request, res: Response, next: NextFunction) => {
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

export const createGallery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { position } = req.body;
    const file = req.file as Express.Multer.File;

    if (!position) {
      throwError('Position is required', 400);
      return;
    }

    if (!file) {
      throwError('Image is required', 400);
      return;
    }

    const { secure_url, public_id } = await uploadToCloudinary(file.buffer, file.mimetype, 'gallery');

    const gallery = await prisma.gallery.create({
      data: {
        image: secure_url,
        cloudinaryId: public_id,
        position: parseInt(position),
      },
    });

    res.status(201).json(gallery);
  } catch (error) {
    next(error);
  }
};

export const updateGallery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { position } = req.body;
    const file = req.file as Express.Multer.File;

    if (!id) {
      throwError('Gallery ID is required', 400);
      return;
    }

    const gallery = await prisma.gallery.findUnique({
      where: { id },
    });

    if (!gallery) {
      throwError('Gallery not found', 404);
      return;
    }

    const updateData: {
      position?: number;
      image?: string;
      cloudinaryId?: string;
    } = {};

    if (position !== undefined) {
      updateData.position = parseInt(position);
    }

    if (file) {
      if (gallery.cloudinaryId) {
        const { secure_url } = await updateImageInCloudinary(gallery.cloudinaryId, file.buffer, file.mimetype);
        updateData.image = secure_url;
      }
    }

    const updatedGallery = await prisma.gallery.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json(updatedGallery);
  } catch (error) {
    next(error);
  }
};

export const deleteGallery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id) {
      throwError('Gallery ID is required', 400);
      return;
    }

    const gallery = await prisma.gallery.findUnique({
      where: { id },
    });

    if (!gallery) {
      throwError('Gallery not found', 404);
      return;
    }

    if (gallery.cloudinaryId) {
      await deleteFromCloudinary(gallery.cloudinaryId);
    }

    const deletedGallery = await prisma.gallery.delete({
      where: { id: gallery.id },
    });

    res.status(204).json(deletedGallery);
  } catch (error) {
    next(error);
  }
};