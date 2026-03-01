import { Request, Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { audienceProfiles, brandprofile } from '../db/schema';
import { ApiError, ErrorCode, handleApiError } from '../utils/errors';
import { Company, Persona, IdealCustomerProfile, BrandPrompt } from '../types';
import { generateBaseQueryForBrand, generateIcpForBrand, generatePersonasForBrand, generatePromptsForCompany } from '../services/ai.service';

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
        const userId = String(req.user?.userId ?? '');
        if (!userId) throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

        const profile = await getLatestBrandProfile(userId);
        const audience = await getOrCreateAudienceRow(userId, profile.id);
        const company = mapProfileToCompany(profile);

        const personas = await generatePersonasForBrand(company);
        const baseQueryState = await ensureBaseQuery(profile, audience.id, audience.additionalInputs);

        await db
            .update(audienceProfiles)
            .set({ personas, updatedAt: new Date() })
            .where(eq(audienceProfiles.id, audience.id));

        res.json({ personas, baseQuery: baseQueryState.baseQuery, baseQueryDeleted: baseQueryState.baseQueryDeleted });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function generateAudienceIcp(req: Request, res: Response): Promise<void> {
    try {
        const userId = String(req.user?.userId ?? '');
        if (!userId) throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

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

        res.json({ icp });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function generateAudienceBaseQuery(req: Request, res: Response): Promise<void> {
    try {
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

export async function generateAudiencePrompts(req: Request, res: Response): Promise<void> {
    try {
        const userId = String(req.user?.userId ?? '');
        if (!userId) throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);

        const profile = await getLatestBrandProfile(userId);
        const audience = await getOrCreateAudienceRow(userId, profile.id);
        const company = mapProfileToCompany(profile);
        const competitorNames = extractCompetitorNamesFromProfile(profile);
        const personas =
            Array.isArray(audience.personas) && (audience.personas as Persona[]).length > 0
                ? (audience.personas as Persona[])
                : await generatePersonasForBrand(company);
        const icp = (audience.icp as IdealCustomerProfile | null) ?? null;

        const { baseQuery, baseQueryDeleted } = parseAudienceAdditionalInputs(
            audience.additionalInputs,
        );

        let prompts = await generatePromptsForCompany(company, competitorNames, personas, icp);
        if (baseQuery && !baseQueryDeleted) {
            const exists = prompts.some(
                (p) => p.prompt.trim().toLowerCase() === baseQuery.trim().toLowerCase(),
            );
            if (!exists) {
                prompts = [
                    {
                        id: 'base-query',
                        prompt: baseQuery,
                        category: 'recommendations' as const,
                        source: 'base-query',
                    },
                    ...prompts,
                ].slice(0, 20);
            }
        }

        const categories = Array.from(
            new Set(prompts.map((p) => p.category)),
        );

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
