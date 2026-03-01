import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { brandAnalyses } from '../db/schema';

type AnyObj = Record<string, any>;

interface RunSnapshot {
    id: string;
    brandId?: string;
    createdAt: Date;
    companyName?: string | null;
    analysisData: AnyObj;
    prompts: any[];
    responses: any[];
    competitors: any[];
}

interface ParsedSignalLike {
    llmProvider?: string;
    promptId?: string;
    intentLayer?: string;
    promptText?: string;
    responseText?: string;
    timestamp?: string;
    explicitMention?: number;
    explicitCount?: number;
    implicitMention?: number;
    implicitSimilarityScore?: number;
    rankingPosition?: number;
    rankingScore?: number;
    sentiment?: number;
    sentimentNormalized?: number;
    citationPresence?: number;
    citationCount?: number;
    brandMentioned?: boolean;
    brandSeededInPrompt?: boolean;
}

function toArray<T = any>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

function toNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function isBrandMentioned(signal: ParsedSignalLike): boolean {
    if (typeof signal.brandMentioned === 'boolean') return signal.brandMentioned;
    return toNumber(signal.explicitCount) > 0 || toNumber(signal.implicitMention) > 0;
}

function brandCitationCount(signal: ParsedSignalLike): number {
    return isBrandMentioned(signal) ? toNumber(signal.citationCount) : 0;
}

function brandMentionCount(signal: ParsedSignalLike): number {
    return isBrandMentioned(signal)
        ? toNumber(signal.explicitCount) + toNumber(signal.implicitMention)
        : 0;
}

function isBrandPlatformSignal(signal: ParsedSignalLike): boolean {
    return brandMentionCount(signal) > 0;
}

function clampPercent(value: number): number {
    return Math.max(0, Math.min(100, value));
}

function normalizeRun(row: any): RunSnapshot {
    const data = (row.analysisData || {}) as AnyObj;
    const prompts = toArray(data.prompts ?? row.prompts);
    const responses = toArray(data.responses);
    const competitors = toArray(data.competitors ?? row.competitors);
    return {
        id: row.id,
        brandId: row.brandId ?? undefined,
        createdAt: new Date(row.createdAt),
        companyName: row.companyName ?? null,
        analysisData: data,
        prompts,
        responses,
        competitors,
    };
}

function scoreFromRun(run: RunSnapshot): AnyObj {
    return (run.analysisData?.scores || {}) as AnyObj;
}

function parsedSignalsFromRun(run: RunSnapshot): ParsedSignalLike[] {
    return toArray<ParsedSignalLike>(run.analysisData?.parsedSignals);
}

function dayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function providerKey(name: string): string {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!normalized) return 'unknown';
    const parts = normalized.split(/\s+/);
    return parts
        .map((part, idx) => (idx === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join('');
}

function extractUrls(text: string): string[] {
    return (text.match(/https?:\/\/[^\s)]+/gi) || []).map((u) => u.replace(/[.,;!?]+$/, ''));
}

