// ─────────────────────────────────────────────────────────────
// src/services/ai.service.ts
// Sources:
//   - WebApp/lib/ai-utils.ts          (identifyCompetitors, resolveCompetitorUrlsFromNames,
//                                      generatePersonasForBrand, generatePromptsForCompany,
//                                      analyzePromptWithProvider, analyzeCompetitors,
//                                      analyzeCompetitorsByProvider, calculateBrandScores)
//   - WebApp/lib/ai-utils-enhanced.ts (analyzePromptWithProviderEnhanced)
//
// All AI-calling logic consolidated into one service.
// Heavy provider-level logic is unchanged; only imports are adapted.
// ─────────────────────────────────────────────────────────────

import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import {
    Company,
    BrandPrompt,
    AIResponse,
    CompanyRanking,
    CompetitorRanking,
    ProviderSpecificRanking,
    ProviderComparisonData,
    ProgressCallback,
    CompetitorFoundData,
    Persona,
    IdealCustomerProfile,
} from '../types';
import {
    getConfiguredProviders,
    getProviderModel,
    getPreferredProvider,
    normalizeProviderName,
    getProviderConfig,
} from '../config/providers';
import {
    detectBrandMention,
    getBrandDetectionOptions,
    BrandDetectionOptions,
} from '../utils/brand-detection.utils';
import { validateCompetitorUrl } from '../utils/url.utils';
import { calculateSentimentScore, determineSentiment } from '../utils/sentiment.utils';
import {
    PROMPT_GENERATION_SYSTEM_PROMPT,
    PERSONA_GENERATION_SYSTEM_PROMPT,
} from '../prompts';

const MAX_GENERATED_PROMPTS = 20;

function normalizePromptCategory(value: unknown): BrandPrompt['category'] {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
    const canonical = raw.replace(/\s+/g, '_');
    if (canonical === 'organic_discovery') return 'organic_discovery';
    if (canonical === 'category_authority') return 'category_authority';
    if (canonical === 'competitive_evaluation') return 'competitive_evaluation';
    if (canonical === 'replacement_intent') return 'replacement_intent';
    if (canonical === 'conversational_recall') return 'conversational_recall';
    if (canonical === 'comparison') return 'comparison';
    if (canonical === 'alternatives') return 'alternatives';
    if (canonical === 'recommendations') return 'recommendations';
    return 'ranking';
}

// ── Zod Schemas ───────────────────────────────────────────────

const RankingSchema = z.object({
    rankings: z.array(
        z.object({
            position: z.number(),
            company: z.string(),
            reason: z.string().optional(),
            sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
        }),
    ),
    analysis: z.object({
        brandMentioned: z.boolean(),
        brandPosition: z.number().optional(),
        competitors: z.array(z.string()),
        overallSentiment: z.enum(['positive', 'neutral', 'negative']),
        confidence: z.number().min(0).max(1),
    }),
});

const CompetitorUrlSchema = z.object({
    competitors: z.array(
        z.object({
            name: z.string(),
            url: z.string().optional().nullable(),
        }),
    ),
});

const GeoCompetitorSchema = z.object({
    competitors: z.array(
        z.object({
            name: z.string(),
            url: z.string(),
        }),
    ),
});

const ICPSchema = z.object({
    summary: z.string(),
    industries: z.array(z.string()),
    companySize: z.string(),
    annualRevenueRange: z.string(),
    geographies: z.array(z.string()),
    budgetRange: z.string(),
    buyingCommittee: z.array(z.string()),
    painPoints: z.array(z.string()),
    successCriteria: z.array(z.string()),
});

const RichICPSchema = z.object({
    icp_summary: z.string(),
    firmographics: z.record(z.unknown()),
    buyer_committee: z.record(z.unknown()),
    pain_points: z.array(z.string()),
    jtbd: z.object({
        functional: z.array(z.string()),
        emotional: z.array(z.string()),
        social: z.array(z.string()),
    }),
    ai_search_behavior: z.record(z.unknown()),
    trigger_events: z.array(z.string()),
    buying_criteria: z.object({
        must_have: z.array(z.string()),
        nice_to_have: z.array(z.string()),
        deal_breakers: z.array(z.string()),
    }),
    objections: z.array(z.string()),
    disqualification_criteria: z.array(z.string()),
    intent_signals: z.object({
        content: z.array(z.string()),
        behavioral: z.array(z.string()),
        technographic: z.array(z.string()),
        geo_relevant: z.array(z.string()),
    }),
    messaging_angles: z.object({
        value_props: z.array(z.string()),
        proof_points: z.array(z.string()),
    }),
    priority_segments: z.array(z.union([z.record(z.unknown()), z.string()])),
});

const BaseQuerySchema = z.object({
    query: z.string(),
});

function getLocationLabel(location?: string): string {
    const raw = (location ?? '').trim();
    if (!raw) return 'Global';
    const first = raw.split(',').map((part) => part.trim()).find(Boolean) || raw;
    return first;
}

function ensureLocationBasedPersonaRole(
    rawRole: unknown,
    rawName: unknown,
    company: Company,
    idx: number,
): string {
    const roleFromModel = typeof rawRole === 'string' ? rawRole.trim() : '';
    const nameFromModel = typeof rawName === 'string' ? rawName.trim() : '';
    let role = roleFromModel || nameFromModel;

    const locationLabel = getLocationLabel(company.location);
    const defaultRoleSeeds = ['Growth Marketer', 'Operations Lead', 'Product Evaluator'];
    const defaultSeed = defaultRoleSeeds[idx % defaultRoleSeeds.length];

    if (!role || /^unknown role$/i.test(role)) {
        role = `The ${locationLabel} ${defaultSeed}`;
    }

    if (locationLabel.toLowerCase() !== 'global') {
        const hasLocation = role.toLowerCase().includes(locationLabel.toLowerCase());
        if (!hasLocation) {
            role = `The ${locationLabel} ${role.replace(/^the\s+/i, '')}`;
        }
    }

    return role;
}

export interface GeneratedCompetitor {
    name: string;
    url: string;
}

