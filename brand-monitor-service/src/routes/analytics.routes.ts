import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePlanFeature } from '../middleware/plan-feature.middleware';
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

router.get('/dashboard', requireAuth, requirePlanFeature('api.analytics'), dashboardAnalyticsHandler);
router.get('/overview', requireAuth, requirePlanFeature('api.analytics'), overviewAnalyticsHandler);
router.get('/visibility', requireAuth, requirePlanFeature('api.analytics'), visibilityAnalyticsHandler);
router.get('/competitors', requireAuth, requirePlanFeature('api.analytics'), competitorsAnalyticsHandler);
router.get('/prompts', requireAuth, requirePlanFeature('api.analytics'), promptsAnalyticsHandler);
router.get('/alerts', requireAuth, requirePlanFeature('api.analytics'), alertsAnalyticsHandler);
router.get('/sources', requireAuth, requirePlanFeature('api.analytics'), sourcesAnalyticsHandler);
router.get('/diagnostics', requireAuth, requirePlanFeature('api.analytics'), diagnosticsAnalyticsHandler);

export default router;