function extractDomain(url: string): string {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function sentimentLabel(score: number): 'positive' | 'neutral' | 'negative' {
    if (score > 0.6) return 'positive';
    if (score < 0.4) return 'negative';
    return 'neutral';
}

function relativeTime(from: Date): string {
    const diffMs = Date.now() - from.getTime();
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

function inferPromptIntent(intent?: string): string {
    const key = (intent || '').toLowerCase();
    if (key) return key;
    return 'category_authority';
}

function isVisibilityEligibleSignal(signal: ParsedSignalLike): boolean {
    const intent = inferPromptIntent(signal.intentLayer);
    if (intent === 'organic_discovery' || intent === 'category_authority') return true;
    if (intent === 'conversational_recall' && signal.brandSeededInPrompt !== true) return true;
    return false;
}

export async function getRunsForAnalytics(input: {
    userId: string;
    brandId?: string;
    limit?: number;
}): Promise<{ runs: RunSnapshot[]; resolvedBrandId?: string }> {
    const limit = Math.max(2, Math.min(200, input.limit ?? 60));

    if (input.brandId) {
        const rows = await db.query.brandAnalyses.findMany({
            where: and(eq(brandAnalyses.userId, input.userId), eq(brandAnalyses.brandId, input.brandId)),
            orderBy: desc(brandAnalyses.createdAt),
            limit,
        });
        return {
            runs: rows.map(normalizeRun),
            resolvedBrandId: input.brandId,
        };
    }

    const latestAny = await db.query.brandAnalyses.findFirst({
        where: eq(brandAnalyses.userId, input.userId),
        orderBy: desc(brandAnalyses.createdAt),
    });

    if (!latestAny) return { runs: [] };

    const inferredBrandId = latestAny.brandId ?? undefined;
    if (!inferredBrandId) {
        return { runs: [normalizeRun(latestAny)] };
    }

    const rows = await db.query.brandAnalyses.findMany({
        where: and(eq(brandAnalyses.userId, input.userId), eq(brandAnalyses.brandId, inferredBrandId)),
        orderBy: desc(brandAnalyses.createdAt),
        limit,
    });

    return {
        runs: rows.map(normalizeRun),
        resolvedBrandId: inferredBrandId,
    };
}

export function buildOverviewAnalytics(runs: RunSnapshot[]): AnyObj {
    const latest = runs[0];
    if (!latest) return { hasData: false };
    const scores = scoreFromRun(latest);
    const signals = parsedSignalsFromRun(latest);

    const explicitMentions = signals.reduce((sum, s) => sum + (isBrandMentioned(s) ? toNumber(s.explicitCount) : 0), 0);
    const implicitMentions = signals.reduce((sum, s) => sum + (isBrandMentioned(s) ? toNumber(s.implicitMention) : 0), 0);
    const citations = signals.reduce((sum, s) => sum + brandCitationCount(s), 0);
    const opportunities = signals.filter((s) => !s.brandMentioned).length;

    return {
        hasData: true,
        latestRunAt: latest.createdAt.toISOString(),
        scores: {
            visibilityScore: toNumber(scores.visibilityScore),
            competitiveStrengthIndex: toNumber(scores.competitiveStrengthIndex),
            switchOpportunityScore: toNumber(scores.switchOpportunityScore),
            narrativeAuthorityScore: toNumber(scores.narrativeAuthorityScore),
            shareOfVoice: toNumber(scores.shareOfVoice),
            overallScore: toNumber(scores.overallScore),
            averagePosition: toNumber(scores.averagePosition),
            forcedMentionRatio: toNumber(scores.forcedMentionRatio),
            forcedMentionFlag: scores.forcedMentionFlag || null,
        },
        mentions: {
            total: explicitMentions + implicitMentions,
            explicit: explicitMentions,
            implicit: implicitMentions,
        },
        citations: {
            total: citations,
        },
        opportunities,
    };
}

export function buildVisibilityAnalytics(runs: RunSnapshot[]): AnyObj {
    const latest = runs[0];
    if (!latest) return { hasData: false };

    const trendByDay = new Map<string, { score: number; mentions: number; citations: number; count: number }>();

    runs.forEach((run) => {
        const key = dayKey(run.createdAt);
        const scores = scoreFromRun(run);
        const signals = parsedSignalsFromRun(run);
        const mentions = signals.reduce((sum, s) => sum + brandMentionCount(s), 0);
        const citations = signals.reduce((sum, s) => sum + brandCitationCount(s), 0);
        const existing = trendByDay.get(key) || { score: 0, mentions: 0, citations: 0, count: 0 };
        existing.score += toNumber(scores.visibilityScore);
        existing.mentions += mentions;
        existing.citations += citations;
        existing.count += 1;
        trendByDay.set(key, existing);
    });

    const dailyTrend = Array.from(trendByDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({
            date,
            score: Math.round((v.score / Math.max(1, v.count)) * 10) / 10,
            mentions: v.mentions,
            citations: v.citations,
        }));

    const providerTrendByDay = new Map<string, Map<string, number>>();
    const providerLabelByKey = new Map<string, string>();
    runs.forEach((run) => {
        const signals = parsedSignalsFromRun(run);
        const perProviderMentions = new Map<string, number>();
        signals.forEach((s) => {
            if (!isBrandMentioned(s)) return;
            const provider = s.llmProvider || 'Unknown';
            const key = providerKey(provider);
            providerLabelByKey.set(key, provider);
            const mentions = brandMentionCount(s);
            perProviderMentions.set(key, (perProviderMentions.get(key) || 0) + mentions);
        });

        const totalMentions = Array.from(perProviderMentions.values()).reduce((a, b) => a + b, 0);
        const day = dayKey(run.createdAt);
        const existing = providerTrendByDay.get(day) || new Map<string, number>();
        perProviderMentions.forEach((count, key) => {
            const score = totalMentions > 0 ? (count / totalMentions) * 100 : 0;
            existing.set(key, (existing.get(key) || 0) + score);
        });
        providerTrendByDay.set(day, existing);
    });

    const platformTrend = Array.from(providerTrendByDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, values]) => {
            const row: Record<string, any> = { date };
            values.forEach((v, key) => {
                row[key] = Math.round(v * 10) / 10;
            });
            return row;
        });

    const platformTrendSeries = Array.from(providerLabelByKey.entries()).map(([key, label], idx) => ({
        key,
        label,
        color: ['#10A37F', '#1A73E8', '#20C2D5', '#F9AB00', '#D97757', '#9F9ADE', '#B199AF', '#D4A373'][idx % 8],
    }));

    const latestSignals = parsedSignalsFromRun(latest);
    const previousSignals = runs[1] ? parsedSignalsFromRun(runs[1]) : [];
    const providerMap = new Map<string, { explicit: number; implicit: number; citations: number; sentimentSum: number; sentimentCount: number }>();
    latestSignals.forEach((s) => {
        if (!isBrandPlatformSignal(s)) return;
        const provider = s.llmProvider || 'Unknown';
        const entry = providerMap.get(provider) || { explicit: 0, implicit: 0, citations: 0, sentimentSum: 0, sentimentCount: 0 };
        entry.explicit += toNumber(s.explicitCount);
        entry.implicit += toNumber(s.implicitMention);
        entry.citations += brandCitationCount(s);
        entry.sentimentSum += toNumber(s.sentimentNormalized, 0.5);
        entry.sentimentCount += 1;
        providerMap.set(provider, entry);
    });

    const previousProviderMentions = new Map<string, number>();
    previousSignals.forEach((s) => {
        if (!isBrandPlatformSignal(s)) return;
        const provider = s.llmProvider || 'Unknown';
        const existing = previousProviderMentions.get(provider) || 0;
        previousProviderMentions.set(provider, existing + brandMentionCount(s));
    });

    const mentionsByProvider = Array.from(providerMap.entries()).map(([platform, v]) => ({
        platform,
        explicit: v.explicit,
        implicit: v.implicit,
    }));

    const platformBreakdown = Array.from(providerMap.entries()).map(([platform, v]) => {
        const totalMentions = v.explicit + v.implicit;
        const prevMentions = previousProviderMentions.get(platform) || 0;
        const change = prevMentions > 0
            ? Math.round(((totalMentions - prevMentions) / prevMentions) * 100)
            : 0;
        const sentimentNormalized = v.sentimentCount > 0 ? v.sentimentSum / v.sentimentCount : 0.5;
        const avgMentionWeight = Math.max(1, latestSignals.length);
        const score = clampPercent((totalMentions / avgMentionWeight) * 100);
        return {
            platform,
            score: Math.round(score),
            mentions: totalMentions,
            citations: v.citations,
            sentiment: sentimentLabel(sentimentNormalized),
            change,
            positive: Math.round(sentimentNormalized * 100),
            neutral: Math.round((1 - Math.abs(sentimentNormalized - 0.5) * 2) * 100),
            negative: Math.round((1 - sentimentNormalized) * 100),
        };
    });

    const recentMentions = latestSignals
        .slice()
        .filter((s) => isBrandPlatformSignal(s))
        .sort((a, b) => {
            const ta = new Date(a.timestamp || latest.createdAt).getTime();
            const tb = new Date(b.timestamp || latest.createdAt).getTime();
            return tb - ta;
        })
        .slice(0, 25)
        .map((s) => ({
            prompt: s.promptText || '',
            platform: s.llmProvider || 'Unknown',
            type: toNumber(s.explicitMention) > 0 ? 'Explicit' : toNumber(s.implicitMention) > 0 ? 'Implicit' : toNumber(s.citationPresence) > 0 ? 'Citation' : 'Unknown',
            position: s.rankingPosition ?? null,
            time: relativeTime(new Date(s.timestamp || latest.createdAt)),
        }));

    const scores = scoreFromRun(latest);
    const mentionTotal = latestSignals.reduce((sum, s) => sum + brandMentionCount(s), 0);
    const citationTotal = latestSignals.reduce((sum, s) => sum + brandCitationCount(s), 0);

    return {
        hasData: true,
        latestRunAt: latest.createdAt.toISOString(),
        summary: {
            visibilityScore: toNumber(scores.visibilityScore),
            totalMentions: mentionTotal,
            citations: citationTotal,
            averagePosition: toNumber(scores.averagePosition),
        },
        dailyTrend,
        platformTrend,
        platformTrendSeries,
        mentionsByProvider,
        platformBreakdown,
        recentMentions,
        regionalVisibility: [],
        notes: ['Regional visibility is intentionally omitted due to missing reliable geo signal in current response parser.'],
    };
}

