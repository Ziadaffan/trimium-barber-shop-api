import { Router } from 'express';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  checkGoogleAuthStatus,
  handleCalendarWebhook,
  setupWebhook,
  getAvailableCalendars,
} from '../controllers/google.controller';
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Admin only: these start the OAuth flow, expose calendar metadata or change subscriptions.
router.get('/auth', requireAdmin, getGoogleAuthUrl);
router.get('/status', requireAdmin, checkGoogleAuthStatus);
router.get('/calendars', requireAdmin, getAvailableCalendars);
router.post('/webhook/setup', requireAdmin, setupWebhook);

// Public by necessity, both are called by Google itself.
// The callback is guarded by the signed `state` that only /auth can mint.
router.get('/callback', handleGoogleCallback);
router.post('/webhook', handleCalendarWebhook);

export const googleRoutes = router;
