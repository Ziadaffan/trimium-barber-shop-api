import { createBarber, deleteBarber, getBarbers, updateBarber } from '../controllers/barber.controller';
import { Router } from 'express';
import { uploadSingle } from '../middlewares/upload.middleware';

const router = Router();

router.get('/', getBarbers);
router.post('/', uploadSingle, createBarber);
router.put('/:id', uploadSingle, updateBarber);
router.delete('/:id', deleteBarber);

export const barberRoutes = router;
