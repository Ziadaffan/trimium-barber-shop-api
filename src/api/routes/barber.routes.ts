import { getBarbers } from '@/api/controllers/barber.controller';
import { Router } from 'express';

const router = Router();

router.get('/', getBarbers);

export const barberRoutes = router;
