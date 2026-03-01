// ─────────────────────────────────────────────────────────────
// src/services/brand.service.ts
// Source: Inline DB queries from:
//   - WebApp/app/api/brand-monitor/analyze/route.ts  (location lookup)
//   - WebApp/app/api/brand-monitor/scrape/route.ts   (brand upsert / cache)
//   - WebApp/lib/scrape-utils.ts                     (profile competitor enrichment)
//
// Manages all CRUD operations on the `brandprofile` table.
// ─────────────────────────────────────────────────────────────

import { db } from '../db/client';
import { brandprofile } from '../db/schema';
import { and, eq, or } from 'drizzle-orm';
import { Company } from '../types';
import { validateCompetitorUrl } from '../utils/url.utils';
import { deriveCompetitorNameFromUrl } from '../utils/competitor.utils';

// ── Types ─────────────────────────────────────────────────────

/** Row shape returned by brandprofile selects */
export type BrandProfileRow = typeof brandprofile.$inferSelect;

export interface StoredCompetitor {
    name: string;
    url: string;
    source: 'user' | 'ai';
    timestamp: string;
}

function normalizeCompetitorName(name: string): string {
    return name.trim().toLowerCase();
}

function normalizeCompetitorUrl(url: string): string | undefined {
    return validateCompetitorUrl(url)?.toLowerCase();
}

function normalizeStoredCompetitors(entries: unknown): StoredCompetitor[] {
    if (!Array.isArray(entries)) return [];

    const normalized = entries
        .map((entry) => {
            if (typeof entry === 'string') {
                const url = validateCompetitorUrl(entry);
                if (!url) return null;
                return {
                    name: deriveCompetitorNameFromUrl(url),
                    url,
                    source: 'user' as const,
                    timestamp: new Date().toISOString(),
                };
            }
            if (!entry || typeof entry !== 'object') return null;
            const candidate = entry as {
                name?: unknown;
                url?: unknown;
                source?: unknown;
                timestamp?: unknown;
            };
            const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
            const url = typeof candidate.url === 'string' ? validateCompetitorUrl(candidate.url) : undefined;
            if (!name || !url) return null;
            const source = candidate.source === 'user' ? 'user' : 'ai';
            const timestamp =
                typeof candidate.timestamp === 'string' && candidate.timestamp
                    ? candidate.timestamp
                    : new Date().toISOString();
            return { name, url, source, timestamp } as StoredCompetitor;
        })
        .filter((entry): entry is StoredCompetitor => Boolean(entry));

    const seenNames = new Set<string>();
    const seenUrls = new Set<string>();
    return normalized.filter((entry) => {
        const nameKey = normalizeCompetitorName(entry.name);
        const urlKey = normalizeCompetitorUrl(entry.url);
        if (!nameKey || !urlKey) return false;
        if (seenNames.has(nameKey) || seenUrls.has(urlKey)) return false;
        seenNames.add(nameKey);
        seenUrls.add(urlKey);
        return true;
    });
}

// ── Queries ───────────────────────────────────────────────────

/**
 * Looks up the saved `location` for a brand URL belonging to a user.
 * Used by the analyze route to attach a known location to the company object.
 */
export async function getBrandLocation(
    userId: string,
    normalizedUrl: string,
): Promise<string | undefined> {
    const matches = await db
        .select({ location: brandprofile.location })
        .from(brandprofile)
        .where(and(eq(brandprofile.url, normalizedUrl), eq(brandprofile.userId, userId)))
        .limit(1);

    return matches.length > 0 ? (matches[0].location ?? undefined) : undefined;
}

/**
 * Returns a cached brand profile for the user + URL pair.
 * Checks both `normalizedUrl` and `normalizedUrl + "/"` to handle trailing-slash variants.
 */
export async function findExistingBrand(
    userId: string,
    normalizedUrl: string,
): Promise<BrandProfileRow | null> {
    const normalizedUrlWithSlash = `${normalizedUrl}/`;

    const brands = await db
        .select()
        .from(brandprofile)
        .where(
            and(
                eq(brandprofile.userId, userId),
                or(eq(brandprofile.url, normalizedUrl), eq(brandprofile.url, normalizedUrlWithSlash)),
            ),
        )
        .limit(1);

    return brands.length > 0 ? brands[0] : null;
}

