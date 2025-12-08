import { Router } from 'express';
import { reservationRoutes } from './routes/reservation.routes';
import { barberRoutes } from './routes/barber.routes';
import { serviceRoutes } from './routes/service.routes';
import { scheduleRoutes } from './routes/schedule.routes';
import productRoutes from './routes/product.routes';
import { googleRoutes } from './routes/google.routes';
import { commentRoutes } from './routes/comment.routes';
import { galleryRoutes } from './routes/gallery.routes';

const router = Router();

router.use('/reservations', reservationRoutes);
router.use('/barbers', barberRoutes);
router.use('/services', serviceRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/products', productRoutes);
router.use('/google', googleRoutes);
router.use('/comments', commentRoutes);
router.use('/gallery', galleryRoutes);

export default router;
