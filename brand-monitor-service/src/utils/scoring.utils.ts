// ─────────────────────────────────────────────────────────────
// src/utils/scoring.utils.ts
// Source: WebApp/lib/ai-utils.ts (lines 1180–1230) — calculateBrandScores()
// Computes the final visibility / sentiment / share-of-voice /
// overall score from the aggregated competitor rankings.
// ─────────────────────────────────────────────────────────────

import {
    AIResponse,
    CompetitorRanking,
    BrandPrompt,
    IntentLayer,
    ParsedResponseSignal,
    IntentScoreRecord,
} from '../types';
import { logInfo, logWarn } from './logger';

function estimateTokensFromText(value: string): number {
    if (!value) return 0;
    return Math.ceil(value.length / 4);
}

export interface BrandScores {
    visibilityScore: number;
    sentimentScore: number;
    shareOfVoice: number;
    overallScore: number;
    averagePosition: number;
    competitiveStrengthIndex?: number;
    switchOpportunityScore?: number;
    narrativeAuthorityScore?: number;
    forcedMentionRatio?: number;
    forcedMentionFlag?: string;
    llmBiasFactors?: Record<string, number>;
    parsedSignals?: ParsedResponseSignal[];
    scoreRecords?: IntentScoreRecord[];
}

const ZERO_SCORES: BrandScores = {
    visibilityScore: 0,
    sentimentScore: 0,
    shareOfVoice: 0,
    overallScore: 0,
    averagePosition: 0,
};

/**
 * Derives overall brand scores from AI responses + the competitor ranking
 * list (which already contains the brand's own entry with `isOwn: true`).
 *
 * Weights:
 *   visibilityScore × 0.3
 *   sentimentScore  × 0.2
 *   shareOfVoice    × 0.3
 *   positionScore   × 0.2
 */
const INTENT_MAP: Record<string, IntentLayer> = {
    organic_discovery: 'organic_discovery',
    category_authority: 'category_authority',
    competitive_evaluation: 'competitive_evaluation',
    replacement_intent: 'replacement_intent',
    conversational_recall: 'conversational_recall',
    ranking: 'category_authority',
    comparison: 'competitive_evaluation',
    alternatives: 'replacement_intent',
    recommendations: 'conversational_recall',
};

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countExactMentions(text: string, name: string): number {
    const trimmed = name.trim();
    if (!trimmed) return 0;
    const re = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, 'gi');
    return text.match(re)?.length ?? 0;
}

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (!normA || !normB) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function lexicalSimilarity(a: string, b: string): number {
    const tokenize = (value: string) =>
        new Set(
            value
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter((w) => w.length > 2),
        );
    const setA = tokenize(a);
    const setB = tokenize(b);
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    setA.forEach((token) => {
        if (setB.has(token)) intersection++;
    });
    return intersection / Math.max(setA.size, setB.size);
}

async function fetchEmbedding(text: string): Promise<number[] | null> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    const started = Date.now();
    logInfo('LLM_CALL_START', {
        operation: 'fetchEmbedding',
        provider: 'openrouter',
        model: 'openai/text-embedding-3-small',
        inputChars: text.length,
        estimatedInputTokens: estimateTokensFromText(text),
    });
    try {
        const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai/text-embedding-3-small',
                input: text.slice(0, 8000),
            }),
        });
        if (!response.ok) {
            logWarn('LLM_CALL_FAIL', {
                operation: 'fetchEmbedding',
                provider: 'openrouter',
                model: 'openai/text-embedding-3-small',
                durationMs: Date.now() - started,
                status: response.status,
            });
            return null;
        }
        const json = (await response.json()) as any;
        const vector = json?.data?.[0]?.embedding;
        logInfo('LLM_CALL_SUCCESS', {
            operation: 'fetchEmbedding',
            provider: 'openrouter',
            model: 'openai/text-embedding-3-small',
            durationMs: Date.now() - started,
            vectorLength: Array.isArray(vector) ? vector.length : 0,
        });
        return Array.isArray(vector) ? vector : null;
    } catch {
        logWarn('LLM_CALL_FAIL', {
            operation: 'fetchEmbedding',
            provider: 'openrouter',
            model: 'openai/text-embedding-3-small',
            durationMs: Date.now() - started,
        });
        return null;
    }
}

