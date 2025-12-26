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
const router = Router();

router.use('/reservations', apiSecureMiddleware, reservationRoutes);
router.use('/barbers', apiSecureMiddleware, barberRoutes);
router.use('/services', apiSecureMiddleware, serviceRoutes);
router.use('/schedules', apiSecureMiddleware, scheduleRoutes);
router.use('/timeoffs', apiSecureMiddleware, timeoffRoutes);
router.use('/products', apiSecureMiddleware, productRoutes);
router.use('/google', googleRoutes);
router.use('/comments', apiSecureMiddleware, commentRoutes);
router.use('/gallery', apiSecureMiddleware, galleryRoutes);
router.use('/signature', signatureRoutes);

export default router;
