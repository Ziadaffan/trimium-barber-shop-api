import { Router } from 'express';
import { createProduct, deleteProduct, getProducts, updateProduct } from '../controllers/product.controller';
import { uploadSingle } from '../middlewares/upload.middleware';
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', getProducts);

router.post('/', requireAdmin, uploadSingle, createProduct);
router.put('/:id', requireAdmin, uploadSingle, updateProduct);
router.delete('/:id', requireAdmin, deleteProduct);

export default router;
