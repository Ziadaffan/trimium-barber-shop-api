import { Router } from 'express';
import { reservationRoutes } from './routes/reservation.routes';
import { barberRoutes } from './routes/barber.routes';
import { serviceRoutes } from './routes/service.routes';
import { scheduleRoutes } from './routes/schedule.routes';
import { timeoffRoutes } from './routes/timeoff.routes';
import productRoutes from './routes/product.routes';
import { googleRoutes } from './routes/google.routes';
import { commentRoutes } from './routes/comment.routes';
import { galleryRoutes } from './routes/gallery.routes';
import { apiSecureMiddleware } from './middlewares/api-secure.middleware';
import signatureRoutes from './routes/signature.routes';
import { authRoutes } from './routes/auth.routes';
const router = Router();

router.use('/reservations', reservationRoutes);
router.use('/barbers', barberRoutes);
router.use('/services', serviceRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/timeoffs', timeoffRoutes);
router.use('/products', productRoutes);
router.use('/google', googleRoutes);
router.use('/comments', commentRoutes);
router.use('/gallery', galleryRoutes);
router.use('/signature', signatureRoutes);
router.use('/auth', authRoutes);

export default router;
