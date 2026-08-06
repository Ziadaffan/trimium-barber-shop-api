import { Router } from 'express';
import {
  cancelReservationFromEmail,
  createReservation,
  deleteReservation,
  getAvailableTimes,
  getReservations,
  renderCancelReservationPage,
  updateReservation,
} from '../controllers/reservation.controller';
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

// --- Public: the booking flow of the website ---
router.get('/available-times', getAvailableTimes);
router.post('/', createReservation);

// Public but signed: cancellation links sent in the confirmation email.
// GET only renders a confirmation page so that email link pre-fetching cannot cancel anything.
router.get('/cancel', renderCancelReservationPage);
router.post('/cancel', cancelReservationFromEmail);

// --- Admin only: exposes or mutates client data ---
router.get('/', requireAdmin, getReservations);
router.put('/:id', requireAdmin, updateReservation);
router.delete('/:id', requireAdmin, deleteReservation);

export const reservationRoutes = router;
