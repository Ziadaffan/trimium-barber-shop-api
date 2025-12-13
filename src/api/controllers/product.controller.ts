import prisma from '../../packages/lib/db';
import { NextFunction, Request, Response } from 'express';
import { throwError } from '../../packages/common/utils/error.handler.utils';
import {
  uploadToCloudinary,
  updateImageInCloudinary,
  getImageFromCloudinary,
  deleteFromCloudinary,
} from '../../packages/cloudinary/cloudinaryClient';

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.status(200).json(products);
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, price, description } = req.body;
    const file = req.file as Express.Multer.File;

    if (!name || !price || !description) {
      throwError('Name, price, and description are required', 400);
    }

    if (!file) {
      throwError('Image is required', 400);
    }

    const { secure_url, public_id } = await uploadToCloudinary(file.buffer, file.mimetype, 'products');

    const product = await prisma.product.create({
      data: {
        name,
        price: parseFloat(price),
        description,
        image: secure_url,
        cloudinaryId: public_id,
      },
    });

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, price, description } = req.body;
    const file = req.file as Express.Multer.File;

    if (!name || !price || !description) {
      throwError('Name, price, and description are required', 400);
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throwError('Product not found', 404);
      return;
    }

    const updateData: {
      name: string;
      price: number;
      description: string;
      image?: string;
      cloudinaryId?: string;
    } = {
      name,
      price: parseFloat(price),
      description,
    };

    if (file) {
      if (product.cloudinaryId) {
        const imageUrl = await getImageFromCloudinary(product.cloudinaryId);
        console.log(imageUrl);
        const { secure_url } = await updateImageInCloudinary(product.cloudinaryId, file.buffer, file.mimetype);
        updateData.image = secure_url;
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id: product.id },
      data: updateData,
    });
    res.status(200).json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throwError('Product not found', 404);
      return;
    }

    if (product.cloudinaryId) {
      await deleteFromCloudinary(product.cloudinaryId);
    }

    const deletedProduct = await prisma.product.delete({
      where: { id: product.id },
    });
    res.status(204).json(deletedProduct);
  } catch (error) {
    next(error);
  }
};
