import { Router } from 'express';
import {
  createBarberSchedule,
  createBarberTimeOff,
  deleteBarberSchedule,
  deleteBarberTimeOff,
  getBarberSchedule,
  getBarberTimeOffs,
  updateBarberSchedule,
  updateBarberTimeOff,
} from '../controllers/schedule.controller';

const router = Router();

router.get('/barber/:barberId', getBarberSchedule);
router.post('/barber/:barberId', createBarberSchedule);
router.put('/barber/:barberId/:id', updateBarberSchedule);
router.delete('/barber/:barberId/:id', deleteBarberSchedule);

router.get('/barber/:barberId/time-off', getBarberTimeOffs);
router.post('/barber/:barberId/time-off', createBarberTimeOff);
router.put('/barber/:barberId/time-off/:id', updateBarberTimeOff);
router.delete('/barber/:barberId/time-off/:id', deleteBarberTimeOff);

export const scheduleRoutes = router;
