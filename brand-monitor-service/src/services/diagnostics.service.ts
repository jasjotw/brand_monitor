import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { brandprofile } from '../db/schema';
import { env } from '../config/env';

type CheckStatus = 'pass' | 'warning' | 'fail';

interface DiagnosticsRawPayload {
    client_name?: string;
    generation_date?: string;
    summary?: {
        structuredCoverage?: number | null;
        unstructuredCoverage?: number | null;
        optimizationOpportunities?: number | null;
        overallAEOReadiness?: number | null;
        schema_counts?: { valid?: number; incorrect?: number; missing?: number; other?: number };
        total_schemas?: number;
        optimization_count?: number;
        case_metrics_found?: string[];
    };
    executive_summary?: {
        surface?: string;
        deeper?: string;
        root_causes?: string;
    };
    robots_txt?: string;
    llm_txt?: string;
    schema_org?: unknown;
    robotsTxt?: string;
    llmTxt?: string;
}

interface DiagnosticCheck {
    label: string;
    status: CheckStatus;
    detail: string;
    fix?: string;
}

interface DiagnosticGroup {
    category: string;
    checks: DiagnosticCheck[];
}

interface DiagnosticsSummaryResponse {
    structuredCoverage: number | null;
    unstructuredCoverage: number | null;
    optimizationOpportunities: number | null;
    overallAEOReadiness: number | null;
    schemaCounts: { valid: number; incorrect: number; missing: number; other: number };
    totalSchemas: number;
    optimizationCount: number;
    caseMetricsFound: string[];
}

export interface DiagnosticsResponse {
    hasData: boolean;
    brandId: string | null;
    clientName: string | null;
    generationDate: string | null;
    summary: DiagnosticsSummaryResponse;
    executiveSummary: {
        surface: string;
        deeper: string;
        rootCauses: string;
    };
    groups: DiagnosticGroup[];
    health: {
        score: number;
        passed: number;
        warnings: number;
        failed: number;
        total: number;
    };
    source: 'service' | 'none';
    error?: string;
}

function toNum(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function hasRobotsAllow(text: string, bot: string): boolean | null {
    if (!text.trim()) return null;
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    let inBot = false;
    let foundAllow = false;
    let foundDisallowRoot = false;
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.startsWith('user-agent:')) {
            const ua = lower.replace('user-agent:', '').trim();
            inBot = ua === bot.toLowerCase() || ua === '*';
            continue;
        }
        if (!inBot) continue;
        if (lower.startsWith('allow:')) {
            const path = lower.replace('allow:', '').trim();
            if (path === '/' || path === '') foundAllow = true;
        }
        if (lower.startsWith('disallow:')) {
            const path = lower.replace('disallow:', '').trim();
            if (path === '/') foundDisallowRoot = true;
        }
    }
    if (foundDisallowRoot) return false;
    if (foundAllow) return true;
    return null;
}

function botCheck(robots: string, llm: string, bot: string, label: string): DiagnosticCheck {
    const robotsAccess = hasRobotsAllow(robots, bot);
    const llmAccess = hasRobotsAllow(llm, bot);
    if (robotsAccess === false || llmAccess === false) {
        return {
            label,
            status: 'fail',
            detail: `${bot} appears blocked in robots/llm directives.`,
            fix: `Allow ${bot} with 'User-agent: ${bot}' and 'Allow: /'.`,
        };
    }
    if (robotsAccess === true || llmAccess === true) {
        return {
            label,
            status: 'pass',
            detail: `${bot} appears allowed by robots/llm directives.`,
        };
    }
    return {
        label,
        status: 'warning',
        detail: `${bot} rules were not explicitly detected.`,
        fix: `Add explicit allow rules for ${bot}.`,
    };
}

function buildGroups(raw: DiagnosticsRawPayload): DiagnosticGroup[] {
    const robotsTxt = String(raw.robots_txt ?? raw.robotsTxt ?? '');
    const llmTxt = String(raw.llm_txt ?? raw.llmTxt ?? '');
    const summary = raw.summary || {};
    const schema = summary.schema_counts || {};

    const structuredCoverage = summary.structuredCoverage ?? null;
    const unstructuredCoverage = summary.unstructuredCoverage ?? null;
    const optimizationCount = toNum(summary.optimization_count);

    const structuredDataChecks: DiagnosticCheck[] = [
        {
            label: 'Schema.org Validity',
            status: toNum(schema.incorrect) > 0 || toNum(schema.missing) > 0 ? 'warning' : 'pass',
            detail: `${toNum(schema.valid)} valid, ${toNum(schema.incorrect)} incorrect, ${toNum(schema.missing)} missing.`,
            fix: toNum(schema.incorrect) > 0 || toNum(schema.missing) > 0
                ? 'Correct malformed schema and add missing required schema objects.'
                : undefined,
        },
        {
            label: 'Structured Coverage',
            status: (structuredCoverage ?? 0) >= 80 ? 'pass' : (structuredCoverage ?? 0) >= 60 ? 'warning' : 'fail',
            detail: `Structured coverage at ${structuredCoverage ?? 0}%.`,
            fix: (structuredCoverage ?? 0) < 80 ? 'Increase structured data coverage on key pages.' : undefined,
        },
    ];

    const contentChecks: DiagnosticCheck[] = [
        {
            label: 'Unstructured Coverage',
            status: (unstructuredCoverage ?? 0) >= 80 ? 'pass' : (unstructuredCoverage ?? 0) >= 60 ? 'warning' : 'fail',
            detail: `Unstructured coverage at ${unstructuredCoverage ?? 0}%.`,
            fix: (unstructuredCoverage ?? 0) < 80 ? 'Improve unstructured content depth and semantic relevance.' : undefined,
        },
        {
            label: 'Optimization Opportunities',
            status: optimizationCount <= 5 ? 'pass' : optimizationCount <= 15 ? 'warning' : 'fail',
            detail: `${optimizationCount} optimization opportunities identified.`,
            fix: optimizationCount > 5 ? 'Prioritize and address high-impact optimization opportunities.' : undefined,
        },
    ];

    return [
        {
            category: 'AI Crawlability',
            checks: [
                botCheck(robotsTxt, llmTxt, 'GPTBot', 'GPTBot Access'),
                botCheck(robotsTxt, llmTxt, 'GoogleOther', 'GoogleOther Access'),
                botCheck(robotsTxt, llmTxt, 'CCBot', 'CCBot Access'),
                botCheck(robotsTxt, llmTxt, 'PerplexityBot', 'PerplexityBot Access'),
            ],
        },
        { category: 'Structured Data', checks: structuredDataChecks },
        { category: 'Content Structure', checks: contentChecks },
    ];
}

