import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { brandprofile } from '../db/schema';
import { db } from '../db/client';
import { handleApiError, ValidationError, ApiError, ErrorCode } from '../utils/errors';
import { randomUUID } from 'crypto';
import { scrapeCompanyInfo } from '../services/scraper.service';
import { generatePersonasForBrand } from '../services/ai.service';
import { Company } from '../types';
import { logMethodEntry } from '../utils/logger';
import { env } from '../config/env';
import { getUserFeatureAccess } from '../services/plan.service';

const competitorSchema = z.object({
    name: z.string().min(1, 'Competitor name is required'),
    url: z.string().min(1, 'Competitor URL is required'),
});

const createSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    url: z.string().min(1, 'URL is required'),
    industry: z.string().min(1, 'Industry is required'),
    location: z.string().optional(),
    competitors: z.array(competitorSchema).optional(),
    usp: z.array(z.string().min(1)).optional(),
    audience: z.string().optional(),
    marketPositioning: z.enum(['budget', 'premium', 'luxury']).optional(),
    skipScrape: z.boolean().optional(),
});

function normalizeUrl(rawUrl: string): string {
    let normalized = rawUrl.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = `https://${normalized}`;
    }
    return normalized.replace(/\/+$/, '');
}

export async function brandExists(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('brandProfile.brandExists');
        const userId = String(req.user?.userId ?? '');
        if (!userId) {
            throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }

        const [row] = await db
            .select({
                id: brandprofile.id,
                name: brandprofile.name,
                url: brandprofile.url,
                industry: brandprofile.industry,
                location: brandprofile.location,
                createdAt: brandprofile.createdAt,
            })
            .from(brandprofile)
            .where(eq(brandprofile.userId, userId))
            .orderBy(desc(brandprofile.createdAt))
            .limit(1);

        res.json({ hasBrand: Boolean(row), brand: row ?? null });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function getCurrentBrandProfile(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('brandProfile.getCurrentBrandProfile');
        const userId = String(req.user?.userId ?? '');
        if (!userId) {
            throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }

        const [row] = await db
            .select()
            .from(brandprofile)
            .where(eq(brandprofile.userId, userId))
            .orderBy(desc(brandprofile.createdAt))
            .limit(1);

        res.json({ hasBrand: Boolean(row), brand: row ?? null });
    } catch (error) {
        handleApiError(error, res);
    }
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
            keywords: Array.isArray(scrapedData.keywords)
                ? (scrapedData.keywords as string[])
                : [],
            mainContent:
                typeof scrapedData.mainContent === 'string' ? scrapedData.mainContent : '',
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
            favicon: typeof scrapedData.favicon === 'string' ? scrapedData.favicon : profile.favicon ?? undefined,
        },
    };
}

