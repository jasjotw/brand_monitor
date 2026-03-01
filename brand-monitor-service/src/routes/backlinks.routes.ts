import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { currentBacklinksHandler, refreshBacklinksHandler } from '../controllers/backlinks.controller';

const router = Router();

router.get('/current', requireAuth, currentBacklinksHandler);
router.post('/refresh', requireAuth, refreshBacklinksHandler);

export default router;
