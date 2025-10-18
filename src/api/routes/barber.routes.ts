import { createBarber, deleteBarber, getBarbers, updateBarber } from '@/api/controllers/barber.controller';
import { Router } from 'express';

const router = Router();

router.get('/', getBarbers);
router.post('/', createBarber);
router.put('/:id', updateBarber);
router.delete('/:id', deleteBarber);

export const barberRoutes = router;
