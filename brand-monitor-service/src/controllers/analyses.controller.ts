// ─────────────────────────────────────────────────────────────
// src/controllers/analyses.controller.ts
// Sources:
//   - WebApp/app/api/brand-monitor/analyses/route.ts          (list + create)
//   - WebApp/app/api/brand-monitor/analyses/[analysisId]/route.ts (get + delete)
//
// GET    /api/brand-monitor/analyses
// POST   /api/brand-monitor/analyses
// GET    /api/brand-monitor/analyses/:analysisId
// DELETE /api/brand-monitor/analyses/:analysisId
// ─────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import {
    listAnalyses,
    getAnalysisById,
    createAnalysis,
    deleteAnalysis,
    CreateAnalysisInput,
} from '../services/analysis-crud.service';
import { handleApiError, ValidationError } from '../utils/errors';
import { isSuperuser } from '../middleware/auth.middleware';

// ── List ──────────────────────────────────────────────────────

/**
 * GET /api/brand-monitor/analyses
 * Returns all analyses for the authenticated user
 * (superusers see all analyses).
 *
 * Response: raw array — matches NextResponse.json(analyses) in the original.
 */
export async function listAnalysesHandler(req: Request, res: Response): Promise<void> {
    try {
        const user = res.locals.user;
        const admin = isSuperuser(user.email);

        const analyses = await listAnalyses(user.id, admin);
        // Original returns the array directly, not wrapped in { analyses: [] }
        res.json(analyses);
    } catch (error) {
        handleApiError(error, res);
    }
}

// ── Create ────────────────────────────────────────────────────

/**
 * POST /api/brand-monitor/analyses
 * Saves a new brand analysis.
 *
 * Body shape (matches original route exactly):
 *   {
 *     url: string,
 *     analysisData: object,      ← required
 *     companyName?: string,
 *     industry?: string,
 *     competitors?: unknown,
 *     prompts?: unknown,
 *     creditsUsed?: number,
 *   }
 */
export async function createAnalysisHandler(req: Request, res: Response): Promise<void> {
    try {
        const user = res.locals.user;
        const body = req.body as {
            url?: string;
            analysisData?: unknown;
            companyName?: string;
            industry?: string;
            competitors?: unknown;
            prompts?: unknown;
            creditsUsed?: number;
            brandId?: string;
        };

        // Match original validation: url AND analysisData are required
        if (!body.url || !body.analysisData) {
            throw new ValidationError('Invalid request', {
                ...(body.url ? {} : { url: 'URL is required' }),
                ...(body.analysisData ? {} : { analysisData: 'Analysis data is required' }),
            });
        }

        const input: CreateAnalysisInput = {
            userId: user.id,
            url: body.url,
            companyName: body.companyName,
            industry: body.industry,
            analysisData: body.analysisData,
            competitors: body.competitors,
            prompts: body.prompts,
            creditsUsed: body.creditsUsed ?? 10,
            brandId: body.brandId,
        };

        const analysis = await createAnalysis(input);
        // Original returns the analysis row directly with 200 (NextResponse.json(analysis))
        res.json(analysis);
    } catch (error) {
        handleApiError(error, res);
    }
}

// ── Get by ID ─────────────────────────────────────────────────

/**
 * GET /api/brand-monitor/analyses/:analysisId
 * Returns a single analysis; superusers can access any analysis.
 *
 * Response: raw analysis object — matches NextResponse.json(analysis).
 */
export async function getAnalysisHandler(req: Request, res: Response): Promise<void> {
    try {
        const user = res.locals.user;
        const { analysisId } = req.params;
        const id = String(analysisId ?? '');

        if (!id) {
            throw new ValidationError('Missing analysis ID', { analysisId: 'Analysis ID is required' });
        }

        const admin = isSuperuser(user.email);
        const analysis = await getAnalysisById(id, user.id, admin);

        // Original returns raw object: NextResponse.json(analysis)
        res.json(analysis);
    } catch (error) {
        handleApiError(error, res);
    }
}

// ── Delete ────────────────────────────────────────────────────

/**
 * DELETE /api/brand-monitor/analyses/:analysisId
 * Permanently deletes the analysis owned by the authenticated user.
 *
 * Response: { success: true } — matches original NextResponse.json({ success: true }).
 */
export async function deleteAnalysisHandler(req: Request, res: Response): Promise<void> {
    try {
        const user = res.locals.user;
        const { analysisId } = req.params;
        const id = String(analysisId ?? '');

        if (!id) {
            throw new ValidationError('Missing analysis ID', { analysisId: 'Analysis ID is required' });
        }

        await deleteAnalysis(id, user.id);
        // Match original: NextResponse.json({ success: true })
        res.json({ success: true });
    } catch (error) {
        handleApiError(error, res);
    }
}