/**
 * Rebuilds a `Company` object from a stored BrandProfileRow.
 * Used when reusing cached scrape results instead of hitting Firecrawl again.
 */
export function hydrateCompanyFromProfile(
    profile: BrandProfileRow,
    normalizedUrl: string,
): Company {
    return {
        id: profile.id,
        name: profile.name,
        url: normalizedUrl,
        industry: profile.industry ?? undefined,
        location: profile.location ?? undefined,
        description: profile.description ?? undefined,
        logo: profile.logo ?? undefined,
        favicon: profile.favicon ?? undefined,
        scrapedData: (profile.scrapedData as Company['scrapedData']) ?? undefined,
    };
}

/**
 * Enriches a company object with saved location and competitor data
 * from an existing BrandProfileRow.
 */
export function enrichCompanyFromProfile(
    company: Company,
    profile: BrandProfileRow,
): Company {
    const enriched = { ...company };

    if (profile.location) {
        enriched.location = profile.location;
    }

    if (profile.competitors && enriched.scrapedData) {
        const profileEntries = Array.isArray(profile.competitors)
            ? (profile.competitors as unknown[])
            : [];

        const profileUrls = profileEntries
            .map((entry) => {
                if (typeof entry === 'string') {
                    return validateCompetitorUrl(entry);
                }
                if (!entry || typeof entry !== 'object') {
                    return undefined;
                }
                const url = (entry as { url?: unknown }).url;
                return typeof url === 'string' ? validateCompetitorUrl(url) : undefined;
            })
            .filter(Boolean) as string[];

        enriched.scrapedData = {
            ...enriched.scrapedData,
            profileCompetitors: profileUrls,
        };
    }

    return enriched;
}

/**
 * Derives competitor name-url pairs from the `profileCompetitors` URLs array
 * stored in the company's scrapedData.
 */
export function buildProfileCompetitorDetails(
    profileCompetitors: string[],
): { name: string; url: string }[] {
    return profileCompetitors.map((url) => ({
        name: deriveCompetitorNameFromUrl(url),
        url,
    }));
}

export async function saveGeneratedCompetitors(
    profileId: string,
    generated: Array<{ name: string; url: string }>,
): Promise<StoredCompetitor[]> {
    const [profile] = await db
        .select({ competitors: brandprofile.competitors })
        .from(brandprofile)
        .where(eq(brandprofile.id, profileId))
        .limit(1);

    const existing = normalizeStoredCompetitors(profile?.competitors);
    const now = new Date().toISOString();

    const merged = [...existing];
    const seenNames = new Set(merged.map((c) => normalizeCompetitorName(c.name)));
    const seenUrls = new Set(
        merged
            .map((c) => normalizeCompetitorUrl(c.url))
            .filter((u): u is string => Boolean(u)),
    );

    generated.forEach((entry) => {
        const name = entry.name.trim();
        const url = validateCompetitorUrl(entry.url);
        if (!name || !url) return;
        const nameKey = normalizeCompetitorName(name);
        const urlKey = normalizeCompetitorUrl(url);
        if (!nameKey || !urlKey) return;

        if (seenNames.has(nameKey) || seenUrls.has(urlKey)) {
            return;
        }

        const existingIdx = merged.findIndex((c) => normalizeCompetitorName(c.name) === nameKey);
        if (existingIdx >= 0) {
            if (merged[existingIdx].source !== 'user') {
                merged[existingIdx] = {
                    name,
                    url,
                    source: 'ai',
                    timestamp: now,
                };
            }
            return;
        }

        merged.push({
            name,
            url,
            source: 'ai',
            timestamp: now,
        });
        seenNames.add(nameKey);
        seenUrls.add(urlKey);
    });

    await db
        .update(brandprofile)
        .set({ competitors: merged })
        .where(eq(brandprofile.id, profileId));

    return merged;
}