async function semanticSimilarity(responseText: string, brandContext: string): Promise<number> {
    const [responseVec, brandVec] = await Promise.all([
        fetchEmbedding(responseText),
        fetchEmbedding(brandContext),
    ]);
    if (responseVec && brandVec) {
        return cosineSimilarity(responseVec, brandVec);
    }
    return lexicalSimilarity(responseText, brandContext);
}

function extractRankingPosition(text: string, brandName: string): number | undefined {
    const lines = text.split('\n');
    for (const line of lines) {
        const numbered = line.match(/^\s*(\d+)\s*[\)\].:-]\s*(.+)$/i);
        if (!numbered) continue;
        if (new RegExp(`\\b${escapeRegExp(brandName)}\\b`, 'i').test(numbered[2])) {
            return Number(numbered[1]);
        }
    }
    return undefined;
}

function detectCitation(text: string): { presence: 0 | 1; count: number } {
    const patterns = [
        /https?:\/\/\S+/gi,
        /\baccording to\b/gi,
        /\bsource:\b/gi,
        /\bbased on industry reports\b/gi,
    ];
    let count = 0;
    for (const pattern of patterns) {
        count += text.match(pattern)?.length ?? 0;
    }
    return { presence: count > 0 ? 1 : 0, count };
}

function sentimentForBrand(text: string, brandName: string): -1 | 0 | 1 {
    const lower = text.toLowerCase();
    const brandLower = brandName.toLowerCase();
    const idx = lower.indexOf(brandLower);
    const scoped = idx >= 0
        ? lower.slice(Math.max(0, idx - 140), Math.min(lower.length, idx + brandLower.length + 140))
        : lower;

    const positiveWords = ['best', 'strong', 'reliable', 'trusted', 'excellent', 'recommended', 'leading', 'scalable'];
    const negativeWords = ['weak', 'poor', 'expensive', 'bad', 'limited', 'risky', 'unreliable', 'overpriced'];
    const pos = positiveWords.reduce((sum, w) => sum + (scoped.match(new RegExp(`\\b${w}\\b`, 'g'))?.length ?? 0), 0);
    const neg = negativeWords.reduce((sum, w) => sum + (scoped.match(new RegExp(`\\b${w}\\b`, 'g'))?.length ?? 0), 0);
    if (pos > neg) return 1;
    if (neg > pos) return -1;
    return 0;
}

function isSeeded(promptText: string, brandName: string): boolean {
    return countExactMentions(promptText, brandName) > 0;
}

function inferIntentLayer(category?: string): IntentLayer {
    const key = (category || '').toLowerCase().trim();
    return INTENT_MAP[key] || 'category_authority';
}

function clampScore(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
}

