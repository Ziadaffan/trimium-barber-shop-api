import { Router } from 'express';
import { createComment, deleteComment, getComments } from '../controllers/comment.controller';

const router = Router();

router.get('/', getComments);
router.post('/', createComment);
router.delete('/:id', deleteComment);
export const commentRoutes = router;
