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
} from '../services/brand.service';
import {
    identifyCompetitors,
    resolveCompetitorUrlsFromNames,
    generatePromptsForCompany,
} from '../services/ai.service';
import { handleApiError, ValidationError } from '../utils/errors';
import { validateCompetitorUrl } from '../utils/url.utils';
import { assignUrlToCompetitor, deriveCompetitorNameFromUrl } from '../utils/competitor.utils';
import { Company } from '../types';

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
        ).slice(0, 8);

        // Supplement with AI-identified competitors when list is thin
        if (mergedCompetitors.length < 8) {
            const aiCompetitors = await identifyCompetitors(company).catch((e) => {
                console.warn('[Scrape] Failed to identify competitors:', e);
                return [] as string[];
            });
            mergedCompetitors = Array.from(new Set([...mergedCompetitors, ...aiCompetitors])).slice(0, 8);
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

                if (company.scrapedData) {
                    company.scrapedData.competitorDetails = filledDetails.slice(0, 8);
                }
            } catch (e) {
                console.warn('[Scrape] Failed to resolve competitor URLs:', e);
            }
        }

        // ── 7. Generate prompts ────────────────────────────────
        const prompts = await generatePromptsForCompany(company, mergedCompetitors).catch((e) => {
            console.error('[Scrape] Prompt generation FAILED:', e?.message ?? e);
            if (e?.cause) console.error('[Scrape] Cause:', e.cause);
            return [];
        });

        // ── 8. Respond ─────────────────────────────────────────
        res.json({ company, prompts });
    } catch (error) {
        handleApiError(error, res);
    }
}