function dedupeGeneratedCompetitors(
    competitors: GeneratedCompetitor[],
): GeneratedCompetitor[] {
    const seen = new Set<string>();
    return competitors.filter((c) => {
        const key = c.name.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export async function identifyCompetitorDetails(
    company: Company,
): Promise<GeneratedCompetitor[]> {
    const preferred = getPreferredProvider('openai');
    if (!preferred) throw new Error('No AI providers configured and enabled');
    const { model } = preferred;

    const companyContext = [
        `Company: ${company.name}`,
        company.industry ? `Industry: ${company.industry}` : '',
        company.description ? `Description: ${company.description}` : '',
        company.location ? `Location: ${company.location}` : '',
        company.scrapedData?.keywords?.length
            ? `Keywords: ${company.scrapedData.keywords.join(', ')}`
            : '',
        company.scrapedData?.mainProducts?.length
            ? `Main products: ${company.scrapedData.mainProducts.join(', ')}`
            : '',
    ]
        .filter(Boolean)
        .join('\n');

    const parseGenerated = (object: z.infer<typeof GeoCompetitorSchema>): GeneratedCompetitor[] =>
        dedupeGeneratedCompetitors(
            object.competitors
                .map((entry) => {
                    const name = entry.name.trim();
                    const url = validateCompetitorUrl(entry.url);
                    if (!name || !url) return null;
                    return { name, url } as GeneratedCompetitor;
                })
                .filter((entry): entry is GeneratedCompetitor => Boolean(entry)),
        );

    const localPrompt = `Identify exactly 5 direct LOCAL competitors.

${companyContext}

Rules:
- Prefer same city/region/country as the company location.
- If city-level is limited, use same country.
- Must be direct competitors with similar offering and customer segment.
- Return only valid JSON:
{"competitors":[{"name":"Competitor Name","url":"domain.com"}]}`;

    const localObject = await generateObject({
        model,
        schema: GeoCompetitorSchema,
        prompt: localPrompt,
        temperature: 0.2,
    });
    const local = parseGenerated(localObject.object).slice(0, 5);

    const localNames = local.map((c) => c.name).join(', ');
    const globalPrompt = `Identify exactly 5 direct GLOBAL competitors outside the company's location.

${companyContext}
Exclude these names: ${localNames || 'none'}

Rules:
- Must be from outside the company location/region.
- Must be direct competitors with similar offering and customer segment.
- Do not repeat excluded names.
- Return only valid JSON:
{"competitors":[{"name":"Competitor Name","url":"domain.com"}]}`;

    const globalObject = await generateObject({
        model,
        schema: GeoCompetitorSchema,
        prompt: globalPrompt,
        temperature: 0.2,
    });
    const global = parseGenerated(globalObject.object)
        .filter((c) => !local.some((l) => l.name.toLowerCase() === c.name.toLowerCase()))
        .slice(0, 5);

    return [...local, ...global].slice(0, 10);
}

// ── Competitor Identification ─────────────────────────────────

export async function identifyCompetitors(
    company: Company,
    progressCallback?: ProgressCallback,
): Promise<string[]> {
    try {
        const detailed = await identifyCompetitorDetails(company);
        let competitors = detailed.map((c) => c.name);

        if (company.scrapedData?.competitors) {
            company.scrapedData.competitors.forEach((comp) => {
                const name = typeof comp === 'string' ? comp : (comp as any).name;
                if (name && !competitors.some((c) => c.toLowerCase() === String(name).toLowerCase())) {
                    competitors.push(String(name));
                }
            });
        }

        competitors = competitors.slice(0, 10);

        if (progressCallback) {
            for (let i = 0; i < competitors.length; i++) {
                progressCallback({
                    type: 'competitor-found',
                    stage: 'identifying-competitors',
                    data: { competitor: competitors[i], index: i + 1, total: competitors.length } as CompetitorFoundData,
                    timestamp: new Date(),
                });
            }
        }

        return competitors;
    } catch (error) {
        console.error('Error identifying competitors:', error);
        return (
            company.scrapedData?.competitors?.map((c) =>
                typeof c === 'string' ? c : (c as any).name,
            ) || []
        );
    }
}

// ── Competitor URL Resolution ─────────────────────────────────

export async function resolveCompetitorUrlsFromNames(
    company: Company,
    competitors: string[],
): Promise<{ name: string; url?: string }[]> {
    if (!competitors?.length) return [];

    // Prefer Ollama when OLLAMA_ENABLED=true, otherwise use openai
    const preferred = getPreferredProvider('openai');
    if (!preferred) return competitors.map((name) => ({ name }));
    const { model } = preferred;

    const contextLines = [
        `Company: ${company.name}`,
        company.industry ? `Industry: ${company.industry}` : '',
        company.description ? `Description: ${company.description}` : '',
        company.location ? `Location: ${company.location}` : '',
        company.scrapedData?.keywords?.length ? `Keywords: ${company.scrapedData.keywords.join(', ')}` : '',
        company.scrapedData?.mainProducts?.length ? `Main products: ${company.scrapedData.mainProducts.join(', ')}` : '',
    ]
        .filter(Boolean)
        .join('\n');

    const prompt = `Given the company context and the competitor names below, return the primary official website domain for each competitor.
Return only JSON that matches this schema:
{"competitors":[{"name":"string","url":"domain.com"}]}

Rules:
- Use the most common official domain (no protocol, no path).
- Prefer the main corporate domain (not a careers site or subdomain).
- Keep the original competitor names (no renaming).
- Do NOT return null unless the competitor is truly unknown.

${contextLines}

Competitors:
${competitors.map((name) => `- ${name}`).join('\n')}
`;

    try {
        const { object } = await generateObject({ model, schema: CompetitorUrlSchema, prompt, temperature: 0.2 });

        const urlByName = new Map<string, string | undefined>();
        object.competitors.forEach((entry) => {
            const nameKey = entry.name.trim().toLowerCase();
            const cleaned = entry.url ? validateCompetitorUrl(entry.url) : undefined;
            if (nameKey) urlByName.set(nameKey, cleaned);
        });

        return competitors.map((name) => {
            const url = urlByName.get(name.trim().toLowerCase());
            return url ? { name, url } : { name };
        });
    } catch (error) {
        console.warn('Failed to resolve competitor URLs:', error);
        return competitors.map((name) => ({ name }));
    }
}

// ── Persona Generation ────────────────────────────────────────

export async function generatePersonasForBrand(company: Company): Promise<Persona[]> {
    // Prefer Ollama when OLLAMA_ENABLED=true, otherwise use google
    const preferred = getPreferredProvider('google');
    if (!preferred) return [];
    const { model } = preferred;

    const systemPrompt = PERSONA_GENERATION_SYSTEM_PROMPT({
        brandName: company.name,
        industry: company.industry ?? '',
        mainProducts: company.scrapedData?.mainProducts?.join(', ') ?? '',
        keywords: company.scrapedData?.keywords?.join(', ') ?? '',
        description: company.scrapedData?.description ?? company.description ?? '',
        competitors: '',
        location: company.location,
    });

    try {
        const { text } = await generateText({
            model,
            system: 'You are a marketing strategist. Return only valid JSON.',
            prompt: systemPrompt,
            temperature: 0.5,
        });

        const object = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
        if (object && Array.isArray(object.personas)) {
            return object.personas.map((p: any, idx: number) => ({
                id: `persona-${idx}`,
                role: ensureLocationBasedPersonaRole(p?.role, p?.name, company, idx),
                description: p.description ?? '',
                painPoints: Array.isArray(p.painPoints) ? p.painPoints : [],
                goals: Array.isArray(p.goals) ? p.goals : [],
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                    ensureLocationBasedPersonaRole(p?.role, p?.name, company, idx),
                )}`,
            }));
        }
    } catch (err) {
        console.error('Failed to generate personas:', err);
    }
    return [];
}

export async function generateIcpForBrand(
    company: Company,
    additionalInputs?: Record<string, string>,
): Promise<IdealCustomerProfile> {
    const preferred = getPreferredProvider('google');
    if (!preferred) throw new Error('No AI providers configured and enabled');
    const { model } = preferred;

    const extras = additionalInputs ?? {};
    const productSummary =
        extras.product_summary ??
        company.scrapedData?.description ??
        company.description ??
        '';
    const customerSignals = extras.customer_signals ?? '';
    const usp = extras.usp ?? '';
    const competitors =
        extras.competitors ??
        company.scrapedData?.competitors?.join(', ') ??
        '';
    const geo = extras.geo ?? company.location ?? '';
    const pricePoint = extras.price_point ?? '';
    const salesMotion = extras.sales_motion ?? '';

    const prompt = `You are a senior B2B GTM strategist and AI-era buyer behavior analyst.

Create an Ideal Customer Profile (ICP) for the company below.

This ICP will be used to:

Simulate AI search queries

Model decision-making behavior

Generate GEO/AEO monitoring prompts

Identify competitive displacement patterns

Company context:

Brand name: ${company.name}

Website: ${company.url}

Industry: ${company.industry ?? ''}

Product/Service summary: ${productSummary}

Current customer signals (if any): ${customerSignals}

Positioning/USP: ${usp}

Competitors: ${competitors}

Geography focus: ${geo}

Price point: ${pricePoint}

Sales motion: ${salesMotion}

Output requirements:

ICP Summary (2-4 lines, specific and hypothesis-driven)

Firmographic Profile

Company size (employee range)

Revenue range

Industry/sub-industries

Geography

Company maturity stage

Budget ownership likelihood

Buyer Committee

Economic buyer

Champion/user buyer

Technical evaluator

Blocking stakeholders

Decision complexity (Low / Medium / High)

Ranked Pain Points (Top 10, in priority order)

Jobs-to-be-Done

Functional

Emotional

Social

AI Search & Research Behavior (CRITICAL)

How they phrase AI queries (short, analytical, comparison-heavy, conversational, etc.)

Likelihood to ask vs comparisons

Likelihood to request citations

Budget sensitivity in search phrasing

Urgency bias in queries

Trigger Events (what makes them buy now)

Buying Criteria

Must-have

Nice-to-have

Deal-breakers

Objections & Risk Concerns

Disqualification Criteria (who NOT to target)

Intent Signals to Prioritize

Content signals

Behavioral signals

Technographic signals

GEO-relevant signals (AI monitoring interest, competitor comparison searches, etc.)

Messaging Angles

5 differentiated value propositions

5 proof points required to win

Priority Segments
For each:

Segment name

Why now

Estimated win probability (Low/Med/High)

Recommended acquisition channel

Expected sales cycle length

Constraints:

Be specific and non-generic.

Prefer testable hypotheses.

If data is missing, state assumptions.

Keep concise but actionable.

Align ICP behavior with price point and sales motion.

Reflect competitive dynamics vs ${competitors}.

Return valid JSON:

{
"icp_summary": "",
"firmographics": {},
"buyer_committee": {},
"pain_points": [],
"jtbd": {"functional": [], "emotional": [], "social": []},
"ai_search_behavior": {},
"trigger_events": [],
"buying_criteria": {"must_have": [], "nice_to_have": [], "deal_breakers": []},
"objections": [],
"disqualification_criteria": [],
"intent_signals": {"content": [], "behavioral": [], "technographic": [], "geo_relevant": []},
"messaging_angles": {"value_props": [], "proof_points": []},
"priority_segments": []
}`;

    const { object } = await generateObject({
        model,
        schema: RichICPSchema,
        prompt,
        temperature: 0.3,
    });

    const firmographics = object.firmographics ?? {};
    const buyerCommittee = object.buyer_committee ?? {};
    const getString = (value: unknown): string =>
        typeof value === 'string' ? value : '';
    const getStringArray = (value: unknown): string[] =>
        Array.isArray(value)
            ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            : [];

    const icp: IdealCustomerProfile = {
        summary: object.icp_summary,
        industries:
            getStringArray((firmographics as Record<string, unknown>).industries).length > 0
                ? getStringArray((firmographics as Record<string, unknown>).industries)
                : getString((firmographics as Record<string, unknown>).industry_sub_industries)
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
        companySize:
            getString((firmographics as Record<string, unknown>).company_size) ||
            getString((firmographics as Record<string, unknown>).employee_range),
        annualRevenueRange: getString((firmographics as Record<string, unknown>).revenue_range),
        geographies:
            getStringArray((firmographics as Record<string, unknown>).geography).length > 0
                ? getStringArray((firmographics as Record<string, unknown>).geography)
                : getString((firmographics as Record<string, unknown>).geography)
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
        budgetRange: getString((firmographics as Record<string, unknown>).budget_ownership_likelihood),
        buyingCommittee: [
            ...getStringArray((buyerCommittee as Record<string, unknown>).economic_buyer),
            ...getStringArray((buyerCommittee as Record<string, unknown>).champion_user_buyer),
            ...getStringArray((buyerCommittee as Record<string, unknown>).technical_evaluator),
            ...getStringArray((buyerCommittee as Record<string, unknown>).blocking_stakeholders),
        ].filter(Boolean),
        painPoints: object.pain_points,
        successCriteria: object.buying_criteria.must_have,
        icp_summary: object.icp_summary,
        firmographics: object.firmographics,
        buyer_committee: object.buyer_committee,
        pain_points: object.pain_points,
        jtbd: object.jtbd,
        ai_search_behavior: object.ai_search_behavior,
        trigger_events: object.trigger_events,
        buying_criteria: object.buying_criteria,
        objections: object.objections,
        disqualification_criteria: object.disqualification_criteria,
        intent_signals: object.intent_signals,
        messaging_angles: object.messaging_angles,
        priority_segments: object.priority_segments,
    };

    return icp;
}

export async function generateBaseQueryForBrand(input: {
    brandName: string;
    industry?: string;
    location?: string;
    audience?: string;
    usp?: string[];
    mainProducts?: string[];
}): Promise<string> {
    const preferred = getPreferredProvider('google');
    if (!preferred) throw new Error('No AI providers configured and enabled');
    const { model } = preferred;

    const prompt = `Create one high-intent base search query for brand visibility analysis.

Brand: ${input.brandName}
Industry: ${input.industry ?? ''}
Location: ${input.location ?? ''}
Target Audience: ${input.audience ?? ''}
USP: ${(input.usp ?? []).join(', ')}
Products/Services: ${(input.mainProducts ?? []).join(', ')}

Rules:
- Return exactly one query string in JSON.
- Make it location-aware when location is available.
- Use industry + audience + USP + product context.
- Query should be about finding options/solutions in this category.
- Do NOT use the exact brand name in the query.
- It can reference similar products/companies in the category, but not the same company.
- Keep it concise and realistic (8-16 words).
`;

    const { object } = await generateObject({
        model,
        schema: BaseQuerySchema,
        prompt,
        temperature: 0.3,
    });

    return object.query.trim();
}

// ── Prompt Generation ─────────────────────────────────────────

export async function generatePromptsForCompany(
    company: Company,
    competitors: string[],
    customPersonas?: Persona[],
    icp?: IdealCustomerProfile | null,
): Promise<BrandPrompt[]> {
    const prompts: BrandPrompt[] = [];
    let promptId = 0;

    const brandName = company.name;
    const keywords = company.scrapedData?.keywords ?? [];
    const mainProducts = company.scrapedData?.mainProducts ?? [];
    const description = company.scrapedData?.description ?? company.description ?? '';
    const industry = company.industry ?? '';
    const location = company.location;

    // 1. Personas
    let personas: Persona[] = customPersonas ?? [];
    if (personas.length === 0) {
        personas = await generatePersonasForBrand(company);
    }

    // Prefer Ollama when OLLAMA_ENABLED=true, otherwise use google
    const preferred = getPreferredProvider('google');
    if (!preferred) throw new Error('No AI providers configured and enabled');
    const { model } = preferred;

    const systemPrompt = PROMPT_GENERATION_SYSTEM_PROMPT({
        brandName,
        location,
        industry,
        mainProducts: mainProducts.join(', '),
        keywords: keywords.join(', '),
        description,
        competitors: competitors.join(', '),
        personas: personas.length > 0 ? personas : undefined,
        icp: icp ?? undefined,
    });

    const { text } = await generateText({
        model,
        system: 'You are a helpful assistant that generates JSON. Only return valid JSON.',
        prompt: systemPrompt,
        temperature: 0.3,
    });

    let object: any = null;
    try {
        const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
        object = JSON.parse(cleanText);
    } catch {
        console.warn('Failed to parse AI output as JSON');
    }

    let promptsData: any[] = [];
    if (Array.isArray(object)) {
        promptsData = object;
    } else if (object && typeof object === 'object') {
        if (Array.isArray(object.input)) promptsData = object.input;
        else if (Array.isArray(object.prompts)) promptsData = object.prompts;
        else {
            const firstArray = Object.values(object).find((v) => Array.isArray(v));
            if (firstArray) promptsData = firstArray as any[];
        }
    }

    if (promptsData.length > 0) {
        const mapped = promptsData.map((p) => {
            let promptText = 'Unknown prompt';
            let category: BrandPrompt['category'] = 'ranking';
            if (typeof p === 'string') {
                promptText = p;
            } else if (typeof p === 'object' && p !== null) {
                promptText = p.prompt || p.text || p.query || p.question || 'Unknown prompt';
                category = normalizePromptCategory(p.category);
            }
            return {
                id: (p?.id) || (++promptId).toString(),
                prompt: promptText,
                category,
                persona: p?.persona,
                confidence: typeof p?.confidence === 'number' ? p.confidence : undefined,
                source: p?.source || 'ai',
                metadata: p?.metadata,
            } as BrandPrompt;
        });
        return mapped.slice(0, MAX_GENERATED_PROMPTS);
    }

    // Fallback templates
    console.warn('AI returned no valid prompts — using fallback templates');
    const data: Record<string, string[]> = {
        ranking: [
            `best ${mainProducts[0] ?? 'products'} in 2025`,
            `top ${industry ?? 'brands'} ranked by quality`,
            `most recommended ${mainProducts[0] ?? 'solutions'}`,
            `highest rated ${mainProducts[0] ?? 'tools'} for ${industry ?? 'businesses'}`,
        ],
        comparison: [
            `${brandName} vs ${competitors[0] ?? 'top competitors'} for ${mainProducts[0] ?? 'solutions'}`,
            `how does ${brandName} compare to other ${industry ?? 'companies'}`,
            `${competitors[0] ?? 'another brand'} or ${brandName} which is better`,
        ],
        alternatives: [
            `alternatives to ${brandName} ${mainProducts[0] ?? ''}`.trim(),
            `${industry ?? 'brands'} similar to ${brandName}`,
            `competitors of ${brandName}`,
        ],
        recommendations: [
            `is ${brandName} worth buying for ${keywords[0] ?? 'users'}`,
            `${brandName} ${mainProducts[0] ?? 'product'} reviews`,
            `should I buy ${brandName} or other ${industry ?? 'brands'}`,
        ],
    };

    Object.entries(data).forEach(([category, templates]) => {
        templates.forEach((prompt) => {
            prompts.push({ id: (++promptId).toString(), prompt, category: category as BrandPrompt['category'] });
        });
    });

    return prompts;
}

// ── Single-Provider Prompt Analysis ──────────────────────────

export async function analyzePromptWithProvider(
    prompt: string,
    provider: string,
    brandName: string,
    competitors: string[],
    useMockMode = false,
    detectionContext?: { brandUrls?: string[]; competitorUrls?: Record<string, string[]> },
): Promise<AIResponse | null> {
    if (useMockMode || provider === 'Mock') return _generateMockResponse(prompt, provider, brandName, competitors);

    const brandUrls = detectionContext?.brandUrls ?? [];
    const competitorUrlMap = detectionContext?.competitorUrls ?? {};
    const normalizedProvider = normalizeProviderName(provider);
    const model = getProviderModel(normalizedProvider);

    if (!model) {
        console.warn(`Provider ${provider} not configured, skipping`);
        return null;
    }

    const systemPrompt = `You are an objective AI analyst evaluating tools, platforms, or service providers relevant to the query below.

Follow these rules:

If tools, platforms, or providers are relevant:

Provide up to 5 ranked recommendations.

Rank them strictly in order of suitability.

Do NOT automatically prioritize companies mentioned in the question.

Only include companies that are genuinely relevant.

If a mentioned company is weak or not competitive, you may rank it lower or exclude it.

If the query is informational:

Provide a structured practical summary.

Then include recommended tools only if clearly relevant.

Be factual and neutral.

No marketing tone.

No fabricated data.

If insufficient information exists, state that clearly.

Respond strictly in JSON format:

{
"summary": "Structured explanation of the answer",
"recommended_solutions": [
{
"name": "Company Name",
"ranking_position": 1,
"reason": "Why it is ranked here",
"best_for": "Type of business",
"sentiment": "positive | neutral | negative"
}
],
"citations": [
"Reference or source text if applicable"
],
"notes": "If no dominant providers exist, clearly state it here."
}`;

    try {
        const maxAttempts = normalizedProvider === 'google' ? 3 : 1;
        let text = '';
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await generateText({
                    model,
                    system: systemPrompt,
                    prompt: `Now answer this query:\n\n${prompt}`,
                    temperature: normalizedProvider === 'google' ? 0.8 : 0.7,
                    maxTokens: normalizedProvider === 'google' ? 1000 : 800,
                });
                text = result.text;
                if (text?.length) break;
                if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1000 * attempt));
            } catch (attemptErr) {
                if (attempt === maxAttempts) throw attemptErr;
                await new Promise((r) => setTimeout(r, 1000 * attempt));
            }
        }

        if (!text?.length) throw new Error(`${provider} returned empty response`);

        const analysisPrompt = buildAnalysisPrompt(brandName, text, competitors);
        let object: any;

        try {
            // Use preferred provider for structured analysis (Ollama if enabled, else google/gemini)
            const analysisPreferred = getPreferredProvider('google');
            const analysisModel = (analysisPreferred?.model) || model;
            const result = await generateObject({ model: analysisModel, schema: RankingSchema, prompt: analysisPrompt, temperature: 0.3, maxRetries: 2 });
            object = result.object;
        } catch {
            const brandDetection = detectBrandMention(text, brandName, _buildDetectionOptions(brandName, brandUrls));
            return _buildFallbackResponse(provider, prompt, text, brandName, competitors, competitorUrlMap, brandDetection, brandUrls);
        }

        const baseBrandOptions = getBrandDetectionOptions(brandName);
        const brandDetectionOptions: BrandDetectionOptions = {
            ...baseBrandOptions,
            brandUrls: brandUrls.length > 0 ? brandUrls : baseBrandOptions.brandUrls,
            includeUrlDetection: baseBrandOptions.includeUrlDetection ?? brandUrls.length > 0,
        };

        const brandDetectionResult = detectBrandMention(text, brandName, brandDetectionOptions);
        const brandMentioned = object.analysis.brandMentioned || brandDetectionResult.mentioned;

        const competitorDetectionResults = new Map<string, any>();
        competitors.forEach((competitor) => {
            const baseOpts = getBrandDetectionOptions(competitor);
            const urls = competitorUrlMap[competitor.toLowerCase()];
            const opts: BrandDetectionOptions = {
                ...baseOpts,
                brandUrls: urls?.length ? urls : baseOpts.brandUrls,
                includeUrlDetection: baseOpts.includeUrlDetection ?? (!!urls?.length),
            };
            competitorDetectionResults.set(competitor, detectBrandMention(text, competitor, opts));
        });

        const allMentioned = new Set([...object.analysis.competitors]);
        competitorDetectionResults.forEach((result, name) => {
            if (result.mentioned && name !== brandName) allMentioned.add(name);
        });

        const relevantCompetitors = Array.from(allMentioned).filter(
            (c) => competitors.includes(c) && c !== brandName,
        );

        const rankings: CompanyRanking[] = object.rankings.map((r: any) => ({
            position: r.position,
            company: r.company,
            reason: r.reason,
            sentiment: r.sentiment,
        }));

        const providerDisplayName = _displayName(provider);

        return {
            provider: providerDisplayName,
            prompt,
            response: text,
            rankings,
            competitors: relevantCompetitors,
            brandMentioned,
            brandPosition: object.analysis.brandPosition,
            sentiment: object.analysis.overallSentiment,
            confidence: object.analysis.confidence,
            timestamp: new Date(),
            detectionDetails: {
                brandMatches: brandDetectionResult.matches.map((m) => ({
                    text: m.text,
                    index: m.index,
                    confidence: m.confidence,
                })),
                competitorMatches: new Map(
                    Array.from(competitorDetectionResults.entries())
                        .filter(([, result]) => result.mentioned)
                        .map(([name, result]) => [
                            name,
                            result.matches.map((m: any) => ({ text: m.text, index: m.index, confidence: m.confidence })),
                        ]),
                ),
            },
        };
    } catch (error) {
        console.error(`Error with ${provider}:`, error);
        throw error;
    }
}

// ── Web-Search Enhanced Analysis ──────────────────────────────

export async function analyzePromptWithProviderEnhanced(
    prompt: string,
    provider: string,
    brandName: string,
    competitors: string[],
    useMockMode = false,
    useWebSearch = true,
    detectionContext?: { brandUrls?: string[]; competitorUrls?: Record<string, string[]> },
): Promise<AIResponse | null> {
    if (useMockMode || provider === 'Mock') return _generateMockResponse(prompt, provider, brandName, competitors);

    const brandUrls = detectionContext?.brandUrls ?? [];
    const competitorUrlMap = detectionContext?.competitorUrls ?? {};
    const normalizedProvider = normalizeProviderName(provider);
    const providerConfig = getProviderConfig(normalizedProvider);

    if (!providerConfig || !providerConfig.isConfigured()) {
        console.warn(`Provider ${provider} not configured, skipping`);
        return null;
    }

    const model = getProviderModel(normalizedProvider, undefined, { useWebSearch });
    if (!model) {
        console.warn(`Failed to get model for ${provider}`);
        return null;
    }

    const systemPrompt = `You are an AI assistant analyzing brand visibility and rankings.
When responding to prompts about tools, platforms, or services:
1. Provide rankings with specific positions (1st, 2nd, etc.)
2. Focus on the companies mentioned in the prompt
3. Be objective and factual${useWebSearch ? ', using current web information when available' : ''}
4. Explain briefly why each tool is ranked where it is
5. If you don't have enough information about a specific company, you can mention that
6. ${useWebSearch ? 'Prioritize recent, factual information from web searches' : 'Use your knowledge base'}`;

    const enhancedPrompt = useWebSearch
        ? `${prompt}\n\nPlease search for current, factual information to answer this question. Focus on recent data and real user opinions.`
        : prompt;

    try {
        const { text } = await generateText({ model, system: systemPrompt, prompt: enhancedPrompt, temperature: 0.7, maxTokens: 800 });

        let object: any;
        try {
            // Use preferred provider for structured analysis (Ollama if enabled, else openai)
            const analysisPreferred = getPreferredProvider('openai');
            if (!analysisPreferred) throw new Error('Analysis model not available');
            const result = await generateObject({
                model: analysisPreferred.model,
                system: 'You are an expert at analyzing text and extracting structured information about companies and rankings.',
                prompt: buildAnalysisPrompt(brandName, text, competitors),
                schema: RankingSchema,
                temperature: 0.3,
            });
            object = result.object;
        } catch {
            const brandNameLower = brandName.toLowerCase();
            const textLower = text.toLowerCase();
            const mentioned =
                textLower.includes(brandNameLower) ||
                textLower.includes(brandNameLower.replace(/\s+/g, '')) ||
                textLower.includes(brandNameLower.replace(/[^a-z0-9]/g, ''));
            const detectedCompetitors = competitors.filter((c) => {
                const cLower = c.toLowerCase();
                return textLower.includes(cLower) || textLower.includes(cLower.replace(/\s+/g, '')) || textLower.includes(cLower.replace(/[^a-z0-9]/g, ''));
            });
            object = { rankings: [], analysis: { brandMentioned: mentioned, brandPosition: undefined, competitors: detectedCompetitors, overallSentiment: 'neutral', confidence: 0.5 } };
        }

        const baseBrandOptions = getBrandDetectionOptions(brandName);
        const brandDetectionResult = detectBrandMention(text, brandName, {
            ...baseBrandOptions,
            brandUrls: brandUrls.length > 0 ? brandUrls : baseBrandOptions.brandUrls,
            includeUrlDetection: baseBrandOptions.includeUrlDetection ?? brandUrls.length > 0,
        });

        let brandMentioned = object.analysis.brandMentioned || brandDetectionResult.mentioned;
        if (!brandMentioned) {
            const textLower = text.toLowerCase();
            const brandNameLower = brandName.toLowerCase();
            brandMentioned = textLower.includes(brandNameLower) || textLower.includes(brandNameLower.replace(/\s+/g, '')) || textLower.includes(brandNameLower.replace(/[^a-z0-9]/g, ''));
        }

        const allMentioned = new Set(object.analysis.competitors);
        competitors.forEach((competitor) => {
            const baseOpts = getBrandDetectionOptions(competitor);
            const urls = competitorUrlMap[competitor.toLowerCase()];
            const detection = detectBrandMention(text, competitor, {
                ...baseOpts,
                brandUrls: urls?.length ? urls : baseOpts.brandUrls,
                includeUrlDetection: baseOpts.includeUrlDetection ?? !!urls?.length,
            });
            const textLower = text.toLowerCase();
            const cLower = competitor.toLowerCase();
            if ((detection.mentioned && competitor !== brandName) || textLower.includes(cLower)) {
                allMentioned.add(competitor);
            }
        });

        const relevantCompetitors = Array.from(allMentioned).filter(
            (c) => competitors.includes(c as string) && c !== brandName,
        ) as string[];

        return {
            provider: _displayName(provider),
            prompt,
            response: text,
            rankings: object.rankings,
            competitors: relevantCompetitors,
            brandMentioned,
            brandPosition: object.analysis.brandPosition,
            sentiment: object.analysis.overallSentiment,
            confidence: object.analysis.confidence,
            timestamp: new Date(),
        };
    } catch (error) {
        console.error(`Error with ${provider}:`, error);
        throw error;
    }
}

// ── Competitor Aggregation ────────────────────────────────────

export async function analyzeCompetitors(
    company: Company,
    responses: AIResponse[],
    knownCompetitors: string[],
): Promise<CompetitorRanking[]> {
    const trackedCompanies = new Set([company.name, ...knownCompetitors]);
    const competitorMap = new Map<string, { mentions: number; positions: number[]; sentiments: ('positive' | 'neutral' | 'negative')[] }>();

    trackedCompanies.forEach((name) => competitorMap.set(name, { mentions: 0, positions: [], sentiments: [] }));

    responses.forEach((response) => {
        const mentionedInResponse = new Set<string>();

        response.rankings?.forEach((ranking) => {
            if (trackedCompanies.has(ranking.company)) {
                const data = competitorMap.get(ranking.company)!;
                if (!mentionedInResponse.has(ranking.company)) { data.mentions++; mentionedInResponse.add(ranking.company); }
                data.positions.push(ranking.position);
                if (ranking.sentiment) data.sentiments.push(ranking.sentiment);
            }
        });

        if (Array.isArray(response.competitors)) {
            response.competitors.forEach((name) => {
                if (name === company.name) return;
                if (trackedCompanies.has(name)) {
                    const data = competitorMap.get(name)!;
                    if (!mentionedInResponse.has(name)) { data.mentions++; mentionedInResponse.add(name); }
                    if (response.sentiment) data.sentiments.push(response.sentiment);
                }
            });
        }

        if (response.brandMentioned && trackedCompanies.has(company.name) && !mentionedInResponse.has(company.name)) {
            const data = competitorMap.get(company.name)!;
            data.mentions++;
            if (response.brandPosition) data.positions.push(response.brandPosition);
            data.sentiments.push(response.sentiment);
        }
    });

    const totalResponses = responses.length;
    const competitors: CompetitorRanking[] = [];

    competitorMap.forEach((data, name) => {
        const avgPosition = data.positions.length > 0 ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length : 99;
        const sentimentScore = calculateSentimentScore(data.sentiments);
        const visibilityScore = (data.mentions / totalResponses) * 100;

        competitors.push({
            name,
            mentions: data.mentions,
            averagePosition: Math.round(avgPosition * 10) / 10,
            sentiment: determineSentiment(data.sentiments),
            sentimentScore,
            shareOfVoice: 0,
            visibilityScore: Math.round(visibilityScore * 10) / 10,
            weeklyChange: undefined,
            isOwn: name === company.name,
        });
    });

    const totalMentions = competitors.reduce((sum, c) => sum + c.mentions, 0);
    competitors.forEach((c) => {
        c.shareOfVoice = totalMentions > 0 ? Math.round((c.mentions / totalMentions) * 1000) / 10 : 0;
    });

    return competitors.sort((a, b) => b.visibilityScore - a.visibilityScore);
}

// ── Provider-Level Breakdown ──────────────────────────────────

export async function analyzeCompetitorsByProvider(
    company: Company,
    responses: AIResponse[],
    knownCompetitors: string[],
): Promise<{ providerRankings: ProviderSpecificRanking[]; providerComparison: ProviderComparisonData[] }> {
    const trackedCompanies = new Set([company.name, ...knownCompetitors]);
    const MAX_POS = 10;
    const COV_W = 0.6;
    const POS_W = 0.4;

    const configuredProviders = getConfiguredProviders();
    let providers = configuredProviders.map((p) => p.name);
    if (providers.length === 0) providers = ['OpenAI', 'Anthropic', 'Google'];

    const providerData = new Map<string, Map<string, { mentions: number; positions: number[]; sentiments: ('positive' | 'neutral' | 'negative')[] }>>();
    providers.forEach((provider) => {
        const map = new Map<string, { mentions: number; positions: number[]; sentiments: ('positive' | 'neutral' | 'negative')[] }>();
        trackedCompanies.forEach((name) => map.set(name, { mentions: 0, positions: [], sentiments: [] }));
        providerData.set(provider, map);
    });

    responses.forEach((response) => {
        const providerMap = providerData.get(response.provider);
        if (!providerMap) return;
        const mentionedInResponse = new Set<string>();

        response.rankings?.forEach((ranking) => {
            if (trackedCompanies.has(ranking.company)) {
                const data = providerMap.get(ranking.company)!;
                if (!mentionedInResponse.has(ranking.company)) { data.mentions++; mentionedInResponse.add(ranking.company); }
                data.positions.push(ranking.position);
                if (ranking.sentiment) data.sentiments.push(ranking.sentiment);
            }
        });

        if (Array.isArray(response.competitors)) {
            response.competitors.forEach((name) => {
                if (name === company.name) return;
                if (trackedCompanies.has(name)) {
                    const data = providerMap.get(name)!;
                    if (!mentionedInResponse.has(name)) { data.mentions++; mentionedInResponse.add(name); }
                    if (response.sentiment) data.sentiments.push(response.sentiment);
                }
            });
        }

        if (response.brandMentioned && trackedCompanies.has(company.name)) {
            const data = providerMap.get(company.name)!;
            const alreadyCounted = mentionedInResponse.has(company.name) || response.rankings?.some((r) => r.company === company.name);
            if (!alreadyCounted) {
                data.mentions++;
                if (response.brandPosition) data.positions.push(response.brandPosition);
                data.sentiments.push(response.sentiment);
                mentionedInResponse.add(company.name);
            }
        }
    });

    const providerRankings: ProviderSpecificRanking[] = [];

    providers.forEach((provider) => {
        const competitorMap = providerData.get(provider)!;
        const providerResponses = responses.filter((r) => r.provider === provider);
        const totalResponses = providerResponses.length;
        const competitors: CompetitorRanking[] = [];

        competitorMap.forEach((data, name) => {
            const avgPosition = data.positions.length > 0 ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length : null;
            const avgPosValue = avgPosition !== null ? Math.round(avgPosition * 10) / 10 : 0;
            const coverageScore = totalResponses > 0 ? Math.min(100, (data.mentions / totalResponses) * 100) : 0;

            let positionScore = 0;
            if (avgPosition !== null) {
                const clamped = Math.max(1, Math.min(avgPosition, MAX_POS));
                positionScore = ((MAX_POS - clamped) / (MAX_POS - 1)) * 100;
            } else if (data.mentions > 0) {
                positionScore = 35;
            }

            const rawVisibility = coverageScore * COV_W + positionScore * POS_W;
            competitors.push({
                name,
                mentions: data.mentions,
                averagePosition: avgPosValue,
                sentiment: determineSentiment(data.sentiments),
                sentimentScore: calculateSentimentScore(data.sentiments),
                shareOfVoice: 0,
                visibilityScore: rawVisibility,
                isOwn: name === company.name,
            });
        });

        const totalMentions = competitors.reduce((sum, c) => sum + c.mentions, 0);
        competitors.forEach((c) => {
            c.shareOfVoice = totalMentions > 0 ? Math.round((c.mentions / totalMentions) * 1000) / 10 : 0;
        });

        const totalVisibility = competitors.reduce((sum, c) => sum + c.visibilityScore, 0);
        if (totalVisibility > 0) {
            competitors.forEach((c) => { c.visibilityScore = Math.round((c.visibilityScore / totalVisibility) * 1000) / 10; });
        } else {
            competitors.forEach((c) => { c.visibilityScore = c.shareOfVoice; });
        }

        competitors.sort((a, b) => b.visibilityScore - a.visibilityScore);
        providerRankings.push({ provider, competitors });
    });

    const providerComparison: ProviderComparisonData[] = [];
    trackedCompanies.forEach((companyName) => {
        const compData: ProviderComparisonData = { competitor: companyName, providers: {}, isOwn: companyName === company.name };
        providerRankings.forEach(({ provider, competitors }) => {
            const c = competitors.find((x) => x.name === companyName);
            if (c) {
                compData.providers[provider] = { visibilityScore: c.visibilityScore, position: c.averagePosition, mentions: c.mentions, sentiment: c.sentiment };
            }
        });
        providerComparison.push(compData);
    });

    providerComparison.sort((a, b) => {
        const avgA = Object.values(a.providers).reduce((s, p) => s + p.visibilityScore, 0) / (Object.keys(a.providers).length || 1);
        const avgB = Object.values(b.providers).reduce((s, p) => s + p.visibilityScore, 0) / (Object.keys(b.providers).length || 1);
        return avgB - avgA;
    });

    return { providerRankings, providerComparison };
}

// ── Private Helpers ───────────────────────────────────────────

function _displayName(provider: string): string {
    const map: Record<string, string> = {
        openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google',
        perplexity: 'Perplexity', deepseek: 'DeepSeek', grok: 'Grok',
        ollama: 'Ollama',
    };
    return map[provider.toLowerCase()] ?? provider;
}

function _buildDetectionOptions(brandName: string, brandUrls: string[]): BrandDetectionOptions {
    const base = getBrandDetectionOptions(brandName);
    return {
        ...base,
        brandUrls: brandUrls.length > 0 ? brandUrls : base.brandUrls,
        includeUrlDetection: base.includeUrlDetection ?? brandUrls.length > 0,
    };
}

function _buildFallbackResponse(
    provider: string,
    prompt: string,
    text: string,
    brandName: string,
    competitors: string[],
    competitorUrlMap: Record<string, string[]>,
    brandDetection: ReturnType<typeof detectBrandMention>,
    brandUrls: string[],
): AIResponse {
    return {
        provider: _displayName(provider),
        prompt,
        response: text,
        brandMentioned: brandDetection.mentioned,
        brandPosition: undefined,
        competitors: competitors.filter((name) => {
            const urls = competitorUrlMap[name.toLowerCase()];
            return detectBrandMention(text, name, { ..._buildDetectionOptions(name, urls ?? []) }).mentioned;
        }),
        rankings: [],
        sentiment: 'neutral',
        confidence: brandDetection.confidence * 0.5,
        timestamp: new Date(),
    };
}

function buildAnalysisPrompt(brandName: string, text: string, competitors: string[]): string {
    return `Analyze this AI response about ${brandName} and its competitors:

Response: "${text}"

Your task:
1. Look for EXPLICIT mentions of "${brandName}" - the company must be directly named or clearly referenced
2. For "${brandName}" to be "mentioned", it must appear in one of these contexts: listed in a ranking, recommended, compared to other companies, referenced as an alternative
3. DO NOT count words that merely contain the brand name as a substring
4. Look for these competitors with the same strict rules: ${competitors.join(', ')}
5. For each mentioned company, determine specific ranking position and sentiment
6. Rate your confidence (0-1): 1.0 = Exact, unambiguous mention; 0.8 = Clear mention with minor variation; 0.6 = Mention with some ambiguity; <0.6 = Uncertain

CRITICAL: Be conservative. When in doubt, mark as NOT mentioned.`;
}

function _generateMockResponse(prompt: string, provider: string, brandName: string, competitors: string[]): AIResponse {
    const allCompanies = [brandName, ...competitors].slice(0, 10);
    const shuffled = [...allCompanies].sort(() => Math.random() - 0.5);
    const rankings: CompanyRanking[] = shuffled.slice(0, 5).map((company, index) => ({
        position: index + 1,
        company,
        reason: `${company} offers strong features in this category`,
        sentiment: Math.random() > 0.7 ? 'positive' : Math.random() > 0.3 ? 'neutral' : ('negative' as any),
    }));
    const brandRanking = rankings.find((r) => r.company === brandName);
    const brandMentioned = !!brandRanking || Math.random() > 0.3;
    const brandPosition = brandRanking?.position || (brandMentioned ? Math.floor(Math.random() * 8) + 3 : undefined);
    return {
        provider: _displayName(provider),
        prompt,
        response: `Based on my analysis, here are the top solutions:\n\n${rankings.map((r) => `${r.position}. ${r.company} - ${r.reason}`).join('\n')}`,
        rankings,
        competitors: competitors.filter(() => Math.random() > 0.5),
        brandMentioned,
        brandPosition,
        sentiment: brandRanking?.sentiment ?? 'neutral',
        confidence: Math.random() * 0.3 + 0.7,
        timestamp: new Date(),
    };
}
