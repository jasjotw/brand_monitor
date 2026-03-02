// ─────────────────────────────────────────────────────────────
// src/types/index.ts
// Source: WebApp/lib/types.ts  (brand-monitor-relevant exports only)
// ─────────────────────────────────────────────────────────────

export interface Company {
    id: string;
    name: string;
    url: string;
    description?: string;
    industry?: string;
    location?: string;
    logo?: string;
    favicon?: string;
    scraped?: boolean;
    scrapedData?: {
        title: string;
        description: string;
        keywords: string[];
        mainContent: string;
        mainProducts?: string[];
        competitors?: string[];
        profileCompetitors?: string[];
        competitorDetails?: { name: string; url?: string }[];
        ogImage?: string;
        favicon?: string;
    };
}

export interface AIProvider {
    name: string;
    model: string;
    icon?: string;
}

export interface Persona {
    id: string;
    role: string;
    description: string;
    painPoints: string[];
    goals: string[];
    avatar?: string;
}

export type IntentLayer =
    | 'organic_discovery'
    | 'category_authority'
    | 'competitive_evaluation'
    | 'replacement_intent'
    | 'conversational_recall';

export type PromptCategory =
    | IntentLayer
    | 'ranking'
    | 'comparison'
    | 'alternatives'
    | 'recommendations';

export interface IdealCustomerProfile {
    summary: string;
    industries: string[];
    companySize: string;
    annualRevenueRange: string;
    geographies: string[];
    budgetRange: string;
    buyingCommittee: string[];
    painPoints: string[];
    successCriteria: string[];
    icp_summary?: string;
    firmographics?: Record<string, unknown>;
    buyer_committee?: Record<string, unknown>;
    pain_points?: string[];
    jtbd?: {
        functional: string[];
        emotional: string[];
        social: string[];
    };
    ai_search_behavior?: Record<string, unknown>;
    trigger_events?: string[];
    buying_criteria?: {
        must_have: string[];
        nice_to_have: string[];
        deal_breakers: string[];
    };
    objections?: string[];
    disqualification_criteria?: string[];
    intent_signals?: {
        content: string[];
        behavioral: string[];
        technographic: string[];
        geo_relevant: string[];
    };
    messaging_angles?: {
        value_props: string[];
        proof_points: string[];
    };
    priority_segments?: Array<Record<string, unknown> | string>;
}

export interface BrandPrompt {
    id: string;
    prompt: string;
    category: PromptCategory;
    persona?: string;
    source?: string;
}

export interface CompanyRanking {
    position: number;
    company: string;
    reason?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface AIResponse {
    provider: string;
    prompt: string;
    promptId?: string;
    intentLayer?: IntentLayer;
    promptSeededBrand?: boolean;
    response: string;
    rankings?: CompanyRanking[];
    competitors: string[];
    brandMentioned: boolean;
    brandPosition?: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
    timestamp: Date;
    detectionDetails?: {
        brandMatches?: { text: string; index: number; confidence: number }[];
        competitorMatches?:
        | Map<string, { text: string; index: number; confidence: number }[]>
        | Record<string, { text: string; index: number; confidence: number }[]>;
    };
}

export interface ParsedResponseSignal {
    brandId?: string;
    llmProvider: string;
    promptId?: string;
    intentLayer: IntentLayer;
    promptText: string;
    responseText: string;
    timestamp: string;
    brandSeededInPrompt: boolean;
    explicitMention: 0 | 1;
    explicitCount: number;
    implicitMention: 0 | 1;
    implicitSimilarityScore: number;
    rankingPosition?: number;
    rankingScore: number;
    sentiment: -1 | 0 | 1;
    sentimentNormalized: number;
    citationPresence: 0 | 1;
    citationCount: number;
    brandMentioned: boolean;
    brandMentionCount: number;
    mentionsAcrossAllBrands: number;
}

export interface IntentScoreRecord {
    brandId?: string;
    llmProvider: string;
    intentLayer: IntentLayer;
    timestamp: string;
    rawScore: number;
    adjustedScore: number;
    unitCount: number;
    metric: 'visibility' | 'competitive_strength' | 'switch_opportunity' | 'narrative_authority';
}

export interface CompetitorRanking {
    name: string;
    logo?: string;
    mentions: number;
    averagePosition: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    sentimentScore: number;
    shareOfVoice: number;
    visibilityScore: number;
    weeklyChange?: number;
    isOwn?: boolean;
}

export interface ProviderSpecificRanking {
    provider: string;
    competitors: CompetitorRanking[];
}

export interface ProviderComparisonData {
    competitor: string;
    providers: {
        [provider: string]: {
            visibilityScore: number;
            position: number;
            mentions: number;
            sentiment: 'positive' | 'neutral' | 'negative';
        };
    };
    isOwn?: boolean;
}

export interface BrandAnalysis {
    company: Company;
    prompts: BrandPrompt[];
    responses: AIResponse[];
    competitors: CompetitorRanking[];
    providerRankings?: ProviderSpecificRanking[];
    providerComparison?: ProviderComparisonData[];
    overallScore: number;
    visibilityScore: number;
    sentimentScore: number;
    shareOfVoice: number;
    averagePosition?: number;
    parsedSignals?: ParsedResponseSignal[];
    scoreRecords?: IntentScoreRecord[];
}

// ── SSE ──────────────────────────────────────────────────────

export type SSEEventType =
    | 'start'
    | 'progress'
    | 'stage'
    | 'competitor-found'
    | 'prompt-generated'
    | 'prompt-dequeued'
    | 'prompt-complete'
    | 'prompt-failed'
    | 'analysis-start'
    | 'analysis-progress'
    | 'analysis-complete'
    | 'scoring-start'
    | 'scoring-complete'
    | 'partial-result'
    | 'complete'
    | 'error'
    | 'credits';

export type AnalysisStage =
    | 'initializing'
    | 'identifying-competitors'
    | 'generating-prompts'
    | 'analyzing-prompts'
    | 'calculating-scores'
    | 'finalizing'
    | 'credits'
    | 'error';

export interface SSEEvent<T = unknown> {
    type: SSEEventType;
    stage: AnalysisStage;
    data: T;
    timestamp: Date;
}

export interface ProgressData {
    stage: AnalysisStage;
    progress: number; // 0–100
    message: string;
    details?: unknown;
}

export interface PromptGeneratedData {
    prompt: string;
    category: string;
    index: number;
    total: number;
}

export interface AnalysisProgressData {
    provider: string;
    prompt: string;
    promptIndex: number;
    totalPrompts: number;
    providerIndex: number;
    totalProviders: number;
    status: 'started' | 'completed' | 'failed';
    queueState?: unknown;
    promptRunState?: unknown;
}

export interface PartialResultData {
    provider: string;
    prompt: string;
    response: Partial<AIResponse>;
    competitorScores?: Partial<CompetitorRanking>[];
}

export interface ScoringProgressData {
    competitor: string;
    score?: number;
    index: number;
    total: number;
}

// Progress callback for streaming analysis
export type ProgressCallback = (event: SSEEvent) => void;

/** Data payload for the 'competitor-found' SSE event. */
export interface CompetitorFoundData {
    competitor: string;
    index: number;
    total: number;
}
