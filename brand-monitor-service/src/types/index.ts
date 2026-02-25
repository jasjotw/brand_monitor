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

export interface BrandPrompt {
    id: string;
    prompt: string;
    category: 'ranking' | 'comparison' | 'alternatives' | 'recommendations';
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
}

// ── SSE ──────────────────────────────────────────────────────

export type SSEEventType =
    | 'start'
    | 'progress'
    | 'stage'
    | 'competitor-found'
    | 'prompt-generated'
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
