// ─────────────────────────────────────────────────────────────
// src/controllers/scrape.controller.ts
// Source: WebApp/app/api/brand-monitor/scrape/route.ts
//
// POST /api/brand-monitor/scrape
// ─────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import { checkCredits } from '../services/credit.service';
import { scrapeCompanyInfo } from '../services/scraper.service';
import {
    findExistingBrand,
    hydrateCompanyFromProfile,
    enrichCompanyFromProfile,
    saveGeneratedCompetitors,
} from '../services/brand.service';
import {
    identifyCompetitorDetails,
    resolveCompetitorUrlsFromNames,
    generatePromptsForCompany,
} from '../services/ai.service';
import { handleApiError, ValidationError } from '../utils/errors';
import { validateCompetitorUrl } from '../utils/url.utils';
import { assignUrlToCompetitor, deriveCompetitorNameFromUrl } from '../utils/competitor.utils';
import { Company, IdealCustomerProfile } from '../types';
import { db } from '../db/client';
import { audienceProfiles } from '../db/schema';
import { and, eq } from 'drizzle-orm';

// ── Controller ───────────────────────────────────────────────

export async function scrapeHandler(req: Request, res: Response): Promise<void> {
    try {
        const userId: string = res.locals.user.id;

        // ── 1. Credit check (soft — scraping costs 1 credit) ───
        await checkCredits(userId, 1, '[Scrape]');

        // ── 2. Validate & normalise URL ────────────────────────
        const { url, maxAge } = req.body as { url?: string; maxAge?: number };

        if (!url) {
            throw new ValidationError('Invalid request', { url: 'URL is required' });
        }

        let normalizedUrl = url.trim();
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = `https://${normalizedUrl}`;
        }
        // strip trailing slash(es) for consistent DB lookup
        normalizedUrl = normalizedUrl.replace(/\/+$/, '');

        // ── 3. DB cache lookup ─────────────────────────────────
        const existingBrand = await findExistingBrand(userId, normalizedUrl).catch((dbErr) => {
            console.warn('[Scrape] DB cache lookup failed:', dbErr);
            return null;
        });

        // ── 4. Scrape or reuse ─────────────────────────────────
        let company: Company;

        if (existingBrand?.scrapedData) {
            console.log('[Scrape] Reusing cached brand data for:', existingBrand.name);
            company = hydrateCompanyFromProfile(existingBrand, normalizedUrl);
        } else {
            console.log('[Scrape] Fresh scrape for:', normalizedUrl);
            company = await scrapeCompanyInfo(normalizedUrl, maxAge);
        }

        // Enrich with profile location / competitor URLs if we have them
        if (existingBrand) {
            company = enrichCompanyFromProfile(company, existingBrand);
        }

        // ── 5. Build merged competitor list ───────────────────
        const scrapedCompetitors: string[] = Array.isArray(company.scrapedData?.competitors)
            ? (company.scrapedData!.competitors as string[]).filter(Boolean)
            : [];

        const profileCompetitors: string[] = Array.isArray(company.scrapedData?.profileCompetitors)
            ? (company.scrapedData!.profileCompetitors as string[]).filter(Boolean)
            : [];

        const profileCompetitorNames = profileCompetitors.map(deriveCompetitorNameFromUrl);

        let mergedCompetitors = Array.from(
            new Set([...profileCompetitorNames, ...scrapedCompetitors]),
        ).slice(0, 10);

        let aiGeneratedDetails: { name: string; url?: string }[] = [];

        // Supplement with AI-identified competitors when list is thin
        if (mergedCompetitors.length < 10) {
            aiGeneratedDetails = await identifyCompetitorDetails(company).catch((e) => {
                console.warn('[Scrape] Failed to identify competitors:', e);
                return [] as { name: string; url: string }[];
            });
            const aiCompetitors = aiGeneratedDetails.map((c) => c.name);
            mergedCompetitors = Array.from(new Set([...mergedCompetitors, ...aiCompetitors])).slice(0, 10);
        }

        // ── 6. Resolve competitor URLs ─────────────────────────
        if (mergedCompetitors.length > 0) {
            try {
                const existingDetails = Array.isArray(company.scrapedData?.competitorDetails)
                    ? company.scrapedData!.competitorDetails!
                    : [];

                // Base entries from profile (already have URLs)
                const baseDetails = profileCompetitors.map(
                    (profileUrl, idx) => ({ name: profileCompetitorNames[idx] || profileUrl, url: profileUrl }),
                );

                // Only resolve names that don't come from the profile
                const needResolve = mergedCompetitors.filter(
                    (name) => !profileCompetitorNames.includes(name),
                );
                const resolvedDetails =
                    needResolve.length > 0
                        ? await resolveCompetitorUrlsFromNames(company, needResolve)
                        : [];

                // Merge all detail sources
                const mergedDetails = [...baseDetails, ...existingDetails];
                aiGeneratedDetails.forEach((entry) => {
                    if (!entry.url) return;
                    if (!mergedDetails.some((item) => item.name.toLowerCase() === entry.name.toLowerCase())) {
                        mergedDetails.push(entry);
                    }
                });
                resolvedDetails.forEach((entry) => {
                    if (!entry.url) return;
                    if (!mergedDetails.some((item) => item.url === entry.url)) {
                        mergedDetails.push(entry);
                    }
                });

                // Fill any still-missing URLs via the static domain map
                const filledDetails = mergedDetails.map((entry) => {
                    if (entry.url) return entry;
                    const fallback = assignUrlToCompetitor(entry.name, true);
                    const normalized = fallback ? validateCompetitorUrl(fallback) : undefined;
                    return normalized ? { ...entry, url: normalized } : entry;
                });

                const dedupedDetails = (() => {
                    const seenNames = new Set<string>();
                    const seenUrls = new Set<string>();
                    return filledDetails.filter((entry) => {
                        const nameKey = entry.name.trim().toLowerCase();
                        const urlKey = entry.url ? validateCompetitorUrl(entry.url)?.toLowerCase() : undefined;
                        if (!nameKey) return false;
                        if (seenNames.has(nameKey)) return false;
                        if (urlKey && seenUrls.has(urlKey)) return false;
                        seenNames.add(nameKey);
                        if (urlKey) seenUrls.add(urlKey);
                        return true;
                    });
                })();

                if (company.scrapedData) {
                    company.scrapedData.competitorDetails = dedupedDetails.slice(0, 10);
                }

                if (existingBrand?.id) {
                    await saveGeneratedCompetitors(
                        existingBrand.id,
                        dedupedDetails
                            .filter((entry) => typeof entry.url === 'string' && Boolean(entry.url))
                            .map((entry) => ({ name: entry.name, url: entry.url! })),
                    );
                }
            } catch (e) {
                console.warn('[Scrape] Failed to resolve competitor URLs:', e);
            }
        }

        // ── 7. Generate prompts ────────────────────────────────
        let icp: IdealCustomerProfile | undefined;
        if (existingBrand?.id) {
            const [audience] = await db
                .select({ icp: audienceProfiles.icp })
                .from(audienceProfiles)
                .where(
                    and(
                        eq(audienceProfiles.userId, userId),
                        eq(audienceProfiles.brandId, existingBrand.id),
                    ),
                )
                .limit(1);
            if (audience?.icp && typeof audience.icp === 'object') {
                icp = audience.icp as IdealCustomerProfile;
            }
        }

        const prompts = await generatePromptsForCompany(company, mergedCompetitors, undefined, icp).catch((e) => {
            console.error('[Scrape] Prompt generation FAILED:', e?.message ?? e);
            if (e?.cause) console.error('[Scrape] Cause:', e.cause);
            return [];
        });

        // ── 8. Respond ─────────────────────────────────────────
        res.json({ company, prompts });
    } catch (error) {
        console.error('[Scrape] Unhandled controller error:', error);
        handleApiError(error, res);
    }
}
