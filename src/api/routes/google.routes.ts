import { Router } from 'express';
import { getGoogleAuthUrl, handleGoogleCallback, checkGoogleAuthStatus } from '../controllers/google.controller';

const router = Router();

router.get('/auth', getGoogleAuthUrl);

router.get('/callback', handleGoogleCallback);

router.get('/status', checkGoogleAuthStatus);

export const googleRoutes = router;
