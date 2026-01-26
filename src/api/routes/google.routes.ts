import { Router } from 'express';
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  checkGoogleAuthStatus,
  handleCalendarWebhook,
  setupWebhook,
  getAvailableCalendars,
} from '../controllers/google.controller';

const router = Router();

router.get('/auth', getGoogleAuthUrl);

router.get('/callback', handleGoogleCallback);

router.get('/status', checkGoogleAuthStatus);

// List available calendars
router.get('/calendars', getAvailableCalendars);

// Webhook endpoint (no auth middleware - Google will call this directly)
router.post('/webhook', handleCalendarWebhook);

// Setup webhook for a calendar
router.post('/webhook/setup', setupWebhook);

export const googleRoutes = router;
