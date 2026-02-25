// ─────────────────────────────────────────────────────────────
// src/routes/analyses.routes.ts
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
    listAnalysesHandler,
    createAnalysisHandler,
    getAnalysisHandler,
    deleteAnalysisHandler,
} from '../controllers/analyses.controller';

const router = Router();

// Collection endpoints
router.get('/', requireAuth, listAnalysesHandler);
router.post('/', requireAuth, createAnalysisHandler);

// Single-item endpoints
router.get('/:analysisId', requireAuth, getAnalysisHandler);
router.delete('/:analysisId', requireAuth, deleteAnalysisHandler);

export default router;
