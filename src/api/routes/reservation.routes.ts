import { Router } from 'express';
import {
  createReservation,
  deleteReservation,
  getReservations,
  updateReservation,
} from '@/api/controllers/reservation.controller';

const router = Router();

router.get('/', getReservations);
router.post('/', createReservation);
router.put('/:id', updateReservation);
router.delete('/:id', deleteReservation);

export const reservationRoutes = router;
