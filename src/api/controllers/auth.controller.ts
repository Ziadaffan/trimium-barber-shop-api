import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { throwError } from '../../packages/common/utils/error.handler.utils';

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const loginEmail = process.env.LOGIN_EMAIL;
    const loginPassword = process.env.LOGIN_PASSWORD;

    if (email !== loginEmail || password !== loginPassword) {
      throwError('Invalid email or password', 401);
      return;
    }

    if (!process.env.JWT_SECRET) {
      throwError('JWT_SECRET is not set', 500);
      return;
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
};
