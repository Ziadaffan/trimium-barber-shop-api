import { Router } from 'express';
import {
  createBarberSchedule,
  deleteBarberSchedule,
  getBarberSchedule,
  updateBarberSchedule,
} from '@/api/controllers/schedule.controller';

const router = Router();

router.get('/barber/:barberId', getBarberSchedule);
router.post('/', createBarberSchedule);
router.put('/:id', updateBarberSchedule);
router.delete('/:id', deleteBarberSchedule);

export const scheduleRoutes = router;
