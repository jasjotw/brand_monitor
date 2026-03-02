import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { brandBacklinkSnapshots, brandprofile } from '../db/schema';
import { env } from '../config/env';
import { logMethodEntry } from '../utils/logger';

const COLOR_PALETTE = ['#F97316', '#ECA17A', '#FFD5B5', '#92B6B1', '#8BB6E8', '#C6A5D9'];

interface StoredCompetitor {
    name: string;
    url: string;
}

interface DataForSEOSummary {
    target?: string;
    rank?: number;
    backlinks?: number;
    backlinks_spam_score?: number;
    broken_backlinks?: number;
    referring_domains?: number;
    referring_domains_nofollow?: number;
    referring_main_domains?: number;
    referring_ips?: number;
    external_links_count?: number;
    info?: {
        target_spam_score?: number;
    };
    referring_links_tld?: Record<string, number>;
}

interface DataForSEOBacklink {
    domain_from?: string;
    url_from?: string;
    domain_from_rank?: number;
    page_from_title?: string;
    links_count?: number;
    dofollow?: boolean;
}

interface CompetitorFetchResult {
    competitor: BacklinkCompetitor;
    summary: DataForSEOSummary | null;
    backlinks: DataForSEOBacklink[];
    error?: string;
}

export interface BacklinkMetrics {
    domainRating: number;
    targetSpamScore: number;
    totalBacklinks: number;
    referringDomains: number;
    mainDomains: number;
    referringIps: number;
    nofollowDomains: number;
    brokenBacklinks: number;
    detailedSpamScore: number;
    externalLinks: number;
}

export interface BacklinkOpportunityLink {
    title: string;
    url: string;
    count: number;
    label: 'Main' | 'NoFollow' | 'Image';
}

export interface BacklinkOpportunity {
    domain: string;
    dr: number;
    links: BacklinkOpportunityLink[];
}

export interface BacklinkCompetitorDetail {
    metrics: BacklinkMetrics;
    tlds: string[];
    opportunities: BacklinkOpportunity[];
}

export interface BacklinkCompetitor {
    id: string;
    name: string;
    url: string;
    color: string;
    isOwn: boolean;
}

export interface BacklinksSnapshot {
    summary: {
        competitors: number;
        totalBacklinks: number;
        avgRefDomains: number;
    };
    competitors: BacklinkCompetitor[];
    details: Record<string, BacklinkCompetitorDetail>;
}

export interface BacklinksResponse {
    hasData: boolean;
    hasSnapshot: boolean;
    brandId: string | null;
    generatedAt: string;
    source: 'db' | 'fetched' | 'none';
    summary: BacklinksSnapshot['summary'];
    competitors: BacklinkCompetitor[];
    details: Record<string, BacklinkCompetitorDetail>;
}

class DataForSEOClient {
    private readonly baseUrl = 'https://api.dataforseo.com/v3';
    private readonly authHeader: string;

    constructor() {
        if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
            throw new Error('DataForSEO credentials are missing. Configure DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.');
        }
        this.authHeader = `Basic ${Buffer.from(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`).toString('base64')}`;
    }

    private async request<T>(endpoint: string, body: any[]): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                Authorization: this.authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`DataForSEO API error: ${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<T>;
    }

    private static extractDomain(url: string): string {
        const raw = (url || '').trim();
        if (!raw) return '';
        try {
            const normalized = raw.includes('://') ? raw : `https://${raw}`;
            return new URL(normalized).hostname.toLowerCase().replace(/^www\./, '');
        } catch {
            return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
        }
    }

    async getSummary(target: string): Promise<DataForSEOSummary | null> {
        const cleanTarget = DataForSEOClient.extractDomain(target);
        const response = await this.request<any>('/backlinks/summary/live', [{
            target: cleanTarget,
            include_subdomains: true,
            backlinks_status_type: 'live',
            internal_list_limit: 10,
        }]);
        return response?.tasks?.[0]?.result?.[0] || null;
    }

    async getBacklinks(target: string, limit = 100): Promise<DataForSEOBacklink[]> {
        const cleanTarget = DataForSEOClient.extractDomain(target);
        const doFollowLimit = Math.ceil(limit * 0.7);
        const noFollowLimit = Math.floor(limit * 0.3);

        const [dofollowRes, nofollowRes] = await Promise.all([
            this.request<any>('/backlinks/backlinks/live', [{
                target: cleanTarget,
                mode: 'as_is',
                limit: Math.min(doFollowLimit, 1000),
                backlinks_status_type: 'live',
                include_subdomains: true,
                order_by: ['rank,desc'],
                filters: [['dofollow', '=', true]],
            }]),
            this.request<any>('/backlinks/backlinks/live', [{
                target: cleanTarget,
                mode: 'as_is',
                limit: Math.min(noFollowLimit, 1000),
                backlinks_status_type: 'live',
                include_subdomains: true,
                order_by: ['rank,desc'],
                filters: [['dofollow', '=', false]],
            }]),
        ]);

        const dofollowItems = dofollowRes?.tasks?.[0]?.result?.[0]?.items || [];
        const nofollowItems = nofollowRes?.tasks?.[0]?.result?.[0]?.items || [];

        return [...dofollowItems, ...nofollowItems];
    }
}

function toNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function safeDomain(urlOrDomain: string): string {
    const raw = (urlOrDomain || '').trim();
    if (!raw) return '';

    try {
        const normalized = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
        return new URL(normalized).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
    }
}

function domainSlug(domain: string): string {
    const normalized = domain.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return normalized || 'domain';
}

function readStoredCompetitors(value: unknown): StoredCompetitor[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => {
            if (typeof entry === 'string') {
                const trimmed = entry.trim();
                if (!trimmed) return null;
                const domain = safeDomain(trimmed);
                if (!domain) return null;
                return { name: trimmed, url: domain } satisfies StoredCompetitor;
            }
            if (!entry || typeof entry !== 'object') return null;
            const candidate = entry as { name?: unknown; url?: unknown };
            if (typeof candidate.name !== 'string' || typeof candidate.url !== 'string') return null;
            const name = candidate.name.trim();
            const domain = safeDomain(candidate.url);
            if (!name || !domain) return null;
            return { name, url: domain } satisfies StoredCompetitor;
        })
        .filter((entry): entry is StoredCompetitor => Boolean(entry));
}

function parsePreloadedCompetitors(input: {
    brandName: string;
    brandUrl: string;
    competitorsRaw: unknown;
}): BacklinkCompetitor[] {
    const ownDomain = safeDomain(input.brandUrl);
    const competitors: BacklinkCompetitor[] = [{
        id: 'yours',
        name: input.brandName || 'Your Brand',
        url: ownDomain || input.brandUrl,
        color: COLOR_PALETTE[0],
        isOwn: true,
    }];

    const stored = readStoredCompetitors(input.competitorsRaw);
    stored.forEach((c, idx) => {
        competitors.push({
            id: domainSlug(c.url) || `competitor-${idx + 1}`,
            name: c.name,
            url: c.url,
            color: COLOR_PALETTE[(idx + 1) % COLOR_PALETTE.length],
            isOwn: false,
        });
    });

    return competitors;
}

function mapSummaryToMetrics(summary: DataForSEOSummary | null): BacklinkMetrics {
    const rank = toNumber(summary?.rank);
    const backlinksSpam = toNumber(summary?.backlinks_spam_score);
    const targetSpam = toNumber(summary?.info?.target_spam_score, backlinksSpam);

    return {
        domainRating: Math.round(rank / 10),
        targetSpamScore: Number(targetSpam.toFixed(1)),
        totalBacklinks: toNumber(summary?.backlinks),
        referringDomains: toNumber(summary?.referring_domains),
        mainDomains: toNumber(summary?.referring_main_domains),
        referringIps: toNumber(summary?.referring_ips),
        nofollowDomains: toNumber(summary?.referring_domains_nofollow),
        brokenBacklinks: toNumber(summary?.broken_backlinks),
        detailedSpamScore: Number(backlinksSpam.toFixed(1)),
        externalLinks: toNumber(summary?.external_links_count),
    };
}

function mapTlds(summary: DataForSEOSummary | null): string[] {
    const entries = Object.entries(summary?.referring_links_tld || {});
    return entries
        .sort((a, b) => toNumber(b[1]) - toNumber(a[1]))
        .slice(0, 8)
        .map(([tld]) => (tld.startsWith('.') ? tld : `.${tld}`));
}

function mapOpportunities(backlinks: DataForSEOBacklink[]): BacklinkOpportunity[] {
    const byDomain = new Map<string, DataForSEOBacklink[]>();

    backlinks.forEach((item) => {
        const domain = safeDomain(item.domain_from || '');
        if (!domain) return;
        const list = byDomain.get(domain) || [];
        list.push(item);
        byDomain.set(domain, list);
    });

    return Array.from(byDomain.entries())
        .map(([domain, items]) => {
            const sorted = items.slice().sort((a, b) => toNumber(b.domain_from_rank) - toNumber(a.domain_from_rank));
            return {
                domain,
                dr: Math.round(toNumber(sorted[0]?.domain_from_rank) / 10),
                links: sorted.slice(0, 3).map((item) => ({
                    title: (item.page_from_title || '').trim() || `Mention from ${domain}`,
                    url: item.url_from || `https://${domain}`,
                    count: Math.max(1, toNumber(item.links_count, 1)),
                    label: item.dofollow === false ? 'NoFollow' : 'Main',
                })),
            } satisfies BacklinkOpportunity;
        })
        .sort((a, b) => b.dr - a.dr)
        .slice(0, 12);
}

function buildSnapshotFromFetchResults(competitors: BacklinkCompetitor[], results: CompetitorFetchResult[]): BacklinksSnapshot {
    const details: Record<string, BacklinkCompetitorDetail> = {};

    results.forEach((result) => {
        details[result.competitor.id] = {
            metrics: mapSummaryToMetrics(result.summary),
            tlds: mapTlds(result.summary),
            opportunities: mapOpportunities(result.backlinks),
        };
    });

    const totalBacklinks = results.reduce((sum, r) => sum + toNumber(r.summary?.backlinks), 0);
    const avgRefDomains = results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + toNumber(r.summary?.referring_domains), 0) / results.length)
        : 0;

    return {
        summary: {
            competitors: Math.max(0, competitors.length - 1),
            totalBacklinks,
            avgRefDomains,
        },
        competitors,
        details,
    };
}

