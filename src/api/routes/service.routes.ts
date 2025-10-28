import { createService, deleteService, getServices, updateService } from '@/api/controllers/service.controller';
import { Router } from 'express';

const router = Router();

router.get('/', getServices);
router.post('/', createService);
router.put('/:id', updateService);
router.delete('/:id', deleteService);

export const serviceRoutes = router;
