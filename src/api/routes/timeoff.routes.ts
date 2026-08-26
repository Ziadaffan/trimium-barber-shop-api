import { Router } from 'express';
import {
  createBarberTimeOff,
  deleteBarberTimeOff,
  getBarberTimeOffs,
  updateBarberTimeOff,
} from '../controllers/schedule.controller';
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Frontend expects these endpoints:
// GET    /timeoffs/barber/:barberId
// POST   /timeoffs/barber/:barberId
// PUT    /timeoffs/barber/:barberId/:timeOffId
// DELETE /timeoffs/barber/:barberId/:timeOffId

router.get('/barber/:barberId', getBarberTimeOffs);

router.post('/barber/:barberId', requireAdmin, createBarberTimeOff);
router.put('/barber/:barberId/:timeOffId', requireAdmin, updateBarberTimeOff);
router.delete('/barber/:barberId/:timeOffId', requireAdmin, deleteBarberTimeOff);

export const timeoffRoutes = router;
