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
        const profileUrls = (profile.competitors as string[])
            .map((entry) => validateCompetitorUrl(entry))
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
