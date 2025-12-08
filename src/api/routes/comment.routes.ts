import { Router } from 'express';
import { createComment } from '../controllers/comment.controller';

const router = Router();

router.post('/', createComment);

export const commentRoutes = router;