import { Router } from 'express';
import { getGallery } from '../controllers/gallery.contoller';

const router = Router();

router.get('/', getGallery);

export const galleryRoutes = router;