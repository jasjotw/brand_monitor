import { Request, Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { performAnalysis } from '../services/analysis.service';
import {
    captureFeatureCredits,
    checkCredits,
    estimateFeatureCost,
    getFeatureUnitCost,
    getRemainingCredits,
    reconcileReservationAfterError,
    reserveFeatureCredits,
} from '../services/credit.service';
import { findExistingBrand, getBrandLocation } from '../services/brand.service';
import { createSSEMessage } from '../utils/sse.utils';
import { handleApiError } from '../utils/errors';
import { ERROR_MESSAGES } from '../config/constants';
import { SSEEvent, Company, Persona, IdealCustomerProfile } from '../types';
import { db } from '../db/client';
import { audienceProfiles, brandAnalyses } from '../db/schema';
import { createAnalysis, updateAnalysis } from '../services/analysis-crud.service';
import { logMethodEntry } from '../utils/logger';

function normalizePromptKey(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeDraftPrompts(value: unknown): Array<{ id?: string; prompt: string; [key: string]: unknown }> {
    if (!Array.isArray(value)) return [];
    const normalized: Array<{ id?: string; prompt: string; [key: string]: unknown }> = [];
    for (const entry of value) {
        if (!entry || typeof entry !== 'object') continue;
        const candidate = entry as Record<string, unknown>;
        const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim() : '';
        if (!prompt) continue;
        normalized.push({
            ...candidate,
            id: typeof candidate.id === 'string' ? candidate.id : undefined,
            prompt,
        });
    }
    return normalized;
}

async function removeRunningPromptsFromDraft(input: {
    userId: string;
    brandId: string;
    runPrompts: unknown;
}): Promise<void> {
    const runPromptList = normalizeDraftPrompts(input.runPrompts);
    if (runPromptList.length === 0) return;

    const [latestDraft] = await db
        .select()
        .from(brandAnalyses)
        .where(and(eq(brandAnalyses.userId, input.userId), eq(brandAnalyses.brandId, input.brandId)))
        .orderBy(desc(brandAnalyses.updatedAt), desc(brandAnalyses.createdAt))
        .limit(20);

    if (!latestDraft) return;
    const status = (latestDraft.analysisData as Record<string, unknown> | null)?.status;
    if (status !== 'prompt_draft') return;

    const draftPrompts = normalizeDraftPrompts(latestDraft.draftPrompts);
    if (draftPrompts.length === 0) return;

    const runIds = new Set(
        runPromptList
            .map((prompt) => (typeof prompt.id === 'string' ? prompt.id.trim() : ''))
            .filter(Boolean),
    );
    const runTexts = new Set(runPromptList.map((prompt) => normalizePromptKey(prompt.prompt)));

    const remaining = draftPrompts.filter((prompt) => {
        const byId = typeof prompt.id === 'string' && prompt.id.trim() && runIds.has(prompt.id.trim());
        const byText = runTexts.has(normalizePromptKey(prompt.prompt));
        return !(byId || byText);
    });

    if (remaining.length === draftPrompts.length) return;

    const existingAnalysisData =
        latestDraft.analysisData && typeof latestDraft.analysisData === 'object'
            ? (latestDraft.analysisData as Record<string, unknown>)
            : {};
    const existingPromptMeta =
        existingAnalysisData.promptDraftMeta && typeof existingAnalysisData.promptDraftMeta === 'object'
            ? (existingAnalysisData.promptDraftMeta as Record<string, unknown>)
            : {};

    await updateAnalysis({
        analysisId: latestDraft.id,
        userId: input.userId,
        draftPrompts: remaining,
        analysisData: {
            ...existingAnalysisData,
            status: 'prompt_draft',
            promptDraftMeta: {
                ...existingPromptMeta,
                updatedAt: new Date().toISOString(),
                removedForRun: runPromptList.length,
            },
        },
    });
}

export async function analyzeHandler(req: Request, res: Response): Promise<void> {
    logMethodEntry('analyze.analyzeHandler');
    const userId: string = res.locals.user.id;

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

    const providedPromptCount = Array.isArray(prompts)
        ? prompts.filter((p) => typeof p?.prompt === 'string' && p.prompt.trim()).length
        : 0;
    const estimatedPromptCount = providedPromptCount > 0 ? providedPromptCount : 5;
    const estimatedRunCredits = estimateFeatureCost('prompt_run', estimatedPromptCount);

    try {
        await checkCredits(userId, estimatedRunCredits, '[Analyze]');
    } catch (err) {
        handleApiError(err, res);
        return;
    }

    let reservationId = '';
    try {
        const reservation = await reserveFeatureCredits({
            userId,
            featureCode: 'prompt_run',
            quantity: estimatedPromptCount,
            referenceType: 'analysis',
            referenceId: rawCompany.id ? String(rawCompany.id) : undefined,
            metadata: { estimatedRunCredits, estimatedPromptCount },
            logTag: '[Analyze]',
        });
        reservationId = reservation.reservationId;
    } catch (err) {
        handleApiError(err, res);
        return;
    }

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

                await removeRunningPromptsFromDraft({
                    userId,
                    brandId,
                    runPrompts: prompts,
                }).catch((error) => {
                    console.warn('[Analyze] Failed to sync draft prompts before run:', error);
                });
            }
        }
    }

    const remainingCredits = await getRemainingCredits(userId, '[Analyze]');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = async (event: SSEEvent): Promise<void> => {
        const data = createSSEMessage(event);
        const ok = res.write(data);
        if (!ok) {
            await new Promise<void>((resolve) => res.once('drain', resolve));
        }
    };

    (async () => {
        let deductedRunCredits = 0;
        const runStartedAt = new Date();
        try {
            let analysisId: string | undefined;

            await sendEvent({
                type: 'credits',
                stage: 'credits',
                data: {
                    remainingCredits,
                    estimatedRunCredits,
                    perPromptRunCost: getFeatureUnitCost('prompt_run'),
                },
                timestamp: new Date(),
            });

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
                        creditsUsed: 0,
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
                onPromptCompleted: async ({ prompt }) => {
                    await captureFeatureCredits({
                        userId,
                        reservationId,
                        featureCode: 'prompt_run',
                        quantity: 1,
                        referenceType: 'prompt',
                        referenceId: prompt.id,
                        metadata: { promptId: prompt.id, prompt: prompt.prompt },
                        logTag: '[Analyze]',
                    });
                    deductedRunCredits = Number((deductedRunCredits + getFeatureUnitCost('prompt_run')).toFixed(2));
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
                        creditsUsed: deductedRunCredits,
                        completedAt: new Date().toISOString(),
                    },
                    creditsUsed: deductedRunCredits,
                });
            }

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
                // client disconnected
            }
        } finally {
            if (reservationId) {
                await reconcileReservationAfterError({
                    userId,
                    reservationId,
                    startedAt: runStartedAt,
                    logTag: '[Analyze]',
                    referenceType: 'analysis',
                    referenceId: company?.id,
                    metadata: { deductedRunCredits },
                }).catch((reverseError) => {
                    console.error('[Analyze] Failed to reconcile leftover reserved credits:', reverseError);
                });
            }
            res.end();
        }
    })();

    req.on('close', () => {
        console.log('[Analyze] Client disconnected');
        res.end();
    });
}
