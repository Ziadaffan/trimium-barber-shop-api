import { Router } from 'express';
import {
  createBarberTimeOff,
  deleteBarberTimeOff,
  getBarberTimeOffs,
  updateBarberTimeOff,
} from '../controllers/schedule.controller';

const router = Router();

// Frontend expects these endpoints:
// GET    /timeoffs/barber/:barberId
// POST   /timeoffs/barber/:barberId
// PUT    /timeoffs/barber/:barberId/:timeOffId
// DELETE /timeoffs/barber/:barberId/:timeOffId

router.get('/barber/:barberId', getBarberTimeOffs);
router.post('/barber/:barberId', createBarberTimeOff);
router.put('/barber/:barberId/:timeOffId', updateBarberTimeOff);
router.delete('/barber/:barberId/:timeOffId', deleteBarberTimeOff);

export const timeoffRoutes = router;

