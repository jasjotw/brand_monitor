import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getCurrentPlanHandler, getPlanCatalogHandler, selectPlanHandler } from '../controllers/plans.controller';

const router = Router();

router.get('/catalog', requireAuth, getPlanCatalogHandler);
router.get('/current', requireAuth, getCurrentPlanHandler);
router.post('/select', requireAuth, selectPlanHandler);

export default router;
