import { Router } from 'express';
import {
  createReservation,
  deleteReservation,
  getAvailableTimes,
  getReservations,
  updateReservation,
} from '../controllers/reservation.controller';

const router = Router();

router.get('/', getReservations);
router.get('/available-times', getAvailableTimes);
router.post('/', createReservation);
router.put('/:id', updateReservation);
router.delete('/:id', deleteReservation);

export const reservationRoutes = router;
