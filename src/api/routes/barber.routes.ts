import { createBarber, deleteBarber, getBarbers, updateBarber } from '../controllers/barber.controller';
import { Router } from 'express';
import { uploadSingle } from '../middlewares/upload.middleware';
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', getBarbers);

router.post('/', requireAdmin, uploadSingle, createBarber);
router.put('/:id', requireAdmin, uploadSingle, updateBarber);
router.delete('/:id', requireAdmin, deleteBarber);

export const barberRoutes = router;