export function buildCompetitorAnalytics(runs: RunSnapshot[]): AnyObj {
    const latest = runs[0];
    if (!latest) return { hasData: false };

    const competitors = toArray<any>(latest.analysisData?.competitors ?? latest.competitors);
    const sorted = competitors.slice().sort((a, b) => toNumber(b.visibilityScore) - toNumber(a.visibilityScore));
    const own = sorted.find((c) => c.isOwn) || null;
    const ownRank = own ? sorted.findIndex((c) => c.name === own.name) + 1 : null;
    const top = sorted.find((c) => !c.isOwn) || null;
    const visibilityGap = own && top ? toNumber(own.visibilityScore) - toNumber(top.visibilityScore) : 0;

    return {
        hasData: true,
        latestRunAt: latest.createdAt.toISOString(),
        summary: {
            trackedCompetitors: sorted.filter((c) => !c.isOwn).length,
            yourRank: ownRank,
            visibilityGap,
            topicsWinning: null,
        },
        competitors: sorted.map((c) => ({
            name: c.name,
            visibility: toNumber(c.visibilityScore),
            mentions: toNumber(c.mentions),
            sentiment: toNumber(c.sentimentScore),
            avgPos: toNumber(c.averagePosition),
            shareOfVoice: toNumber(c.shareOfVoice),
            isOwn: Boolean(c.isOwn),
            change: toNumber(c.weeklyChange),
        })),
        providerComparison: toArray(latest.analysisData?.providerComparison),
        providerRankings: toArray(latest.analysisData?.providerRankings),
        topicGapAnalysis: [],
        notes: ['Topic gap analysis removed. No topic clustering pipeline is active in backend.'],
    };
}