export async function calculateBrandScores(
    responses: AIResponse[],
    brandName: string,
    competitors: CompetitorRanking[],
    prompts: BrandPrompt[] = [],
    options?: { brandId?: string; brandDescription?: string; usp?: string[] },
): Promise<BrandScores> {
    if (responses.length === 0) return ZERO_SCORES;

    const brandRanking = competitors.find((c) => c.isOwn);
    if (!brandRanking) return ZERO_SCORES;

    const { sentimentScore, averagePosition } = brandRanking;
    const promptById = new Map(prompts.map((p) => [p.id, p]));
    const promptByText = new Map(prompts.map((p) => [p.prompt.trim().toLowerCase(), p]));
    const brandContext = `${options?.brandDescription || ''} ${(options?.usp || []).join(' ')}`.trim();

    const trackedBrands = [brandName, ...competitors.filter((c) => !c.isOwn).map((c) => c.name)];
    const parsedSignals: ParsedResponseSignal[] = [];

    for (const response of responses) {
        const normalizedPrompt = response.prompt.trim().toLowerCase();
        const prompt = (response.promptId && promptById.get(response.promptId)) || promptByText.get(normalizedPrompt);
        const intentLayer = inferIntentLayer(response.intentLayer || prompt?.category);
        const promptText = prompt?.prompt || response.prompt;
        const seeded = typeof response.promptSeededBrand === 'boolean'
            ? response.promptSeededBrand
            : isSeeded(promptText, brandName);

        const explicitCount = countExactMentions(response.response, brandName);
        const explicitMention: 0 | 1 = explicitCount > 0 ? 1 : 0;
        let implicitSimilarityScore = 0;
        let implicitMention: 0 | 1 = 0;
        if (explicitMention === 0 && brandContext.length > 0) {
            implicitSimilarityScore = await semanticSimilarity(response.response, brandContext);
            implicitMention = implicitSimilarityScore > 0.75 ? 1 : 0;
        }

        const rankingPosition = extractRankingPosition(response.response, brandName);
        let rankingScore = 0;
        if (rankingPosition && rankingPosition > 0) rankingScore = 1 / rankingPosition;
        else if (explicitMention || implicitMention) rankingScore = 0.5;

        const sentiment = sentimentForBrand(response.response, brandName);
        const sentimentNormalized = (sentiment + 1) / 2;
        const citation = detectCitation(response.response);
        const brandMentioned = explicitMention === 1 || implicitMention === 1;
        const brandMentionCount = explicitCount + implicitMention;
        const mentionsAcrossAllBrands = trackedBrands.reduce(
            (sum, n) => sum + countExactMentions(response.response, n),
            0,
        );

        parsedSignals.push({
            brandId: options?.brandId,
            llmProvider: response.provider,
            promptId: prompt?.id || response.promptId,
            intentLayer,
            promptText,
            responseText: response.response,
            timestamp: new Date(response.timestamp).toISOString(),
            brandSeededInPrompt: seeded,
            explicitMention,
            explicitCount,
            implicitMention,
            implicitSimilarityScore: Number(implicitSimilarityScore.toFixed(4)),
            rankingPosition,
            rankingScore: Number(rankingScore.toFixed(4)),
            sentiment,
            sentimentNormalized: Number(sentimentNormalized.toFixed(4)),
            citationPresence: citation.presence,
            citationCount: citation.count,
            brandMentioned,
            brandMentionCount,
            mentionsAcrossAllBrands,
        });
    }

    const visibilitySignals = parsedSignals.filter((s) =>
        s.intentLayer === 'organic_discovery'
        || s.intentLayer === 'category_authority'
        || (s.intentLayer === 'conversational_recall' && !s.brandSeededInPrompt),
    );
    const visibilityRaw = visibilitySignals.length > 0
        ? visibilitySignals.reduce(
            (sum, s) => sum + (s.explicitMention * 0.6 + s.rankingScore * 0.3 + s.implicitMention * 0.3),
            0,
        ) / visibilitySignals.length
        : 0;
    const visibilityScore = clampScore(visibilityRaw * 100);

    const competitiveSignals = parsedSignals.filter((s) => s.intentLayer === 'competitive_evaluation');
    const competitiveStrengthIndex = competitiveSignals.length > 0
        ? clampScore(
            (competitiveSignals.reduce((sum, s) => sum + (s.rankingScore * 0.6 + s.sentimentNormalized * 0.4), 0)
                / competitiveSignals.length) * 100,
        )
        : 0;

    const replacementSignals = parsedSignals.filter((s) => s.intentLayer === 'replacement_intent');
    const switchOpportunityScore = replacementSignals.length > 0
        ? clampScore(
            (replacementSignals.reduce((sum, s) => sum + (s.explicitMention * s.sentimentNormalized), 0)
                / replacementSignals.length) * 100,
        )
        : 0;

    const conversationalSignals = parsedSignals.filter((s) => s.intentLayer === 'conversational_recall');
    const narrativeAuthorityScore = conversationalSignals.length > 0
        ? clampScore(
            (conversationalSignals.reduce(
                (sum, s) => sum + (s.sentimentNormalized * 0.4 + s.citationPresence * 0.4 + s.explicitMention * 0.2),
                0,
            ) / conversationalSignals.length) * 100,
        )
        : 0;

    const totalMentions = parsedSignals.reduce((sum, s) => sum + s.brandMentionCount, 0);
    const seededMentions = parsedSignals
        .filter((s) => s.brandSeededInPrompt)
        .reduce((sum, s) => sum + s.brandMentionCount, 0);
    const forcedMentionRatio = totalMentions > 0 ? seededMentions / totalMentions : 0;
    const forcedMentionFlag =
        forcedMentionRatio > 0.7 ? 'Low Organic Recall – High Seeded Dependence' : undefined;

    const brandMentionsTotal = parsedSignals.reduce((sum, s) => sum + s.explicitCount, 0);
    const allMentionsAcrossBrands = parsedSignals.reduce((sum, s) => sum + s.mentionsAcrossAllBrands, 0);
    const shareOfVoice = allMentionsAcrossBrands > 0
        ? clampScore((brandMentionsTotal / allMentionsAcrossBrands) * 100)
        : 0;

    // Position score: lower position number = better (scale to 0–100)
    const positionScore =
        averagePosition <= 10
            ? (11 - averagePosition) * 10
            : Math.max(0, 100 - averagePosition * 2);

    const overallScore =
        visibilityScore * 0.3 +
        competitiveStrengthIndex * 0.2 +
        narrativeAuthorityScore * 0.15 +
        switchOpportunityScore * 0.15 +
        shareOfVoice * 0.1 +
        positionScore * 0.1;

    const llmBiasFactors: Record<string, number> = {};
    parsedSignals.forEach((s) => {
        if (!llmBiasFactors[s.llmProvider]) llmBiasFactors[s.llmProvider] = 0;
    });
    Object.keys(llmBiasFactors).forEach((provider) => {
        const providerSignals = parsedSignals.filter((s) => s.llmProvider === provider);
        const avgMentionsAcrossAllBrands = providerSignals.length > 0
            ? providerSignals.reduce((sum, s) => sum + s.mentionsAcrossAllBrands, 0) / providerSignals.length
            : 1;
        llmBiasFactors[provider] = avgMentionsAcrossAllBrands > 0 ? avgMentionsAcrossAllBrands : 1;
    });

    const scoreRecords: IntentScoreRecord[] = [];
    const now = new Date().toISOString();
    const providerIntentGroups = new Map<string, ParsedResponseSignal[]>();
    parsedSignals.forEach((signal) => {
        const key = `${signal.llmProvider}::${signal.intentLayer}`;
        const existing = providerIntentGroups.get(key) || [];
        providerIntentGroups.set(key, [...existing, signal]);
    });

    providerIntentGroups.forEach((signals, key) => {
        const [provider, intentLayer] = key.split('::') as [string, IntentLayer];
        const bias = llmBiasFactors[provider] || 1;
        const makeRecord = (
            metric: IntentScoreRecord['metric'],
            raw: number,
            unitCount: number,
        ) => {
            scoreRecords.push({
                brandId: options?.brandId,
                llmProvider: provider,
                intentLayer,
                timestamp: now,
                metric,
                rawScore: clampScore(raw),
                adjustedScore: clampScore(raw / bias),
                unitCount,
            });
        };

        if (intentLayer === 'organic_discovery' || intentLayer === 'category_authority' || intentLayer === 'conversational_recall') {
            const valid = signals.filter((s) => !(s.intentLayer === 'conversational_recall' && s.brandSeededInPrompt));
            const raw = valid.length > 0
                ? (valid.reduce((sum, s) => sum + (s.explicitMention * 0.6 + s.rankingScore * 0.3 + s.implicitMention * 0.3), 0) / valid.length) * 100
                : 0;
            makeRecord('visibility', raw, valid.length);
        }
        if (intentLayer === 'competitive_evaluation') {
            const raw = signals.length > 0
                ? (signals.reduce((sum, s) => sum + (s.rankingScore * 0.6 + s.sentimentNormalized * 0.4), 0) / signals.length) * 100
                : 0;
            makeRecord('competitive_strength', raw, signals.length);
        }
        if (intentLayer === 'replacement_intent') {
            const raw = signals.length > 0
                ? (signals.reduce((sum, s) => sum + (s.explicitMention * s.sentimentNormalized), 0) / signals.length) * 100
                : 0;
            makeRecord('switch_opportunity', raw, signals.length);
        }
        if (intentLayer === 'conversational_recall') {
            const raw = signals.length > 0
                ? (signals.reduce((sum, s) => sum + (s.sentimentNormalized * 0.4 + s.citationPresence * 0.4 + s.explicitMention * 0.2), 0) / signals.length) * 100
                : 0;
            makeRecord('narrative_authority', raw, signals.length);
        }
    });

    return {
        visibilityScore: Math.round(visibilityScore * 10) / 10,
        sentimentScore: Math.round(sentimentScore * 10) / 10,
        shareOfVoice: Math.round(shareOfVoice * 10) / 10,
        overallScore: Math.round(overallScore * 10) / 10,
        averagePosition: Math.round(averagePosition * 10) / 10,
        competitiveStrengthIndex: Math.round(competitiveStrengthIndex * 10) / 10,
        switchOpportunityScore: Math.round(switchOpportunityScore * 10) / 10,
        narrativeAuthorityScore: Math.round(narrativeAuthorityScore * 10) / 10,
        forcedMentionRatio: Math.round(forcedMentionRatio * 1000) / 1000,
        forcedMentionFlag,
        llmBiasFactors,
        parsedSignals,
        scoreRecords,
    };
}
