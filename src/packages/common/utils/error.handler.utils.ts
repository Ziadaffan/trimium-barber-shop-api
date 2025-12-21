import { logger } from '../logger';

export const throwError = (message: string, status: number) => {
  const error = new Error(message) as any;
  logger.error(error);
  error.statusCode = status;
  throw error;
};
