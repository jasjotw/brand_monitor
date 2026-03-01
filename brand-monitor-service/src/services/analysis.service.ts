// ─────────────────────────────────────────────────────────────
// src/services/analysis.service.ts
// Source: WebApp/lib/analyze-common.ts  (performAnalysis + getAvailableProviders)
//
// Orchestrates the full brand-analysis pipeline:
//   1. Identify competitors
//   2. Generate (or use provided) prompts
//   3. Analyse prompts with each AI provider (batched)
//   4. Aggregate scores
//   5. Finalize & return result
//
// All Next.js-specific imports removed; SSE helpers are Express-based.
// ─────────────────────────────────────────────────────────────

import {
    Company,
    BrandPrompt,
    Persona,
    IdealCustomerProfile,
    AIResponse,
    CompetitorRanking,
    ProviderSpecificRanking,
    ProviderComparisonData,
    IntentLayer,
    SSEEvent,
    ProgressData,
    PromptGeneratedData,
    AnalysisProgressData,
    PartialResultData,
    ScoringProgressData,
} from '../types';
import { getConfiguredProviders } from '../config/providers';
import {
    identifyCompetitors,
    generatePromptsForCompany,
    analyzePromptWithProvider,
    analyzePromptWithProviderEnhanced,
    analyzeCompetitors,
    analyzeCompetitorsByProvider,
} from './ai.service';
import { calculateBrandScores, BrandScores } from '../utils/scoring.utils';

// ── Interfaces ────────────────────────────────────────────────

export interface AnalysisConfig {
    company: Company;
    /** Pre-built prompts; if absent, they are generated dynamically. */
    prompts?: BrandPrompt[];
    /** Personas to always inject into prompt generation context. */
    personas?: Persona[];
    /** ICP to bias generated prompts toward target customers. */
    icp?: IdealCustomerProfile;
    /** Optional location-aware seed query persisted in audience profile. */
    baseQuery?: string;
    /** Competitor list supplied by the user (overrides AI identification). */
    userSelectedCompetitors?: { name?: string; url?: string }[];
    useWebSearch?: boolean;
    onPromptsReady?: (payload: {
        prompts: BrandPrompt[];
        competitors: string[];
        company: Company;
    }) => Promise<void> | void;
    onResponseReady?: (payload: {
        response: AIResponse;
        responses: AIResponse[];
        prompt: BrandPrompt;
        company: Company;
        competitors: string[];
    }) => Promise<void> | void;
    sendEvent: (event: SSEEvent) => Promise<void>;
}

export interface AnalysisResult {
    company: Company;
    knownCompetitors: string[];
    prompts: BrandPrompt[];
    responses: AIResponse[];
    scores: BrandScores;
    competitors: CompetitorRanking[];
    providerRankings: ProviderSpecificRanking[];
    providerComparison: ProviderComparisonData[];
    errors?: string[];
    webSearchUsed?: boolean;
    parsedSignals?: any[];
    scoreRecords?: any[];
}

/** AIProvider descriptor for the analysis loop. */
export interface AIProvider {
    name: string;
    model: string;
    icon?: string;
}

// ── Provider Helper ───────────────────────────────────────────

/** Returns available providers in the same shape expected by the loop. */
export function getAvailableProviders(): AIProvider[] {
    return getConfiguredProviders().map((provider) => ({
        name: provider.name,
        model: provider.defaultModel,
        icon: provider.icon,
    }));
}

// ── Orchestrator ──────────────────────────────────────────────

