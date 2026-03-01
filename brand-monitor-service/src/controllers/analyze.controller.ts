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
import { findExistingBrand, getBrandLocation } from '../services/brand.service';
import { createSSEMessage } from '../utils/sse.utils';
import { handleApiError, AuthenticationError, ValidationError } from '../utils/errors';
import { CREDITS_PER_BRAND_ANALYSIS, ERROR_MESSAGES } from '../config/constants';
import { SSEEvent, Company, Persona, IdealCustomerProfile } from '../types';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { audienceProfiles } from '../db/schema';
import { createAnalysis, updateAnalysis } from '../services/analysis-crud.service';

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
    let baseQuery: string | undefined;
    let personas: Persona[] | undefined;
    let icp: IdealCustomerProfile | undefined;
    let brandId: string | undefined;

    if (company.url) {
        let normalizedUrl = company.url.trim();
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = `https://${normalizedUrl}`;
        }

        if (normalizedUrl) {
            const location = await getBrandLocation(userId, normalizedUrl).catch(() => undefined);
            if (location) company.location = location;

            const brand = await findExistingBrand(userId, normalizedUrl).catch(() => null);
            if (brand?.id) {
                brandId = brand.id;
                const [audience] = await db
                    .select({
                        additionalInputs: audienceProfiles.additionalInputs,
                        personas: audienceProfiles.personas,
                        icp: audienceProfiles.icp,
                    })
                    .from(audienceProfiles)
                    .where(
                        and(
                            eq(audienceProfiles.userId, userId),
                            eq(audienceProfiles.brandId, brand.id),
                        ),
                    )
                    .limit(1);

                const raw = audience?.additionalInputs as Record<string, unknown> | undefined;
                const stored = typeof raw?.baseQuery === 'string' ? raw.baseQuery.trim() : '';
                const deleted = raw?.baseQueryDeleted === true || raw?.baseQueryDeleted === 'true';
                if (stored && !deleted) baseQuery = stored;

                if (Array.isArray(audience?.personas) && audience.personas.length > 0) {
                    personas = audience.personas as Persona[];
                }
                if (audience?.icp && typeof audience.icp === 'object') {
                    icp = audience.icp as IdealCustomerProfile;
                }
            }
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
            let analysisId: string | undefined;

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
                personas,
                icp,
                baseQuery,
                userSelectedCompetitors,
                useWebSearch,
                onPromptsReady: async ({ prompts: generatedPrompts, competitors }) => {
                    const draftAnalysisData = {
                        status: 'in_progress',
                        company,
                        knownCompetitors: competitors,
                        prompts: generatedPrompts,
                        responses: [],
                        useWebSearch,
                        startedAt: new Date().toISOString(),
                    };

                    const row = await createAnalysis({
                        userId,
                        brandId,
                        url: company.url,
                        companyName: company.name,
                        industry: company.industry,
                        analysisData: draftAnalysisData,
                        competitors,
                        prompts: generatedPrompts,
                        creditsUsed: CREDITS_PER_BRAND_ANALYSIS,
                    });
                    analysisId = row.id;
                },
                onResponseReady: async ({ responses, competitors }) => {
                    if (!analysisId) return;
                    await updateAnalysis({
                        analysisId,
                        userId,
                        companyName: company.name,
                        industry: company.industry,
                        competitors,
                        analysisData: {
                            status: 'in_progress',
                            company,
                            knownCompetitors: competitors,
                            responses,
                            useWebSearch,
                            updatedAt: new Date().toISOString(),
                        },
                    });
                },
                sendEvent,
            });

            if (analysisId) {
                await updateAnalysis({
                    analysisId,
                    userId,
                    companyName: company.name,
                    industry: company.industry,
                    competitors: analysisResult.knownCompetitors,
                    prompts: analysisResult.prompts,
                    analysisData: {
                        ...analysisResult,
                        status: 'completed',
                        completedAt: new Date().toISOString(),
                    },
                });
            }

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