function emptyDiagnostics(brandId: string | null, error?: string): DiagnosticsResponse {
    return {
        hasData: false,
        brandId,
        clientName: null,
        generationDate: null,
        summary: {
            structuredCoverage: null,
            unstructuredCoverage: null,
            optimizationOpportunities: null,
            overallAEOReadiness: null,
            schemaCounts: { valid: 0, incorrect: 0, missing: 0, other: 0 },
            totalSchemas: 0,
            optimizationCount: 0,
            caseMetricsFound: [],
        },
        executiveSummary: {
            surface: '',
            deeper: '',
            rootCauses: '',
        },
        groups: [],
        health: { score: 0, passed: 0, warnings: 0, failed: 0, total: 0 },
        source: 'none',
        ...(error ? { error } : {}),
    };
}

async function getBrand(userId: string, brandId?: string) {
    if (brandId) {
        return db.query.brandprofile.findFirst({
            where: and(eq(brandprofile.userId, userId), eq(brandprofile.id, brandId)),
        });
    }
    return db.query.brandprofile.findFirst({
        where: eq(brandprofile.userId, userId),
        orderBy: desc(brandprofile.createdAt),
    });
}

async function fetchDiagnosticsFromProvider(input: { brandId: string; brandName: string; brandUrl: string }): Promise<DiagnosticsRawPayload> {
    if (!env.DIAGNOSTICS_SERVICE_URL) {
        throw new Error('Diagnostics service URL is not configured');
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.DIAGNOSTICS_API_KEY) {
        headers.Authorization = `Bearer ${env.DIAGNOSTICS_API_KEY}`;
    }

    const response = await fetch(env.DIAGNOSTICS_SERVICE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            brandId: input.brandId,
            brandName: input.brandName,
            brandUrl: input.brandUrl,
        }),
    });

    if (!response.ok) {
        throw new Error(`Diagnostics provider error: ${response.status}`);
    }

    return response.json() as Promise<DiagnosticsRawPayload>;
}

export async function buildDiagnosticsAnalytics(input: {
    userId: string;
    brandId?: string;
}): Promise<DiagnosticsResponse> {
    const brand = await getBrand(input.userId, input.brandId);
    if (!brand) return emptyDiagnostics(null, 'Brand profile not found');

    let payload: DiagnosticsRawPayload;
    try {
        payload = await fetchDiagnosticsFromProvider({
            brandId: brand.id,
            brandName: brand.name,
            brandUrl: brand.url,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch diagnostics';
        return emptyDiagnostics(brand.id, message);
    }

    const summary = payload.summary || {};
    const schemaCounts = summary.schema_counts || {};
    const groups = buildGroups(payload);
    const checks = groups.flatMap((g) => g.checks);
    const passed = checks.filter((c) => c.status === 'pass').length;
    const warnings = checks.filter((c) => c.status === 'warning').length;
    const failed = checks.filter((c) => c.status === 'fail').length;
    const total = checks.length;

    return {
        hasData: true,
        brandId: brand.id,
        clientName: payload.client_name || brand.name,
        generationDate: payload.generation_date || null,
        summary: {
            structuredCoverage: summary.structuredCoverage ?? null,
            unstructuredCoverage: summary.unstructuredCoverage ?? null,
            optimizationOpportunities: summary.optimizationOpportunities ?? null,
            overallAEOReadiness: summary.overallAEOReadiness ?? null,
            schemaCounts: {
                valid: toNum(schemaCounts.valid),
                incorrect: toNum(schemaCounts.incorrect),
                missing: toNum(schemaCounts.missing),
                other: toNum(schemaCounts.other),
            },
            totalSchemas: toNum(summary.total_schemas),
            optimizationCount: toNum(summary.optimization_count),
            caseMetricsFound: Array.isArray(summary.case_metrics_found) ? summary.case_metrics_found : [],
        },
        executiveSummary: {
            surface: payload.executive_summary?.surface || '',
            deeper: payload.executive_summary?.deeper || '',
            rootCauses: payload.executive_summary?.root_causes || '',
        },
        groups,
        health: {
            score: summary.overallAEOReadiness != null ? Math.round(toNum(summary.overallAEOReadiness)) : (total > 0 ? Math.round((passed / total) * 100) : 0),
            passed,
            warnings,
            failed,
            total,
        },
        source: 'service',
    };
}
