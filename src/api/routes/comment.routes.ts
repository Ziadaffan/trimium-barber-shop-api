import { Router } from 'express';
import { createComment, deleteComment, getComments } from '../controllers/comment.controller';
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', getComments);
router.post('/', createComment);

router.delete('/:id', requireAdmin, deleteComment);

export const commentRoutes = router;
