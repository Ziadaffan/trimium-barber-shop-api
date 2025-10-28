import { Router } from 'express';
import { reservationRoutes } from '@/api/routes/reservation.routes';
import { barberRoutes } from '@/api/routes/barber.routes';
import { serviceRoutes } from '@/api/routes/service.routes';
import { scheduleRoutes } from '@/api/routes/schedule.routes';

const router = Router();

router.use('/reservations', reservationRoutes);
router.use('/barbers', barberRoutes);
router.use('/services', serviceRoutes);
router.use('/schedules', scheduleRoutes);

export default router;
