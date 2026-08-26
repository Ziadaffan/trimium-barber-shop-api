import { Router } from 'express';
import { createGallery, deleteGallery, getGalleries, updateGallery } from '../controllers/gallery.contoller';
import { uploadSingle } from '../middlewares/upload.middleware';
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', getGalleries);

router.post('/', requireAdmin, uploadSingle, createGallery);
router.put('/:id', requireAdmin, uploadSingle, updateGallery);
router.delete('/:id', requireAdmin, deleteGallery);

export const galleryRoutes = router;
