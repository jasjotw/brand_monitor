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
import { logMethodEntry } from '../utils/logger';

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
    onPromptCompleted?: (payload: {
        prompt: BrandPrompt;
        promptIndex: number;
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

type ProviderRunStatus = 'pending' | 'running' | 'completed' | 'failed';
type PromptRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial_failed';

interface PromptRunStateItem {
    promptId: string;
    prompt: string;
    promptIndex: number;
    totalProviders: number;
    runningProviders: number;
    completedProviders: number;
    failedProviders: number;
    status: PromptRunStatus;
    providers: Record<string, ProviderRunStatus>;
}

interface PromptRunStateSnapshot {
    totalPrompts: number;
    pendingPrompts: number;
    runningPrompts: number;
    completedPrompts: number;
    failedPrompts: number;
    prompts: PromptRunStateItem[];
}

function createPromptRunTracker(prompts: BrandPrompt[], providers: AIProvider[]) {
    const byPromptId = new Map<string, PromptRunStateItem>();
    const providerNames = providers.map((p) => p.name);

    prompts.forEach((prompt, index) => {
        const providersState: Record<string, ProviderRunStatus> = {};
        providerNames.forEach((name) => {
            providersState[name] = 'pending';
        });
        byPromptId.set(prompt.id || `prompt-${index + 1}`, {
            promptId: prompt.id || `prompt-${index + 1}`,
            prompt: prompt.prompt,
            promptIndex: index + 1,
            totalProviders: providers.length,
            runningProviders: 0,
            completedProviders: 0,
            failedProviders: 0,
            status: 'pending',
            providers: providersState,
        });
    });

    const recompute = (row: PromptRunStateItem) => {
        const statuses = Object.values(row.providers);
        row.runningProviders = statuses.filter((s) => s === 'running').length;
        row.completedProviders = statuses.filter((s) => s === 'completed').length;
        row.failedProviders = statuses.filter((s) => s === 'failed').length;

        if (row.completedProviders === row.totalProviders) {
            row.status = 'completed';
            return;
        }
        if (row.failedProviders === row.totalProviders) {
            row.status = 'failed';
            return;
        }
        if (row.runningProviders > 0) {
            row.status = 'running';
            return;
        }
        if (row.failedProviders > 0 && row.completedProviders > 0) {
            row.status = 'partial_failed';
            return;
        }
        row.status = 'pending';
    };

    const mark = (promptId: string, providerName: string, state: ProviderRunStatus) => {
        const row = byPromptId.get(promptId);
        if (!row) return;
        row.providers[providerName] = state;
        recompute(row);
    };

    const snapshot = (): PromptRunStateSnapshot => {
        const promptsList = Array.from(byPromptId.values()).sort((a, b) => a.promptIndex - b.promptIndex);
        return {
            totalPrompts: promptsList.length,
            pendingPrompts: promptsList.filter((p) => p.status === 'pending').length,
            runningPrompts: promptsList.filter((p) => p.status === 'running').length,
            completedPrompts: promptsList.filter((p) => p.status === 'completed').length,
            failedPrompts: promptsList.filter((p) => p.status === 'failed' || p.status === 'partial_failed').length,
            prompts: promptsList,
        };
    };

    return { mark, snapshot };
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
    onPromptCompleted,
    sendEvent,
}: AnalysisConfig): Promise<AnalysisResult> {
    logMethodEntry('analysisService.performAnalysis', {
        companyName: company?.name,
        promptsProvided: Array.isArray(prompts) ? prompts.length : 0,
        useWebSearch,
    });
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
    const promptRunTracker = createPromptRunTracker(analysisPrompts, availableProviders);

    console.log(`[Analysis] Available providers: ${availableProviders.map((p) => p.name).join(', ')}`);
    console.log(`[Analysis] Mock mode: ${useMockMode}`);

    const totalAnalyses = analysisPrompts.length * availableProviders.length;
    let completedAnalyses = 0;
    const pendingPromptIds = analysisPrompts.map((prompt) => prompt.id);
    let runningPromptId: string | null = null;
    const completedPromptIds: string[] = [];
    const failedPromptIds: string[] = [];

    const queueSnapshot = () => ({
        pendingPromptIds: [...pendingPromptIds],
        runningPromptId,
        completedPromptIds: [...completedPromptIds],
        failedPromptIds: [...failedPromptIds],
        nextPromptId: pendingPromptIds[0] ?? null,
        lastCompletedPromptId:
            completedPromptIds.length > 0 ? completedPromptIds[completedPromptIds.length - 1] : null,
        pendingCount: pendingPromptIds.length,
        completedCount: completedPromptIds.length,
        failedCount: failedPromptIds.length,
        totalPrompts: analysisPrompts.length,
    });

    for (let promptIndex = 0; promptIndex < analysisPrompts.length; promptIndex += 1) {
        const prompt = analysisPrompts[promptIndex];

        pendingPromptIds.shift();
        runningPromptId = prompt.id;

        await sendEvent({
            type: 'prompt-dequeued',
            stage: 'analyzing-prompts',
            data: {
                promptId: prompt.id,
                prompt: prompt.prompt,
                promptIndex: promptIndex + 1,
                totalPrompts: analysisPrompts.length,
                queueState: queueSnapshot(),
                promptRunState: promptRunTracker.snapshot(),
            },
            timestamp: new Date(),
        });

        const providerPromises = availableProviders.map(async (provider) => {
            promptRunTracker.mark(prompt.id, provider.name, 'running');

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
                    queueState: queueSnapshot(),
                    promptRunState: promptRunTracker.snapshot(),
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
                    promptRunTracker.mark(prompt.id, provider.name, 'failed');
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
                            queueState: queueSnapshot(),
                            promptRunState: promptRunTracker.snapshot(),
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
                promptRunTracker.mark(prompt.id, provider.name, 'completed');

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
                        queueState: queueSnapshot(),
                        promptRunState: promptRunTracker.snapshot(),
                    } as AnalysisProgressData,
                    timestamp: new Date(),
                });
            } catch (error) {
                console.error(`[Analysis] Error with ${provider.name} for prompt "${prompt.prompt}":`, error);
                errors.push(`${provider.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                promptRunTracker.mark(prompt.id, provider.name, 'failed');

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
                        queueState: queueSnapshot(),
                        promptRunState: promptRunTracker.snapshot(),
                    } as AnalysisProgressData,
                    timestamp: new Date(),
                });
            } finally {
                completedAnalyses += 1;
                const progress = Math.round((completedAnalyses / totalAnalyses) * 100);
                await sendEvent({
                    type: 'progress',
                    stage: 'analyzing-prompts',
                    data: {
                        stage: 'analyzing-prompts',
                        progress,
                        message: `Completed ${completedAnalyses} of ${totalAnalyses} analyses`,
                        queueState: queueSnapshot(),
                        promptRunState: promptRunTracker.snapshot(),
                    } as ProgressData,
                    timestamp: new Date(),
                });
            }
        });

        await Promise.all(providerPromises);

        const promptState = promptRunTracker.snapshot().prompts.find((p) => p.promptId === prompt.id);
        const promptFailed = promptState?.status === 'failed' || promptState?.status === 'partial_failed';
        if (promptFailed) {
            failedPromptIds.push(prompt.id);
            await sendEvent({
                type: 'prompt-failed',
                stage: 'analyzing-prompts',
                data: {
                    promptId: prompt.id,
                    prompt: prompt.prompt,
                    promptIndex: promptIndex + 1,
                    totalPrompts: analysisPrompts.length,
                    queueState: queueSnapshot(),
                    promptRunState: promptRunTracker.snapshot(),
                },
                timestamp: new Date(),
            });
        } else {
            completedPromptIds.push(prompt.id);
            if (onPromptCompleted) {
                await onPromptCompleted({
                    prompt,
                    promptIndex: promptIndex + 1,
                    company,
                    competitors,
                });
            }
            await sendEvent({
                type: 'prompt-complete',
                stage: 'analyzing-prompts',
                data: {
                    promptId: prompt.id,
                    prompt: prompt.prompt,
                    promptIndex: promptIndex + 1,
                    totalPrompts: analysisPrompts.length,
                    queueState: queueSnapshot(),
                    promptRunState: promptRunTracker.snapshot(),
                },
                timestamp: new Date(),
            });
        }
        runningPromptId = null;
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