function isBacklinksSnapshot(value: unknown): value is BacklinksSnapshot {
    if (!value || typeof value !== 'object') return false;
    const snapshot = value as Partial<BacklinksSnapshot>;
    return Boolean(snapshot.summary && Array.isArray(snapshot.competitors) && snapshot.details && typeof snapshot.details === 'object');
}

async function getUserBrandProfile(userId: string, brandId?: string) {
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

async function persistSnapshot(userId: string, brandId: string, snapshot: BacklinksSnapshot): Promise<void> {
    await db
        .insert(brandBacklinkSnapshots)
        .values({
            userId,
            brandId,
            snapshot,
        })
        .onConflictDoUpdate({
            target: [brandBacklinkSnapshots.userId, brandBacklinkSnapshots.brandId],
            set: {
                snapshot,
                updatedAt: new Date(),
            },
        });
}

async function fetchCompetitorsData(competitors: BacklinkCompetitor[]): Promise<CompetitorFetchResult[]> {
    const client = new DataForSEOClient();

    const tasks = competitors.map(async (competitor) => {
        try {
            const [summary, backlinks] = await Promise.all([
                client.getSummary(competitor.url),
                client.getBacklinks(competitor.url, 100),
            ]);
            return {
                competitor,
                summary,
                backlinks,
            } satisfies CompetitorFetchResult;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch competitor backlinks';
            return {
                competitor,
                summary: null,
                backlinks: [],
                error: message,
            } satisfies CompetitorFetchResult;
        }
    });

    return Promise.all(tasks);
}

function emptyResponse(brandId: string | null, competitors: BacklinkCompetitor[] = []): BacklinksResponse {
    return {
        hasData: brandId !== null,
        hasSnapshot: false,
        brandId,
        generatedAt: new Date().toISOString(),
        source: 'none',
        summary: {
            competitors: Math.max(0, competitors.length - 1),
            totalBacklinks: 0,
            avgRefDomains: 0,
        },
        competitors,
        details: {},
    };
}

export async function getCurrentBacklinks(input: {
    userId: string;
    brandId?: string;
}): Promise<BacklinksResponse> {
    logMethodEntry('backlinksService.getCurrentBacklinks', input);
    const profile = await getUserBrandProfile(input.userId, input.brandId);
    if (!profile) {
        return emptyResponse(null);
    }

    const preloadedCompetitors = parsePreloadedCompetitors({
        brandName: profile.name,
        brandUrl: profile.url,
        competitorsRaw: profile.competitors,
    });

    const stored = await db.query.brandBacklinkSnapshots.findFirst({
        where: and(eq(brandBacklinkSnapshots.userId, input.userId), eq(brandBacklinkSnapshots.brandId, profile.id)),
        orderBy: desc(brandBacklinkSnapshots.updatedAt),
    });

    if (stored && isBacklinksSnapshot(stored.snapshot)) {
        return {
            hasData: true,
            hasSnapshot: true,
            brandId: profile.id,
            generatedAt: (stored.updatedAt ?? stored.createdAt ?? new Date()).toISOString(),
            source: 'db',
            ...stored.snapshot,
        };
    }

    return emptyResponse(profile.id, preloadedCompetitors);
}

export async function refreshCurrentBacklinks(input: {
    userId: string;
    brandId?: string;
}): Promise<BacklinksResponse> {
    logMethodEntry('backlinksService.refreshCurrentBacklinks', input);
    const profile = await getUserBrandProfile(input.userId, input.brandId);
    if (!profile) {
        return emptyResponse(null);
    }

    const competitors = parsePreloadedCompetitors({
        brandName: profile.name,
        brandUrl: profile.url,
        competitorsRaw: profile.competitors,
    });

    if (competitors.length === 0) {
        return emptyResponse(profile.id, competitors);
    }

    const fetchedResults = await fetchCompetitorsData(competitors);
    const snapshot = buildSnapshotFromFetchResults(competitors, fetchedResults);
    await persistSnapshot(input.userId, profile.id, snapshot);

    return {
        hasData: true,
        hasSnapshot: true,
        brandId: profile.id,
        generatedAt: new Date().toISOString(),
        source: 'fetched',
        ...snapshot,
    };
}

export async function getRefreshCompetitorCount(input: {
    userId: string;
    brandId?: string;
}): Promise<number> {
    const profile = await getUserBrandProfile(input.userId, input.brandId);
    if (!profile) return 0;
    const competitors = parsePreloadedCompetitors({
        brandName: profile.name,
        brandUrl: profile.url,
        competitorsRaw: profile.competitors,
    });
    return Math.max(0, competitors.filter((c) => !c.isOwn).length);
}
