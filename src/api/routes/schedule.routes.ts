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
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Opening hours are public information: the booking UI needs them to render the calendar.
router.get('/barber/:barberId', getBarberSchedule);
router.get('/barber/:barberId/time-off', getBarberTimeOffs);

router.post('/barber/:barberId', requireAdmin, createBarberSchedule);
router.put('/barber/:barberId/:id', requireAdmin, updateBarberSchedule);
router.delete('/barber/:barberId/:id', requireAdmin, deleteBarberSchedule);

router.post('/barber/:barberId/time-off', requireAdmin, createBarberTimeOff);
router.put('/barber/:barberId/time-off/:id', requireAdmin, updateBarberTimeOff);
router.delete('/barber/:barberId/time-off/:id', requireAdmin, deleteBarberTimeOff);

export const scheduleRoutes = router;