export function buildPromptAnalytics(runs: RunSnapshot[]): AnyObj {
    const latest = runs[0];
    if (!latest) return { hasData: false };

    const previous = runs[1];
    const latestSignals = parsedSignalsFromRun(latest);
    const prevSignals = previous ? parsedSignalsFromRun(previous) : [];

    const perPrompt = new Map<string, {
        prompt: string;
        intentLayer: string;
        providers: Set<string>;
        visibilityProviders: Set<string>;
        explicit: number;
        implicit: number;
        citations: number;
        visibilityMentions: number;
        rankingSum: number;
        rankingCount: number;
        sentimentSum: number;
        sentimentCount: number;
    }>();

    latestSignals.forEach((s) => {
        const key = (s.promptText || '').trim().toLowerCase();
        if (!key) return;
        const existing = perPrompt.get(key) || {
            prompt: s.promptText || '',
            intentLayer: inferPromptIntent(s.intentLayer),
            providers: new Set<string>(),
            visibilityProviders: new Set<string>(),
            explicit: 0,
            implicit: 0,
            citations: 0,
            visibilityMentions: 0,
            rankingSum: 0,
            rankingCount: 0,
            sentimentSum: 0,
            sentimentCount: 0,
        };
        const mentioned = isBrandMentioned(s);
        if (mentioned) {
            existing.providers.add(s.llmProvider || 'Unknown');
        }
        const explicit = mentioned ? toNumber(s.explicitCount) : 0;
        const implicit = mentioned ? toNumber(s.implicitMention) : 0;
        existing.explicit += explicit;
        existing.implicit += implicit;
        existing.citations += brandCitationCount(s);
        if (mentioned && isVisibilityEligibleSignal(s)) {
            existing.visibilityProviders.add(s.llmProvider || 'Unknown');
            existing.visibilityMentions += explicit + implicit;
        }
        if (mentioned && typeof s.rankingPosition === 'number') {
            existing.rankingSum += s.rankingPosition;
            existing.rankingCount += 1;
        }
        if (mentioned) {
            existing.sentimentSum += toNumber(s.sentimentNormalized);
            existing.sentimentCount += 1;
        }
        perPrompt.set(key, existing);
    });

    const prevPromptMentions = new Map<string, number>();
    prevSignals.forEach((s) => {
        const key = (s.promptText || '').trim().toLowerCase();
        if (!key) return;
        const val = prevPromptMentions.get(key) || 0;
        prevPromptMentions.set(key, val + brandMentionCount(s));
    });

    const prompts = Array.from(perPrompt.values()).map((p) => {
        const mentionCount = p.explicit + p.implicit;
        const sentimentNormalized = p.sentimentCount > 0 ? p.sentimentSum / p.sentimentCount : 0.5;
        const prevMentions = prevPromptMentions.get(p.prompt.trim().toLowerCase()) || 0;
        const trendingDelta = mentionCount - prevMentions;
        const visibility = p.visibilityProviders.size > 0
            ? clampPercent((p.visibilityMentions / Math.max(1, p.visibilityProviders.size)) * 100)
            : 0;
        return {
            prompt: p.prompt,
            intentLayer: p.intentLayer,
            providers: Array.from(p.providers),
            mentionCount,
            explicitMentions: p.explicit,
            implicitMentions: p.implicit,
            citations: p.citations,
            visibility,
            avgPosition: p.rankingCount > 0 ? Math.round((p.rankingSum / p.rankingCount) * 10) / 10 : null,
            sentiment: sentimentLabel(sentimentNormalized),
            sentimentScore: Math.round(sentimentNormalized * 100),
            trendingDelta,
            trending: trendingDelta > 0,
        };
    }).sort((a, b) => b.mentionCount - a.mentionCount);

    const categoryMap = new Map<string, { count: number; visibilitySum: number }>();
    prompts.forEach((p) => {
        const entry = categoryMap.get(p.intentLayer) || { count: 0, visibilitySum: 0 };
        entry.count += 1;
        entry.visibilitySum += p.visibility;
        categoryMap.set(p.intentLayer, entry);
    });
    const categories = Array.from(categoryMap.entries()).map(([category, v]) => ({
        category,
        count: v.count,
        avgVisibility: Math.round((v.visibilitySum / Math.max(1, v.count)) * 10) / 10,
    }));

    const trendByRun = runs
        .slice()
        .reverse()
        .map((run) => {
            const signals = parsedSignalsFromRun(run);
            const totalPrompts = new Set(signals.map((s) => (s.promptText || '').trim().toLowerCase()).filter(Boolean)).size;
            const visiblePrompts = new Set(
                signals
                    .filter((s) => isVisibilityEligibleSignal(s))
                    .filter((s) => toNumber(s.explicitCount) > 0 || toNumber(s.implicitMention) > 0)
                    .map((s) => (s.promptText || '').trim().toLowerCase())
                    .filter(Boolean),
            ).size;
            return {
                runId: run.id,
                timestamp: run.createdAt.toISOString(),
                totalPrompts,
                visiblePrompts,
            };
        });

    return {
        hasData: true,
        latestRunAt: latest.createdAt.toISOString(),
        summary: {
            trackedPrompts: prompts.length,
            avgVisibility: prompts.length
                ? Math.round((prompts.reduce((sum, p) => sum + p.visibility, 0) / prompts.length) * 10) / 10
                : 0,
            audienceSegments: categories.length,
            note: 'Search volume is not available from LLM responses. Trend currently reflects prompt-performance changes across analysis runs.',
        },
        categories,
        prompts,
        promptPerformanceTrend: trendByRun,
        rawResponses: toArray(latest.analysisData?.responses),
    };
}

