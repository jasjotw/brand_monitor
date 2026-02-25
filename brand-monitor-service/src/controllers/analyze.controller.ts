// ─────────────────────────────────────────────────────────────
// src/controllers/analyze.controller.ts
// Source: WebApp/app/api/brand-monitor/analyze/route.ts
//
// POST /api/brand-monitor/analyze   (SSE stream)
//
// The response is an unbuffered Server-Sent Events stream.
// The full analysis pipeline runs inside an async IIFE so the
// route returns the SSE headers immediately while the work
// happens in the background.
// ─────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import { performAnalysis } from '../services/analysis.service';
import { checkCredits, trackCredits, getRemainingCredits } from '../services/credit.service';
import { getBrandLocation } from '../services/brand.service';
import { createSSEMessage } from '../utils/sse.utils';
import { handleApiError, AuthenticationError, ValidationError } from '../utils/errors';
import { CREDITS_PER_BRAND_ANALYSIS, ERROR_MESSAGES } from '../config/constants';
import { SSEEvent, Company } from '../types';

// ── Controller ───────────────────────────────────────────────

export async function analyzeHandler(req: Request, res: Response): Promise<void> {
    const userId: string = res.locals.user.id;

    // ── 1. Credit check ───────────────────────────────────────
    try {
        await checkCredits(userId, CREDITS_PER_BRAND_ANALYSIS, '[Analyze]');
    } catch (err) {
        handleApiError(err, res);
        return;
    }

    // ── 2. Parse & validate body ──────────────────────────────
    const {
        company: rawCompany,
        prompts,
        competitors: userSelectedCompetitors,
        useWebSearch = false,
    } = req.body as {
        company?: Partial<Company>;
        prompts?: any[];
        competitors?: { name?: string; url?: string }[];
        useWebSearch?: boolean;
    };

    if (!rawCompany || !rawCompany.name) {
        res.status(400).json({
            error: {
                message: ERROR_MESSAGES.COMPANY_INFO_REQUIRED,
                code: 'VALIDATION_ERROR',
                statusCode: 400,
                timestamp: new Date().toISOString(),
            },
        });
        return;
    }

    // ── 3. Enrich company with stored location (if available) ─
    const company = { ...rawCompany } as Company;

    if (company.url) {
        let normalizedUrl = company.url.trim();
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = `https://${normalizedUrl}`;
        }

        if (normalizedUrl) {
            const location = await getBrandLocation(userId, normalizedUrl).catch(() => undefined);
            if (location) company.location = location;
        }
    }

    // ── 4. Track credits ──────────────────────────────────────
    try {
        await trackCredits(userId, CREDITS_PER_BRAND_ANALYSIS, '[Analyze]');
    } catch (err) {
        handleApiError(err, res);
        return;
    }

    // ── 5. Get remaining balance (informational) ──────────────
    const remainingCredits = await getRemainingCredits(userId, '[Analyze]');

    // ── 6. Configure SSE headers ──────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx: disable buffering
    res.flushHeaders();

    // ── 7. SSE sender ─────────────────────────────────────────
    const sendEvent = async (event: SSEEvent): Promise<void> => {
        const data = createSSEMessage(event);
        // res.write returns false when the client has disconnected
        const ok = res.write(data);
        if (!ok) {
            // Back-pressure: wait for drain
            await new Promise<void>((resolve) => res.once('drain', resolve));
        }
    };

    // ── 8. Async pipeline (non-blocking) ─────────────────────
    (async () => {
        try {
            // Send initial credit information
            await sendEvent({
                type: 'credits',
                stage: 'credits',
                data: { remainingCredits, creditsUsed: CREDITS_PER_BRAND_ANALYSIS },
                timestamp: new Date(),
            });

            // Run the full analysis pipeline
            const analysisResult = await performAnalysis({
                company,
                prompts,
                userSelectedCompetitors,
                useWebSearch,
                sendEvent,
            });

            // Emit completion event
            await sendEvent({
                type: 'complete',
                stage: 'finalizing',
                data: { analysis: analysisResult },
                timestamp: new Date(),
            });
        } catch (error) {
            console.error('[Analyze] Pipeline error:', error);

            try {
                await sendEvent({
                    type: 'error',
                    stage: 'error',
                    data: { message: error instanceof Error ? error.message : 'Analysis failed' },
                    timestamp: new Date(),
                });
            } catch {
                // Client already gone — nothing we can do
            }
        } finally {
            res.end();
        }
    })();

    // Handle client disconnect
    req.on('close', () => {
        console.log('[Analyze] Client disconnected');
        res.end();
    });
}
