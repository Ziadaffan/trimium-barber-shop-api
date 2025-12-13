import { Router } from 'express';
import { createProduct, deleteProduct, getProducts, updateProduct } from '../controllers/product.controller';
import { uploadSingle } from '../middlewares/upload.middleware';

const router = Router();

router.get('/', getProducts);
router.post('/', uploadSingle, createProduct);
router.put('/:id', uploadSingle, updateProduct);
router.delete('/:id', deleteProduct);

export default router;