export function buildSourceAttribution(runs: RunSnapshot[]): AnyObj {
    const latest = runs[0];
    if (!latest) return { hasData: false };

    const signals = parsedSignalsFromRun(latest);
    const domainMap = new Map<string, { citations: number; mentions: number; urls: Set<string> }>();

    signals.forEach((s) => {
        const text = s.responseText || '';
        const urls = extractUrls(text);
        const mentionCount = toNumber(s.explicitCount) + toNumber(s.implicitMention);
        urls.forEach((url) => {
            const domain = extractDomain(url);
            if (!domain) return;
            const current = domainMap.get(domain) || { citations: 0, mentions: 0, urls: new Set<string>() };
            current.citations += 1;
            current.mentions += mentionCount;
            current.urls.add(url);
            domainMap.set(domain, current);
        });
    });

    const sources = Array.from(domainMap.entries())
        .map(([domain, v]) => ({
            domain,
            citations: v.citations,
            mentions: v.mentions,
            urls: Array.from(v.urls).slice(0, 5),
        }))
        .sort((a, b) => b.citations - a.citations)
        .slice(0, 100);

    return {
        hasData: true,
        latestRunAt: latest.createdAt.toISOString(),
        sources,
        notes: [
            'Source attribution currently extracts URLs/domains from response text.',
            'Citations without explicit URLs (e.g., "According to ...") are counted in citation metrics but cannot be mapped to a source domain yet.',
        ],
    };
}

