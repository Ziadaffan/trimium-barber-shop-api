import { Router } from 'express';
import { reservationRoutes } from '@/api/routes/reservation.routes';
import { barberRoutes } from '@/api/routes/barber.routes';

const router = Router();

router.use('/reservations', reservationRoutes);
router.use('/barbers', barberRoutes);

export default router;
