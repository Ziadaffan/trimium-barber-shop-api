import { NextFunction, Request, Response, Router } from 'express';
import { throwError } from '../../packages/common/utils/error.handler.utils';
import { SIGNATURE_MAX_SKEW_MS, requireAdmin, signApiRequest } from '../middlewares/auth.middleware';

const router = Router();

/**
 * Mints a request signature for a trusted caller.
 *
 * This endpoint hands out credentials, so it must never be public: without `requireAdmin`
 * anyone could sign an arbitrary method/URL and reach every protected route.
 */
router.post('/', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
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

    // Refuse to pre-sign requests for a window we cannot vouch for.
    const numericTimestamp = Number(timestamp);
    if (Number.isNaN(numericTimestamp) || Math.abs(numericTimestamp - Date.now()) > SIGNATURE_MAX_SKEW_MS) {
      throwError('Invalid timestamp', 400);
      return;
    }

    res.status(200).json({ signature: signApiRequest(method, url, timestamp, secret) });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

export default router;
