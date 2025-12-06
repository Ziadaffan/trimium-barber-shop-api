import { NextFunction, Request, Response } from 'express';

export const apiSecureMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey =
      req.headers['x-api-key'] || req.headers['api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key is required',
        error: 'UNAUTHORIZED',
      });
    }

    console.log(apiKey);

    const validApiKey = process.env.API_KEY;

    if (!validApiKey) {
      console.error('API_KEY environment variable is not set');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
        error: 'INTERNAL_SERVER_ERROR',
      });
    }

    if (!constantTimeCompare(apiKey as string, validApiKey)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key',
        error: 'UNAUTHORIZED',
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
