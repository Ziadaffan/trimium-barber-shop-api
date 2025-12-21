import { NextFunction, Request, Response } from 'express';
import { logger } from '../../packages/common/logger';

export const errorHandlerMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const errStatus = (err as any).statusCode || 500;
  const errMsg = (err as any).message || 'Something went wrong';

  logger.error(err);

  res.status(errStatus).json({
    success: false,
    status: errStatus,
    message: errMsg,
  });
};
