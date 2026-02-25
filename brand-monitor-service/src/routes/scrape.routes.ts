// ─────────────────────────────────────────────────────────────
// src/routes/scrape.routes.ts
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { scrapeHandler } from '../controllers/scrape.controller';

const router = Router();

/**
 * POST /api/brand-monitor/scrape
 * Scrapes a company URL and returns structured company info + generated prompts.
 */
router.post('/', requireAuth, scrapeHandler);

export default router;
