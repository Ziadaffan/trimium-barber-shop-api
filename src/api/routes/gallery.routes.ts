import { Router } from 'express';
import { createGallery, deleteGallery, getGalleries, updateGallery } from '../controllers/gallery.contoller';
import { uploadSingle } from '../middlewares/upload.middleware';

const router = Router();

router.get('/', getGalleries);
router.post('/', uploadSingle, createGallery);
router.put('/:id', uploadSingle, updateGallery);
router.delete('/:id', deleteGallery);

export const galleryRoutes = router;
