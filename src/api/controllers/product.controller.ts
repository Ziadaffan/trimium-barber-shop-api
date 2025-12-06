import prisma from '../../packages/lib/db';
import { NextFunction, Request, Response } from 'express';
import { throwError } from '../../packages/common/utils/error.handler.utils';

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany();
    res.status(200).json({
      products,
    });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, price, description, images } = req.body;

    if (!name || !price || !description || !images) {
      throwError('All fields are required', 400);
    }

    const product = await prisma.product.create({
      data: { name, price, description, images },
    });
    res.status(201).json({
      product,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, price, description, images } = req.body;

    if (!name || !price || !description || !images) {
      throwError('All fields are required', 400);
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throwError('Product not found', 404);
      return;
    }

    const updatedProduct = await prisma.product.update({
      where: { id: product.id },
      data: { name, price, description, images },
    });
    res.status(200).json({
      product: updatedProduct,
    });
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

    const deletedProduct = await prisma.product.delete({
      where: { id: product.id },
    });
    res.status(204).json({
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