export async function performAnalysis({
    company,
    prompts,
    personas,
    icp,
    baseQuery,
    userSelectedCompetitors,
    useWebSearch = false,
    onPromptsReady,
    onResponseReady,
    sendEvent,
}: AnalysisConfig): Promise<AnalysisResult> {
    const intentFromCategory = (category?: string): IntentLayer => {
        const key = (category || '').toLowerCase();
        if (key === 'organic_discovery') return 'organic_discovery';
        if (key === 'category_authority') return 'category_authority';
        if (key === 'competitive_evaluation') return 'competitive_evaluation';
        if (key === 'replacement_intent') return 'replacement_intent';
        if (key === 'conversational_recall') return 'conversational_recall';
        if (key === 'comparison') return 'competitive_evaluation';
        if (key === 'alternatives') return 'replacement_intent';
        if (key === 'recommendations') return 'conversational_recall';
        return 'category_authority';
    };
    // ── 0. Start ──────────────────────────────────────────────

    await sendEvent({
        type: 'start',
        stage: 'initializing',
        data: {
            stage: 'initializing',
            progress: 0,
            message: `Starting analysis for ${company.name}${useWebSearch ? ' with web search' : ''}`,
        } as ProgressData,
        timestamp: new Date(),
    });

    // ── 1. Identify Competitors ───────────────────────────────

    await sendEvent({
        type: 'stage',
        stage: 'identifying-competitors',
        data: {
            stage: 'identifying-competitors',
            progress: 0,
            message: 'Identifying competitors...',
        } as ProgressData,
        timestamp: new Date(),
    });

    const sanitizeCompetitors = (list?: { name?: string; url?: string }[]) => {
        if (!list) return [] as { name: string; url?: string }[];
        const seen = new Set<string>();
        return list
            .map((item) => ({ name: (item.name || '').trim(), url: item.url?.trim() }))
            .filter((item) => {
                if (!item.name) return false;
                const key = item.name.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    };

    let competitorDetails = sanitizeCompetitors(userSelectedCompetitors).slice(0, 8);
    let competitors: string[];

    if (competitorDetails.length > 0) {
        competitors = competitorDetails.map((c) => c.name);
        console.log('[Analysis] Using user-selected competitors:', competitors);

        for (let i = 0; i < competitorDetails.length; i++) {
            await sendEvent({
                type: 'competitor-found',
                stage: 'identifying-competitors',
                data: { competitor: competitorDetails[i].name, index: i + 1, total: competitorDetails.length },
                timestamp: new Date(),
            });
        }
    } else {
        const identifiedCompetitors = await identifyCompetitors(company, sendEvent);
        competitorDetails = identifiedCompetitors.slice(0, 8).map((name) => ({ name }));
        competitors = competitorDetails.map((c) => c.name);
    }

    // Build URL lookup maps for brand-detection
    const brandUrlSet = new Set<string>();
    if (company.url?.trim()) brandUrlSet.add(company.url.trim());

    const detectionContext: { brandUrls: string[]; competitorUrls: Record<string, string[]> } = {
        brandUrls: Array.from(brandUrlSet).filter(Boolean),
        competitorUrls: {},
    };

    competitorDetails.forEach((detail) => {
        if (!detail.url?.trim()) return;
        const key = detail.name.toLowerCase();
        const existing = detectionContext.competitorUrls[key] || [];
        if (!existing.includes(detail.url)) {
            detectionContext.competitorUrls[key] = [...existing, detail.url!];
        }
    });

    // ── 2. Generate Prompts ───────────────────────────────────

    await sendEvent({
        type: 'stage',
        stage: 'generating-prompts',
        data: { stage: 'generating-prompts', progress: 0, message: 'Generating analysis prompts...' } as ProgressData,
        timestamp: new Date(),
    });

    let analysisPrompts: BrandPrompt[];
    console.log(`[Analysis] ${prompts ? `Using ${prompts.length} provided prompts` : 'Generating prompts dynamically'}`);

    if (prompts && prompts.length > 0) {
        analysisPrompts = prompts;
    } else {
        const generated = await generatePromptsForCompany(company, competitors, personas, icp);
        analysisPrompts = generated.slice(0, 4);
    }

    const trimmedBaseQuery = typeof baseQuery === 'string' ? baseQuery.trim() : '';
    if (trimmedBaseQuery) {
        const exists = analysisPrompts.some(
            (p) => p.prompt.trim().toLowerCase() === trimmedBaseQuery.toLowerCase(),
        );
        if (!exists) {
            analysisPrompts = [
                {
                    id: 'base-query',
                    prompt: trimmedBaseQuery,
                    category: 'recommendations' as const,
                    source: 'base-query',
                },
                ...analysisPrompts,
            ].slice(0, 5);
        }
    }

    for (let i = 0; i < analysisPrompts.length; i++) {
        await sendEvent({
            type: 'prompt-generated',
            stage: 'generating-prompts',
            data: {
                prompt: analysisPrompts[i].prompt,
                category: analysisPrompts[i].category,
                index: i + 1,
                total: analysisPrompts.length,
            } as PromptGeneratedData,
            timestamp: new Date(),
        });
    }

    if (onPromptsReady) {
        await onPromptsReady({
            prompts: analysisPrompts,
            competitors,
            company,
        });
    }

    // ── 3. Analyse with AI Providers ─────────────────────────

    await sendEvent({
        type: 'stage',
        stage: 'analyzing-prompts',
        data: {
            stage: 'analyzing-prompts',
            progress: 0,
            message: `Starting AI analysis${useWebSearch ? ' with web search' : ''}...`,
        } as ProgressData,
        timestamp: new Date(),
    });

    const responses: AIResponse[] = [];
    const errors: string[] = [];
    const availableProviders = getAvailableProviders();
    const useMockMode = process.env.USE_MOCK_MODE === 'true' || availableProviders.length === 0;

    console.log(`[Analysis] Available providers: ${availableProviders.map((p) => p.name).join(', ')}`);
    console.log(`[Analysis] Mock mode: ${useMockMode}`);

    const totalAnalyses = analysisPrompts.length * availableProviders.length;
    let completedAnalyses = 0;

    const BATCH_SIZE = 3;

    for (let batchStart = 0; batchStart < analysisPrompts.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, analysisPrompts.length);
        const batchPrompts = analysisPrompts.slice(batchStart, batchEnd);

        const batchPromises = batchPrompts.flatMap((prompt, batchIndex) =>
            availableProviders.map(async (provider) => {
                const promptIndex = batchStart + batchIndex;

                await sendEvent({
                    type: 'analysis-start',
                    stage: 'analyzing-prompts',
                    data: {
                        provider: provider.name,
                        prompt: prompt.prompt,
                        promptIndex: promptIndex + 1,
                        totalPrompts: analysisPrompts.length,
                        providerIndex: 0,
                        totalProviders: availableProviders.length,
                        status: 'started',
                    } as AnalysisProgressData,
                    timestamp: new Date(),
                });

                try {
                    let response: AIResponse | null;
                    if (useWebSearch) {
                        response = await analyzePromptWithProviderEnhanced(
                            prompt.prompt,
                            provider.name,
                            company.name,
                            competitors,
                            useMockMode,
                            true,
                            detectionContext,
                        );
                    } else {
                        response = await analyzePromptWithProvider(
                            prompt.prompt,
                            provider.name,
                            company.name,
                            competitors,
                            useMockMode,
                            detectionContext,
                        );
                    }

                    if (response === null) {
                        await sendEvent({
                            type: 'analysis-complete',
                            stage: 'analyzing-prompts',
                            data: {
                                provider: provider.name,
                                prompt: prompt.prompt,
                                promptIndex: promptIndex + 1,
                                totalPrompts: analysisPrompts.length,
                                providerIndex: 0,
                                totalProviders: availableProviders.length,
                                status: 'failed',
                            } as AnalysisProgressData,
                            timestamp: new Date(),
                        });
                        return;
                    }

                    if (useMockMode) await new Promise((r) => setTimeout(r, Math.random() * 1000 + 500));

                    const enrichedResponse: AIResponse = {
                        ...response,
                        promptId: prompt.id,
                        intentLayer: intentFromCategory(prompt.category),
                        promptSeededBrand: prompt.prompt.toLowerCase().includes(company.name.toLowerCase()),
                    };

                    responses.push(enrichedResponse);

                    if (onResponseReady) {
                        await onResponseReady({
                            response: enrichedResponse,
                            responses: [...responses],
                            prompt,
                            company,
                            competitors,
                        });
                    }

                    await sendEvent({
                        type: 'partial-result',
                        stage: 'analyzing-prompts',
                        data: {
                            provider: provider.name,
                            prompt: prompt.prompt,
                            response: {
                                provider: enrichedResponse.provider,
                                brandMentioned: enrichedResponse.brandMentioned,
                                brandPosition: enrichedResponse.brandPosition,
                                sentiment: enrichedResponse.sentiment,
                            },
                        } as PartialResultData,
                        timestamp: new Date(),
                    });

                    await sendEvent({
                        type: 'analysis-complete',
                        stage: 'analyzing-prompts',
                        data: {
                            provider: provider.name,
                            prompt: prompt.prompt,
                            promptIndex: promptIndex + 1,
                            totalPrompts: analysisPrompts.length,
                            providerIndex: 0,
                            totalProviders: availableProviders.length,
                            status: 'completed',
                        } as AnalysisProgressData,
                        timestamp: new Date(),
                    });
                } catch (error) {
                    console.error(`[Analysis] Error with ${provider.name} for prompt "${prompt.prompt}":`, error);
                    errors.push(`${provider.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);

                    await sendEvent({
                        type: 'analysis-complete',
                        stage: 'analyzing-prompts',
                        data: {
                            provider: provider.name,
                            prompt: prompt.prompt,
                            promptIndex: promptIndex + 1,
                            totalPrompts: analysisPrompts.length,
                            providerIndex: 0,
                            totalProviders: availableProviders.length,
                            status: 'failed',
                        } as AnalysisProgressData,
                        timestamp: new Date(),
                    });
                }

                completedAnalyses++;
                const progress = Math.round((completedAnalyses / totalAnalyses) * 100);
                await sendEvent({
                    type: 'progress',
                    stage: 'analyzing-prompts',
                    data: { stage: 'analyzing-prompts', progress, message: `Completed ${completedAnalyses} of ${totalAnalyses} analyses` } as ProgressData,
                    timestamp: new Date(),
                });
            }),
        );

        await Promise.all(batchPromises);

        if (batchEnd < analysisPrompts.length) {
            console.log('[Analysis] Cooldown: waiting 30 seconds before next batch...');
            await new Promise((r) => setTimeout(r, 30000));
        }
    }

    // ── 4. Calculate Scores ───────────────────────────────────

    await sendEvent({
        type: 'stage',
        stage: 'calculating-scores',
        data: { stage: 'calculating-scores', progress: 0, message: 'Calculating brand visibility scores...' } as ProgressData,
        timestamp: new Date(),
    });

    const competitorRankings = await analyzeCompetitors(company, responses, competitors);

    // Ensure all user-selected / identified competitors appear in the rankings
    if (competitorDetails.length > 0) {
        const existing = new Set(competitorRankings.map((e) => e.name.toLowerCase()));
        competitorDetails.forEach(({ name }) => {
            if (!existing.has(name.toLowerCase())) {
                competitorRankings.push({
                    name,
                    mentions: 0,
                    averagePosition: 99,
                    sentiment: 'neutral',
                    sentimentScore: 50,
                    shareOfVoice: 0,
                    visibilityScore: 0,
                    weeklyChange: undefined,
                    isOwn: false,
                });
                existing.add(name.toLowerCase());
            }
        });
    }

    for (let i = 0; i < competitorRankings.length; i++) {
        await sendEvent({
            type: 'scoring-start',
            stage: 'calculating-scores',
            data: { competitor: competitorRankings[i].name, score: competitorRankings[i].visibilityScore, index: i + 1, total: competitorRankings.length } as ScoringProgressData,
            timestamp: new Date(),
        });
    }

    const { providerRankings, providerComparison } = await analyzeCompetitorsByProvider(company, responses, competitors);
    const scores = await calculateBrandScores(
        responses,
        company.name,
        competitorRankings,
        analysisPrompts,
        {
            brandDescription: company.description || company.scrapedData?.description || '',
            brandId: company.id,
            usp: Array.isArray((company as any)?.scrapedData?.usp) ? (company as any).scrapedData.usp : [],
        },
    );

    await sendEvent({
        type: 'progress',
        stage: 'calculating-scores',
        data: { stage: 'calculating-scores', progress: 100, message: 'Scoring complete' } as ProgressData,
        timestamp: new Date(),
    });

    // ── 5. Finalize ───────────────────────────────────────────

    await sendEvent({
        type: 'stage',
        stage: 'finalizing',
        data: { stage: 'finalizing', progress: 100, message: 'Analysis complete!' } as ProgressData,
        timestamp: new Date(),
    });

    return {
        company,
        knownCompetitors: competitors,
        prompts: analysisPrompts,
        responses,
        scores,
        competitors: competitorRankings,
        providerRankings,
        providerComparison,
        errors: errors.length > 0 ? errors : undefined,
        webSearchUsed: useWebSearch,
        parsedSignals: scores.parsedSignals,
        scoreRecords: scores.scoreRecords,
    };
}
