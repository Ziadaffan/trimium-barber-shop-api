import { Router } from 'express';
import {
  createBarberSchedule,
  deleteBarberSchedule,
  getBarberSchedule,
  updateBarberSchedule,
} from '../controllers/schedule.controller';

const router = Router();

router.get('/barber/:barberId', getBarberSchedule);
router.post('/barber/:barberId', createBarberSchedule);
router.put('/barber/:barberId/:id', updateBarberSchedule);
router.delete('/barber/:barberId/:id', deleteBarberSchedule);

export const scheduleRoutes = router;
