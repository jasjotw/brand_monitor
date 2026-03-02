import { Request, Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { audienceProfiles, brandAnalyses, brandprofile } from '../db/schema';
import { ApiError, ErrorCode, handleApiError } from '../utils/errors';
import { Company, Persona, IdealCustomerProfile, BrandPrompt } from '../types';
import { generateBaseQueryForBrand, generateIcpForBrand, generatePersonasForBrand, generatePromptsForCompany } from '../services/ai.service';
import { logMethodEntry } from '../utils/logger';
import { createAnalysis, updateAnalysis } from '../services/analysis-crud.service';
import { chargeFeature, checkCredits, estimateFeatureCost } from '../services/credit.service';
import {
    CREDITS_PER_ICP_GENERATION,
    CREDITS_PER_PERSONAS_GENERATION,
} from '../config/constants';

const personaSchema = z.object({
    id: z.string(),
    role: z.string(),
    description: z.string(),
    painPoints: z.array(z.string()),
    goals: z.array(z.string()),
    avatar: z.string().optional(),
});

const icpSchema = z.object({
    summary: z.string(),
    industries: z.array(z.string()),
    companySize: z.string(),
    annualRevenueRange: z.string(),
    geographies: z.array(z.string()),
    budgetRange: z.string(),
    buyingCommittee: z.array(z.string()),
    painPoints: z.array(z.string()),
    successCriteria: z.array(z.string()),
}).passthrough();

const updateAudienceSchema = z.object({
    personas: z.array(personaSchema).optional(),
    icp: icpSchema.optional(),
    additionalInputs: z.record(z.string()).optional(),
    baseQueryDeleted: z.boolean().optional(),
});

const promptsActionSchema = z.object({
    action: z.enum(['generate_new', 'add_10_new']),
});

type PromptRunStatus = 'pending' | 'completed';
type PromptWithStatus = BrandPrompt & { status: PromptRunStatus; isNew?: boolean };

function parseAudienceAdditionalInputs(value: unknown): {
    additionalInputs: Record<string, string>;
    baseQuery: string | null;
    baseQueryDeleted: boolean;
} {
    const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

    const additionalInputs = Object.entries(raw).reduce<Record<string, string>>((acc, [key, entry]) => {
        if (key === 'baseQuery' || key === 'baseQueryDeleted' || key === 'baseQueryGeneratedAt') {
            return acc;
        }
        if (typeof entry === 'string') acc[key] = entry;
        return acc;
    }, {});

    const baseQuery = typeof raw.baseQuery === 'string' && raw.baseQuery.trim() ? raw.baseQuery.trim() : null;
    const baseQueryDeleted = raw.baseQueryDeleted === true || raw.baseQueryDeleted === 'true';

    return { additionalInputs, baseQuery, baseQueryDeleted };
}

async function ensureBaseQuery(
    profile: typeof brandprofile.$inferSelect,
    audienceId: string,
    existingAdditionalInputs: unknown,
): Promise<{ baseQuery: string | null; baseQueryDeleted: boolean }> {
    const parsed = parseAudienceAdditionalInputs(existingAdditionalInputs);
    if (parsed.baseQuery) {
        return { baseQuery: parsed.baseQuery, baseQueryDeleted: parsed.baseQueryDeleted };
    }

    const scrapedData = (profile.scrapedData ?? {}) as Record<string, unknown>;
    const mainProducts = Array.isArray(scrapedData.mainProducts)
        ? (scrapedData.mainProducts as string[])
        : [];
    const usp = Array.isArray(profile.usp) ? (profile.usp as string[]) : [];

    const query = await generateBaseQueryForBrand({
        brandName: profile.name,
        industry: profile.industry ?? undefined,
        location: profile.location ?? undefined,
        audience: profile.audience ?? undefined,
        usp,
        mainProducts,
    });

    const mergedAdditionalInputs = {
        ...parsed.additionalInputs,
        baseQuery: query,
        baseQueryDeleted: false,
        baseQueryGeneratedAt: new Date().toISOString(),
    };

    await db
        .update(audienceProfiles)
        .set({
            additionalInputs: mergedAdditionalInputs,
            updatedAt: new Date(),
        })
        .where(eq(audienceProfiles.id, audienceId));

    return { baseQuery: query, baseQueryDeleted: false };
}

function mapProfileToCompany(profile: typeof brandprofile.$inferSelect): Company {
    const scrapedData = (profile.scrapedData ?? {}) as Record<string, unknown>;
    return {
        id: profile.id,
        name: profile.name,
        url: profile.url,
        description: profile.description ?? undefined,
        industry: profile.industry ?? undefined,
        location: profile.location ?? undefined,
        logo: profile.logo ?? undefined,
        favicon: profile.favicon ?? undefined,
        scrapedData: {
            title: typeof scrapedData.title === 'string' ? scrapedData.title : profile.name,
            description:
                typeof scrapedData.description === 'string'
                    ? scrapedData.description
                    : profile.description ?? '',
            keywords: Array.isArray(scrapedData.keywords) ? (scrapedData.keywords as string[]) : [],
            mainContent: typeof scrapedData.mainContent === 'string' ? scrapedData.mainContent : '',
            mainProducts: Array.isArray(scrapedData.mainProducts)
                ? (scrapedData.mainProducts as string[])
                : [],
            competitors: Array.isArray(scrapedData.competitors)
                ? (scrapedData.competitors as string[])
                : undefined,
            competitorDetails: Array.isArray(scrapedData.competitorDetails)
                ? (scrapedData.competitorDetails as { name: string; url?: string }[])
                : undefined,
            ogImage: typeof scrapedData.ogImage === 'string' ? scrapedData.ogImage : undefined,
            favicon:
                typeof scrapedData.favicon === 'string'
                    ? scrapedData.favicon
                    : profile.favicon ?? undefined,
        },
    };
}

async function getLatestBrandProfile(userId: string) {
    const [profile] = await db
        .select()
        .from(brandprofile)
        .where(eq(brandprofile.userId, userId))
        .orderBy(desc(brandprofile.createdAt))
        .limit(1);

    if (!profile) {
        throw new ApiError('Brand profile not found', 404, ErrorCode.NOT_FOUND);
    }
    return profile;
}

async function getOrCreateAudienceRow(userId: string, brandId: string) {
    const [existing] = await db
        .select()
        .from(audienceProfiles)
        .where(and(eq(audienceProfiles.userId, userId), eq(audienceProfiles.brandId, brandId)))
        .limit(1);

    if (existing) return existing;

    const [created] = await db
        .insert(audienceProfiles)
        .values({
            userId,
            brandId,
            personas: [],
            icp: null,
            additionalInputs: {},
        })
        .returning();

    return created;
}

export async function getAudienceProfile(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('audience.getAudienceProfile');
        const userId = String(req.user?.userId ?? '');
        if (!userId) throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

        const profile = await getLatestBrandProfile(userId);
        const audience = await getOrCreateAudienceRow(userId, profile.id);
        const { additionalInputs, baseQuery, baseQueryDeleted } = parseAudienceAdditionalInputs(
            audience.additionalInputs,
        );

        res.json({
            brand: {
                id: profile.id,
                name: profile.name,
                url: profile.url,
                industry: profile.industry,
                location: profile.location,
            },
            personas: (audience.personas as Persona[]) ?? [],
            icp: (audience.icp as IdealCustomerProfile | null) ?? null,
            additionalInputs,
            baseQuery,
            baseQueryDeleted,
            updatedAt: audience.updatedAt,
        });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function generateAudiencePersonas(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('audience.generateAudiencePersonas');
        const userId = String(req.user?.userId ?? '');
        if (!userId) throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

        await checkCredits(userId, CREDITS_PER_PERSONAS_GENERATION, '[Audience Personas]');

        const profile = await getLatestBrandProfile(userId);
        const audience = await getOrCreateAudienceRow(userId, profile.id);
        const company = mapProfileToCompany(profile);

        const personas = await generatePersonasForBrand(company);
        const baseQueryState = await ensureBaseQuery(profile, audience.id, audience.additionalInputs);

        await db
            .update(audienceProfiles)
            .set({ personas, updatedAt: new Date() })
            .where(eq(audienceProfiles.id, audience.id));

        await chargeFeature({
            userId,
            featureCode: 'personas_generation',
            quantity: 1,
            referenceType: 'audience',
            referenceId: audience.id,
            metadata: { brandId: profile.id, personaCount: personas.length },
            logTag: '[Audience Personas]',
        });

        res.json({ personas, baseQuery: baseQueryState.baseQuery, baseQueryDeleted: baseQueryState.baseQueryDeleted });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function generateAudienceIcp(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('audience.generateAudienceIcp');
        const userId = String(req.user?.userId ?? '');
        if (!userId) throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

        await checkCredits(userId, CREDITS_PER_ICP_GENERATION, '[Audience ICP]');

        const body = (req.body ?? {}) as { additionalInputs?: Record<string, string> };
        const additionalInputs = body.additionalInputs ?? {};

        const profile = await getLatestBrandProfile(userId);
        const audience = await getOrCreateAudienceRow(userId, profile.id);
        const company = mapProfileToCompany(profile);

        const icp = await generateIcpForBrand(company, additionalInputs);

        await db
            .update(audienceProfiles)
            .set({
                icp,
                additionalInputs,
                updatedAt: new Date(),
            })
            .where(eq(audienceProfiles.id, audience.id));

        await chargeFeature({
            userId,
            featureCode: 'icp_generation',
            quantity: 1,
            referenceType: 'audience',
            referenceId: audience.id,
            metadata: { brandId: profile.id },
            logTag: '[Audience ICP]',
        });

        res.json({ icp });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function generateAudienceBaseQuery(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('audience.generateAudienceBaseQuery');
        const userId = String(req.user?.userId ?? '');
        if (!userId) throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

        const profile = await getLatestBrandProfile(userId);
        const audience = await getOrCreateAudienceRow(userId, profile.id);
        const baseQueryState = await ensureBaseQuery(profile, audience.id, audience.additionalInputs);

        res.json({
            baseQuery: baseQueryState.baseQuery,
            baseQueryDeleted: baseQueryState.baseQueryDeleted,
        });
    } catch (error) {
        handleApiError(error, res);
    }
}

function extractCompetitorNamesFromProfile(profile: typeof brandprofile.$inferSelect): string[] {
    const names: string[] = [];

    if (Array.isArray(profile.competitors)) {
        for (const entry of profile.competitors as unknown[]) {
            if (typeof entry === 'string' && entry.trim()) {
                names.push(entry.trim());
                continue;
            }
            if (entry && typeof entry === 'object') {
                const maybeName = (entry as { name?: unknown }).name;
                if (typeof maybeName === 'string' && maybeName.trim()) {
                    names.push(maybeName.trim());
                }
            }
        }
    }

    const scrapedData = (profile.scrapedData ?? {}) as Record<string, unknown>;
    if (Array.isArray(scrapedData.competitors)) {
        for (const entry of scrapedData.competitors as unknown[]) {
            if (typeof entry === 'string' && entry.trim()) names.push(entry.trim());
        }
    }
    if (Array.isArray(scrapedData.competitorDetails)) {
        for (const entry of scrapedData.competitorDetails as Array<{ name?: unknown }>) {
            if (typeof entry?.name === 'string' && entry.name.trim()) names.push(entry.name.trim());
        }
    }

    return Array.from(new Set(names.map((n) => n.toLowerCase())))
        .map((key) => names.find((n) => n.toLowerCase() === key)!)
        .slice(0, 10);
}

function normalizePromptKey(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizePrompts(value: unknown): BrandPrompt[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const prompts: BrandPrompt[] = [];
    for (let index = 0; index < value.length; index += 1) {
        const entry = value[index];
        if (!entry || typeof entry !== 'object') continue;
        const candidate = entry as Partial<BrandPrompt>;
        const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim() : '';
        if (!prompt) continue;
        const key = normalizePromptKey(prompt);
        if (seen.has(key)) continue;
        seen.add(key);
        prompts.push({
            id:
                typeof candidate.id === 'string' && candidate.id.trim()
                    ? candidate.id
                    : `prompt-${index + 1}`,
            prompt,
            category:
                typeof candidate.category === 'string'
                    ? candidate.category
                    : 'category_authority',
            persona: typeof candidate.persona === 'string' ? candidate.persona : undefined,
            source: typeof candidate.source === 'string' ? candidate.source : undefined,
        } as BrandPrompt);
    }
    return prompts;
}

function getPromptResponses(analysisData: unknown): Array<{ prompt?: string; promptId?: string }> {
    if (!analysisData || typeof analysisData !== 'object') return [];
    const maybeResponses = (analysisData as Record<string, unknown>).responses;
    if (!Array.isArray(maybeResponses)) return [];
    return maybeResponses as Array<{ prompt?: string; promptId?: string }>;
}

function getPromptStateFromAnalysis(analysis: typeof brandAnalyses.$inferSelect | null): {
    prompts: PromptWithStatus[];
    pendingPrompts: PromptWithStatus[];
    completedPrompts: PromptWithStatus[];
    allPromptsCompleted: boolean;
} {
    const prompts = normalizePrompts(analysis?.draftPrompts ?? analysis?.prompts);
    const responses = getPromptResponses(analysis?.analysisData);
    const responsePromptIds = new Set<string>();
    const responsePromptTexts = new Set<string>();

    for (const response of responses) {
        if (typeof response.promptId === 'string' && response.promptId.trim()) {
            responsePromptIds.add(response.promptId.trim());
        }
        if (typeof response.prompt === 'string' && response.prompt.trim()) {
            responsePromptTexts.add(normalizePromptKey(response.prompt));
        }
    }

    const withStatus: PromptWithStatus[] = prompts.map((prompt) => {
        const byId = responsePromptIds.has(prompt.id);
        const byText = responsePromptTexts.has(normalizePromptKey(prompt.prompt));
        return {
            ...prompt,
            status: byId || byText ? 'completed' : 'pending',
        };
    });
    const pendingPrompts = withStatus.filter((prompt) => prompt.status === 'pending');
    const completedPrompts = withStatus.filter((prompt) => prompt.status === 'completed');
    const allPromptsCompleted = withStatus.length > 0 && pendingPrompts.length === 0;

    return {
        prompts: withStatus,
        pendingPrompts,
        completedPrompts,
        allPromptsCompleted,
    };
}

async function getLatestAnalysisForBrand(userId: string, brandId: string) {
    const analyses = await db
        .select()
        .from(brandAnalyses)
        .where(and(eq(brandAnalyses.userId, userId), eq(brandAnalyses.brandId, brandId)))
        .orderBy(desc(brandAnalyses.updatedAt), desc(brandAnalyses.createdAt))
        .limit(50);

    const withDraft = analyses.find((analysis) => {
        const status = (analysis.analysisData as Record<string, unknown> | null)?.status;
        if (status !== 'prompt_draft') return false;
        const draftPrompts = normalizePrompts(analysis.draftPrompts);
        return draftPrompts.length > 0;
    });

    return withDraft ?? analyses[0] ?? null;
}

async function savePromptDraftAnalysis(input: {
    userId: string;
    profile: typeof brandprofile.$inferSelect;
    company: Company;
    prompts: BrandPrompt[];
    competitorNames: string[];
    analysisId?: string;
    action: 'generate_new' | 'add_10_new';
}): Promise<typeof brandAnalyses.$inferSelect> {
    const analysisData = {
        status: 'prompt_draft',
        company: input.company,
        knownCompetitors: input.competitorNames.map((name) => ({ name })),
        promptDraftMeta: {
            action: input.action,
            updatedAt: new Date().toISOString(),
        },
    };

    if (input.analysisId) {
        return updateAnalysis({
            analysisId: input.analysisId,
            userId: input.userId,
            companyName: input.profile.name,
            industry: input.profile.industry ?? undefined,
            draftPrompts: input.prompts,
            prompts: input.prompts,
            competitors: input.competitorNames.map((name) => ({ name })),
            analysisData,
        });
    }

    return createAnalysis({
        userId: input.userId,
        brandId: input.profile.id,
        url: input.profile.url,
        companyName: input.profile.name,
        industry: input.profile.industry ?? undefined,
        draftPrompts: input.prompts,
        prompts: input.prompts,
        competitors: input.competitorNames.map((name) => ({ name })),
        analysisData,
        creditsUsed: 0,
    });
}

async function buildGeneratedPrompts(input: {
    profile: typeof brandprofile.$inferSelect;
    audience: typeof audienceProfiles.$inferSelect;
    company: Company;
    competitorNames: string[];
}): Promise<BrandPrompt[]> {
    const personas =
        Array.isArray(input.audience.personas) && (input.audience.personas as Persona[]).length > 0
            ? (input.audience.personas as Persona[])
            : await generatePersonasForBrand(input.company);
    const icp = (input.audience.icp as IdealCustomerProfile | null) ?? null;

    const { baseQuery, baseQueryDeleted } = parseAudienceAdditionalInputs(
        input.audience.additionalInputs,
    );

    let prompts = await generatePromptsForCompany(
        input.company,
        input.competitorNames,
        personas,
        icp,
    );
    if (baseQuery && !baseQueryDeleted) {
        const exists = prompts.some(
            (prompt) => prompt.prompt.trim().toLowerCase() === baseQuery.trim().toLowerCase(),
        );
        if (!exists) {
            prompts = [
                {
                    id: 'base-query',
                    prompt: baseQuery,
                    category: 'recommendations',
                    source: 'base-query',
                },
                ...prompts,
            ].slice(0, 20) as BrandPrompt[];
        }
    }
    return normalizePrompts(prompts);
}

export async function getAudiencePromptState(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('audience.getAudiencePromptState');
        const userId = String(req.user?.userId ?? '');
        if (!userId) throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

        const profile = await getLatestBrandProfile(userId);
        const latestAnalysis = await getLatestAnalysisForBrand(userId, profile.id);
        const promptState = getPromptStateFromAnalysis(latestAnalysis);

        res.json({
            analysisId: latestAnalysis?.id ?? null,
            prompts: promptState.prompts,
            pendingPrompts: promptState.pendingPrompts,
            completedPrompts: promptState.completedPrompts,
            hasPendingPrompts: promptState.pendingPrompts.length > 0,
            allPromptsCompleted: promptState.allPromptsCompleted,
            total: promptState.prompts.length,
        });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function getAudiencePromptDraftDebug(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('audience.getAudiencePromptDraftDebug');
        const userId = String(req.user?.userId ?? '');
        if (!userId) throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

        const profile = await getLatestBrandProfile(userId);
        const latestAnalysis = await getLatestAnalysisForBrand(userId, profile.id);
        const promptState = getPromptStateFromAnalysis(latestAnalysis);
        const analysisData =
            latestAnalysis?.analysisData && typeof latestAnalysis.analysisData === 'object'
                ? (latestAnalysis.analysisData as Record<string, unknown>)
                : {};
        const analysisStatus =
            typeof analysisData.status === 'string' ? analysisData.status : null;
        const isPromptDraft = analysisStatus === 'prompt_draft';

        res.json({
            brandId: profile.id,
            analysisId: latestAnalysis?.id ?? null,
            analysisStatus,
            isPromptDraft,
            hasPendingPrompts: promptState.pendingPrompts.length > 0,
            pendingCount: promptState.pendingPrompts.length,
            completedCount: promptState.completedPrompts.length,
            totalPrompts: promptState.prompts.length,
            updatedAt: latestAnalysis?.updatedAt ?? null,
        });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function manageAudiencePrompts(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('audience.manageAudiencePrompts');
        const userId = String(req.user?.userId ?? '');
        if (!userId) throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

        const body = promptsActionSchema.parse(req.body ?? {});
        const profile = await getLatestBrandProfile(userId);
        const audience = await getOrCreateAudienceRow(userId, profile.id);
        const company = mapProfileToCompany(profile);
        const competitorNames = extractCompetitorNamesFromProfile(profile);

        const latestAnalysis = await getLatestAnalysisForBrand(userId, profile.id);
        const latestPromptState = getPromptStateFromAnalysis(latestAnalysis);
        const pendingBase = latestPromptState.pendingPrompts.map((prompt) => ({
            id: prompt.id,
            prompt: prompt.prompt,
            category: prompt.category,
            persona: prompt.persona,
            source: prompt.source,
        })) as BrandPrompt[];

        if (body.action === 'generate_new') {
            const generated = await buildGeneratedPrompts({
                profile,
                audience,
                company,
                competitorNames,
            });
            const generationCost = estimateFeatureCost('prompt_generation', generated.length);
            if (generationCost > 0) {
                await checkCredits(userId, generationCost, '[Audience Prompts]');
            }

            const saved = await savePromptDraftAnalysis({
                userId,
                profile,
                company,
                prompts: generated,
                competitorNames,
                analysisId:
                    latestAnalysis &&
                    (latestAnalysis.analysisData as Record<string, unknown>)?.status === 'prompt_draft'
                        ? latestAnalysis.id
                        : undefined,
                action: 'generate_new',
            });
            if (generationCost > 0) {
                await chargeFeature({
                    userId,
                    featureCode: 'prompt_generation',
                    quantity: generated.length,
                    referenceType: 'audience_prompts',
                    referenceId: saved.id,
                    metadata: { action: 'generate_new', promptCount: generated.length },
                    logTag: '[Audience Prompts]',
                });
            }

            res.json({
                action: 'generate_new',
                analysisId: saved.id,
                prompts: generated.map((prompt) => ({ ...prompt, status: 'pending' as const })),
                pendingPrompts: generated.map((prompt) => ({
                    ...prompt,
                    status: 'pending' as const,
                })),
                total: generated.length,
                hasPendingPrompts: generated.length > 0,
                allPromptsCompleted: false,
            });
            return;
        }

        const generated = await buildGeneratedPrompts({
            profile,
            audience,
            company,
            competitorNames,
        });

        const pendingKeys = new Set(pendingBase.map((prompt) => normalizePromptKey(prompt.prompt)));
        const appendCandidates = generated.filter(
            (prompt) => !pendingKeys.has(normalizePromptKey(prompt.prompt)),
        );
        const added = appendCandidates.slice(0, 10).map((prompt, index) => ({
            ...prompt,
            id: `${prompt.id || 'new'}-${Date.now()}-${index + 1}`,
            source: 'new',
        })) as BrandPrompt[];
        const generationCost = estimateFeatureCost('prompt_generation', added.length);
        if (generationCost > 0) {
            await checkCredits(userId, generationCost, '[Audience Prompts]');
        }

        const mergedPending = [...pendingBase, ...added];
        const saved = await savePromptDraftAnalysis({
            userId,
            profile,
            company,
            prompts: mergedPending,
            competitorNames,
            analysisId:
                latestAnalysis &&
                (latestAnalysis.analysisData as Record<string, unknown>)?.status === 'prompt_draft'
                    ? latestAnalysis.id
                    : undefined,
            action: 'add_10_new',
        });
        if (generationCost > 0) {
            await chargeFeature({
                userId,
                featureCode: 'prompt_generation',
                quantity: added.length,
                referenceType: 'audience_prompts',
                referenceId: saved.id,
                metadata: { action: 'add_10_new', promptCount: added.length },
                logTag: '[Audience Prompts]',
            });
        }

        res.json({
            action: 'add_10_new',
            analysisId: saved.id,
            prompts: mergedPending.map((prompt) => ({
                ...prompt,
                status: 'pending' as const,
                isNew: prompt.source === 'new',
            })),
            pendingPrompts: mergedPending.map((prompt) => ({
                ...prompt,
                status: 'pending' as const,
                isNew: prompt.source === 'new',
            })),
            addedPrompts: added.map((prompt) => ({
                ...prompt,
                status: 'pending' as const,
                isNew: true,
            })),
            total: mergedPending.length,
            hasPendingPrompts: mergedPending.length > 0,
            allPromptsCompleted: false,
        });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function generateAudiencePrompts(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('audience.generateAudiencePrompts');
        const userId = String(req.user?.userId ?? '');
        if (!userId) throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

        const profile = await getLatestBrandProfile(userId);
        const audience = await getOrCreateAudienceRow(userId, profile.id);
        const company = mapProfileToCompany(profile);
        const competitorNames = extractCompetitorNamesFromProfile(profile);
        const prompts = await buildGeneratedPrompts({
            profile,
            audience,
            company,
            competitorNames,
        });
        const generationCost = estimateFeatureCost('prompt_generation', prompts.length);
        if (generationCost > 0) {
            await checkCredits(userId, generationCost, '[Audience Prompts]');
        }

        const categories = Array.from(
            new Set(prompts.map((p) => p.category)),
        );

        const rawAdditionalInputs =
            audience.additionalInputs && typeof audience.additionalInputs === 'object'
                ? (audience.additionalInputs as Record<string, unknown>)
                : {};

        await db
            .update(audienceProfiles)
            .set({
                additionalInputs: {
                    ...rawAdditionalInputs,
                    generatedPrompts: prompts,
                    generatedPromptCategories: categories,
                    generatedPromptsUpdatedAt: new Date().toISOString(),
                },
                updatedAt: new Date(),
            })
            .where(eq(audienceProfiles.id, audience.id));

        const latestAnalysis = await getLatestAnalysisForBrand(userId, profile.id);
        await savePromptDraftAnalysis({
            userId,
            profile,
            company,
            prompts,
            competitorNames,
            analysisId:
                latestAnalysis &&
                (latestAnalysis.analysisData as Record<string, unknown>)?.status === 'prompt_draft'
                    ? latestAnalysis.id
                    : undefined,
            action: 'generate_new',
        });
        if (generationCost > 0) {
            await chargeFeature({
                userId,
                featureCode: 'prompt_generation',
                quantity: prompts.length,
                referenceType: 'audience_prompts',
                referenceId: profile.id,
                metadata: { action: 'generate_prompts', promptCount: prompts.length },
                logTag: '[Audience Prompts]',
            });
        }

        res.json({
            prompts,
            categories,
            total: prompts.length,
        });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function updateAudienceProfile(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('audience.updateAudienceProfile');
        const userId = String(req.user?.userId ?? '');
        if (!userId) throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

        const payload = updateAudienceSchema.parse(req.body);
        const profile = await getLatestBrandProfile(userId);
        const audience = await getOrCreateAudienceRow(userId, profile.id);
        const existingParsed = parseAudienceAdditionalInputs(audience.additionalInputs);

        const mergedAdditionalInputs = {
            ...(payload.additionalInputs ?? existingParsed.additionalInputs),
            ...(existingParsed.baseQuery ? { baseQuery: existingParsed.baseQuery } : {}),
            baseQueryDeleted:
                payload.baseQueryDeleted ?? existingParsed.baseQueryDeleted,
        };

        await db
            .update(audienceProfiles)
            .set({
                personas: payload.personas ?? audience.personas,
                icp: payload.icp ?? audience.icp,
                additionalInputs: mergedAdditionalInputs,
                updatedAt: new Date(),
            })
            .where(eq(audienceProfiles.id, audience.id));

        res.json({ success: true });
    } catch (error) {
        handleApiError(error, res);
    }
}
