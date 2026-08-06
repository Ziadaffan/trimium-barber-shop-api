import { NextFunction, Request, Response, Router } from 'express';
import { renewExpiredWatches } from '../controllers/google.controller';
import { requireCron } from '../middlewares/auth.middleware';

const router = Router();

const runRenewWatches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await renewExpiredWatches();
    res.status(200).json({ success: true });
    return;
  } catch (error) {
    next(error);
    return;
  }
};

// vercel.json schedules GET /api/cron/renew-watches; POST is kept for manual runs.
router.get('/renew-watches', requireCron, runRenewWatches);
router.post('/renew-watches', requireCron, runRenewWatches);

export const cronRoutes = router;