export function buildAlerts(runs: RunSnapshot[]): AnyObj {
    const latest = runs[0];
    if (!latest) return { hasData: false, alerts: [] };
    const prev = runs[1];
    if (!prev) return { hasData: true, alerts: [] };

    const currScores = scoreFromRun(latest);
    const prevScores = scoreFromRun(prev);
    const currSignals = parsedSignalsFromRun(latest);
    const prevSignals = parsedSignalsFromRun(prev);
    const alerts: AnyObj[] = [];

    const currVisibility = toNumber(currScores.visibilityScore);
    const prevVisibility = toNumber(prevScores.visibilityScore);
    const visDelta = currVisibility - prevVisibility;
    if (visDelta <= -10) {
        alerts.push({
            type: 'visibility_drop',
            severity: 'critical',
            title: 'Visibility dropped',
            description: `Visibility score decreased by ${Math.abs(Math.round(visDelta))} points since last run.`,
        });
    } else if (visDelta >= 10) {
        alerts.push({
            type: 'visibility_spike',
            severity: 'info',
            title: 'Visibility increased',
            description: `Visibility score increased by ${Math.round(visDelta)} points since last run.`,
        });
    }

    const currCitations = currSignals.reduce((sum, s) => sum + brandCitationCount(s), 0);
    const prevCitations = prevSignals.reduce((sum, s) => sum + brandCitationCount(s), 0);
    if (prevCitations > 0) {
        const citationChangePct = ((currCitations - prevCitations) / prevCitations) * 100;
        if (citationChangePct <= -15) {
            alerts.push({
                type: 'citation_drop',
                severity: 'warning',
                title: 'Citation drop detected',
                description: `Citations dropped by ${Math.abs(Math.round(citationChangePct))}% since the previous run.`,
            });
        }
    }

    const currSent = toNumber(currScores.sentimentScore);
    const prevSent = toNumber(prevScores.sentimentScore);
    const sentDelta = currSent - prevSent;
    if (Math.abs(sentDelta) >= 10) {
        alerts.push({
            type: 'sentiment_shift',
            severity: sentDelta > 0 ? 'info' : 'warning',
            title: 'Sentiment shift detected',
            description: `Sentiment score ${sentDelta > 0 ? 'improved' : 'declined'} by ${Math.abs(Math.round(sentDelta))} points.`,
        });
    }

    const currCompetitors = toArray<any>(latest.analysisData?.competitors);
    const prevCompetitors = toArray<any>(prev.analysisData?.competitors);
    const ownCurr = currCompetitors.find((c) => c.isOwn);
    const ownPrev = prevCompetitors.find((c) => c.isOwn);
    if (ownCurr && ownPrev) {
        const rank = (arr: any[], name: string) =>
            arr.slice().sort((a, b) => toNumber(b.visibilityScore) - toNumber(a.visibilityScore)).findIndex((c) => c.name === name) + 1;
        const currRank = rank(currCompetitors, ownCurr.name);
        const prevRank = rank(prevCompetitors, ownPrev.name);
        if (currRank > prevRank && currRank > 0 && prevRank > 0) {
            alerts.push({
                type: 'competitor_overtake',
                severity: 'warning',
                title: 'Competitor overtake detected',
                description: `Your rank moved from #${prevRank} to #${currRank} compared to the previous run.`,
            });
        }
    }

    const now = new Date();
    return {
        hasData: true,
        alerts: alerts.map((a, idx) => ({
            id: `${latest.id}-${idx + 1}`,
            ...a,
            createdAt: now.toISOString(),
            time: relativeTime(now),
            baselineRunId: prev.id,
            currentRunId: latest.id,
        })),
    };
}
