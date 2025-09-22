import { Router } from 'express';
import { getReservations } from '@/api/controllers/reservation.controller';


const router = Router();

router.get('/', getReservations);

export const reservationRoutes = router;
