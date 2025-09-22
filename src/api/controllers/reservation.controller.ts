import { NextFunction, Request, Response } from 'express';

export const getReservations = (req: Request, res: Response, next: NextFunction) => {
  res.json({
    message: 'Hello World',
  });
};
