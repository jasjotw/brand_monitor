import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
    dashboardAnalyticsHandler,
    overviewAnalyticsHandler,
    visibilityAnalyticsHandler,
    competitorsAnalyticsHandler,
    promptsAnalyticsHandler,
    alertsAnalyticsHandler,
    sourcesAnalyticsHandler,
    diagnosticsAnalyticsHandler,
} from '../controllers/analytics.controller';

const router = Router();

router.get('/dashboard', requireAuth, dashboardAnalyticsHandler);
router.get('/overview', requireAuth, overviewAnalyticsHandler);
router.get('/visibility', requireAuth, visibilityAnalyticsHandler);
router.get('/competitors', requireAuth, competitorsAnalyticsHandler);
router.get('/prompts', requireAuth, promptsAnalyticsHandler);
router.get('/alerts', requireAuth, alertsAnalyticsHandler);
router.get('/sources', requireAuth, sourcesAnalyticsHandler);
router.get('/diagnostics', requireAuth, diagnosticsAnalyticsHandler);

export default router;
