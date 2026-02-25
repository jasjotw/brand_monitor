// ─────────────────────────────────────────────────────────────
// src/routes/analyze.routes.ts
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { analyzeHandler } from '../controllers/analyze.controller';

const router = Router();

/**
 * POST /api/brand-monitor/analyze
 * Initiates an SSE brand analysis stream.
 */
router.post('/', requireAuth, analyzeHandler);

export default router;
