import { throwError } from '@/packages/common/utils/error.handler.utils';
import prisma from '@/packages/lib/db';
import { NextFunction, Request, Response } from 'express';

export const createComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !message) {
      throwError('All fields are required', 400);
      return;
    }

    await prisma.comment.create({
      data: { name, email, comment: message },
    });

    res.status(201).json({ message: 'Comment created successfully' });
  } catch (error) {
    next(error);
  }
};