export async function getPersonas(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('brandProfile.getPersonas');
        const userId = String(req.user?.userId ?? '');
        if (!userId) {
            throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }

        const [row] = await db
            .select({
                id: brandprofile.id,
                scrapedData: brandprofile.scrapedData,
            })
            .from(brandprofile)
            .where(eq(brandprofile.userId, userId))
            .orderBy(desc(brandprofile.createdAt))
            .limit(1);

        if (!row) {
            res.json({ personas: [] });
            return;
        }

        const scrapedData = (row.scrapedData ?? {}) as Record<string, unknown>;
        const personas = Array.isArray(scrapedData.personas)
            ? scrapedData.personas
            : [];

        res.json({ personas });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function createPersonas(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('brandProfile.createPersonas');
        const userId = String(req.user?.userId ?? '');
        if (!userId) {
            throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }

        const [profile] = await db
            .select()
            .from(brandprofile)
            .where(eq(brandprofile.userId, userId))
            .orderBy(desc(brandprofile.createdAt))
            .limit(1);

        if (!profile) {
            throw new ApiError('Brand profile not found', 404, ErrorCode.NOT_FOUND);
        }

        const company = mapProfileToCompany(profile);
        const personas = await generatePersonasForBrand(company);

        const existingScraped = (profile.scrapedData ?? {}) as Record<string, unknown>;
        const nextScraped = {
            ...existingScraped,
            personas,
        };

        await db
            .update(brandprofile)
            .set({ scrapedData: nextScraped })
            .where(eq(brandprofile.id, profile.id));

        res.json({ personas });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function createBrandProfile(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('brandProfile.createBrandProfile');
        const userId = String(req.user?.userId ?? '');
        if (!userId) {
            throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }

        const data = createSchema.parse(req.body);
        const normalizedUrl = normalizeUrl(data.url);
        const normalizedUrlWithSlash = `${normalizedUrl}/`;

        const brandLimitFeature = await getUserFeatureAccess(userId, 'brands.max', '[BrandProfile]');
        if (!brandLimitFeature.enabled) {
            throw new ApiError(
                `Your ${brandLimitFeature.planCode} plan does not allow creating brands.`,
                403,
                ErrorCode.FORBIDDEN,
            );
        }
        if (brandLimitFeature.limitValue !== null) {
            const [countRow] = await db
                .select({ count: sql<number>`count(*)` })
                .from(brandprofile)
                .where(eq(brandprofile.userId, userId));
            const currentBrandCount = Number(countRow?.count ?? 0);
            if (currentBrandCount >= brandLimitFeature.limitValue) {
                throw new ApiError(
                    `Plan limit reached. Your ${brandLimitFeature.planCode} plan allows up to ${brandLimitFeature.limitValue} brand(s).`,
                    403,
                    ErrorCode.FORBIDDEN,
                );
            }
        }

        const existing = await db
            .select({ id: brandprofile.id })
            .from(brandprofile)
            .where(
                and(
                    eq(brandprofile.userId, userId),
                    or(eq(brandprofile.url, normalizedUrl), eq(brandprofile.url, normalizedUrlWithSlash)),
                ),
            )
            .limit(1);

        if (existing.length > 0) {
            throw new ApiError('Brand already exists', 409, ErrorCode.ALREADY_EXISTS);
        }

        const normalizedCompetitors =
            data.competitors?.map((competitor) => ({
                name: competitor.name,
                url: normalizeUrl(competitor.url),
                source: 'user',
                timestamp: new Date().toISOString(),
            })) ?? null;

        const normalizedUsp = data.usp?.map((item) => item.trim()).filter(Boolean) ?? [];

        const [inserted] = await db
            .insert(brandprofile)
            .values({
                id: randomUUID(),
                userId,
                name: data.name,
                url: normalizedUrl,
                industry: data.industry,
                location: data.location ?? 'Global',
                competitors: normalizedCompetitors,
                usp: normalizedUsp.length > 0 ? normalizedUsp : undefined,
                audience: data.audience || undefined,
                marketPositioning: data.marketPositioning || undefined,
                isScraped: false,
            })
            .returning({
                id: brandprofile.id,
                name: brandprofile.name,
                url: brandprofile.url,
                industry: brandprofile.industry,
                location: brandprofile.location,
                usp: brandprofile.usp,
                audience: brandprofile.audience,
                marketPositioning: brandprofile.marketPositioning,
                createdAt: brandprofile.createdAt,
            });

        const shouldSkipScrape = data.skipScrape === true || env.BRAND_CREATE_SKIP_SCRAPE;
        if (!shouldSkipScrape) {
            try {
                const company = await scrapeCompanyInfo(normalizedUrl);
                await db
                    .update(brandprofile)
                    .set({
                        description: company.description ?? null,
                        logo: company.logo ?? null,
                        favicon: company.favicon ?? null,
                        scrapedData: company.scrapedData ?? null,
                        isScraped: true,
                    })
                    .where(eq(brandprofile.id, inserted.id));
            } catch (scrapeError) {
                console.warn('[BrandProfile] Scrape failed after creation:', (scrapeError as Error).message);
            }
        } else {
            console.log('[BrandProfile] Scrape skipped by configuration for brand create');
        }

        res.status(201).json({ brand: inserted });
    } catch (error) {
        if (error instanceof ZodError) {
            handleApiError(new ValidationError(error.errors[0]?.message ?? 'Validation error'), res);
            return;
        }
        handleApiError(error, res);
    }
}
