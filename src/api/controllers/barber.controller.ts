import {
  deleteFromCloudinary,
  getImageFromCloudinary,
  updateImageInCloudinary,
  uploadToCloudinary,
} from '../../packages/cloudinary/cloudinaryClient';
import { throwError } from '../../packages/common/utils/error.handler.utils';
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
    const { name, email, phone, googleCalendarId, imageUrl } = req.body;
    const file = req.file as Express.Multer.File;

    if (!name || !email || !phone) {
      throwError('All fields are required', 400);
      return;
    }

    if (!file) {
      throwError('Image is required', 400);
      return;
    }

    const { secure_url, public_id } = await uploadToCloudinary(file.buffer, file.mimetype, 'barbers');

    const existingBarber = await prisma.barber.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingBarber) {
      throwError('Barber with this email already exists', 400);
      return;
    }

    const data = {
      name: name.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      phone: phone.trim().toLowerCase(),
      googleCalendarId,
      imageUrl: secure_url,
      cloudinaryId: public_id,
    };

    const barber = await prisma.barber.create({
      data,
    });
    res.status(201).json(barber);
  } catch (error) {
    next(error);
  }
};

export const updateBarber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, email, phone, googleCalendarId, imageUrl } = req.body;
    const file = req.file as Express.Multer.File;

    console.log(file);

    if (!id) {
      throwError('Id is required', 400);
      return;
    }

    if (!name || !email || !phone || !googleCalendarId) {
      throwError('All fields are required', 400);
      return;
    }

    const barber = await prisma.barber.findUnique({
      where: { id },
    });

    if (!barber) {
      throwError('Barber not found', 404);
      return;
    }

    if (!barber.cloudinaryId) {
      throwError('Barber image not found', 404);
      return;
    }

    const cloudinaryImageUrl = await getImageFromCloudinary(barber.cloudinaryId);

    if (!cloudinaryImageUrl) {
      throwError('Cloudinary image not found', 404);
      return;
    }

    let secure_url = cloudinaryImageUrl;

    if (file) {
      if (barber.cloudinaryId) {
        const { secure_url: newSecure_url } = await updateImageInCloudinary(
          barber.cloudinaryId,
          file.buffer,
          file.mimetype
        );
        secure_url = newSecure_url;
      }
    }

    const updatedBarber = await prisma.barber.update({
      where: { id },
      data: { name, email, phone, googleCalendarId, imageUrl: secure_url },
    });
    res.status(200).json(updatedBarber);
  } catch (error) {
    next(error);
  }
};

export const deleteBarber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const barber = await prisma.barber.findUnique({
      where: { id },
    });
    if (!barber) {
      throwError('Barber not found', 404);
      return;
    }

    if (barber.cloudinaryId) {
      await deleteFromCloudinary(barber.cloudinaryId);
    }

    await prisma.barber.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
