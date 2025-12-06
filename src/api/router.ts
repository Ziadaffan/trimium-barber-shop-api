import { Router } from 'express';
import { reservationRoutes } from './routes/reservation.routes';
import { barberRoutes } from './routes/barber.routes';
import { serviceRoutes } from './routes/service.routes';
import { scheduleRoutes } from './routes/schedule.routes';

const router = Router();

router.use('/reservations', reservationRoutes);
router.use('/barbers', barberRoutes);
router.use('/services', serviceRoutes);
router.use('/schedules', scheduleRoutes);

export default router;
