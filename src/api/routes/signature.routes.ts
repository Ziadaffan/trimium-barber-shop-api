import { NextFunction, Request, Response, Router } from 'express';
import crypto from 'crypto';
import { throwError } from '../../packages/common/utils/error.handler.utils';

const router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = process.env.API_SECRET;
    if (!secret) {
      throwError('Server misconfiguration: API_SECRET is missing', 500);
      return;
    }

    const { method, url, timestamp } = (req.body ?? {}) as Partial<{
      method: string;
      url: string;
      timestamp: string | number;
    }>;

    if (!method || !url || timestamp === undefined) {
      throwError('Invalid body. Expected: { method, url, timestamp }', 400);
      return;
    }

    const payload = `${method.toUpperCase()}\n${url}\n${timestamp}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    res.status(200).json({ signature });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

export default router;
