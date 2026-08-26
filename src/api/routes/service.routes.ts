import { createService, deleteService, getServices, updateService } from '../controllers/service.controller';
import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', getServices);

router.post('/', requireAdmin, createService);
router.put('/:id', requireAdmin, updateService);
router.delete('/:id', requireAdmin, deleteService);

export const serviceRoutes = router;
