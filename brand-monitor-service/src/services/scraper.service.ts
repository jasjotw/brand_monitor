// ─────────────────────────────────────────────────────────────
// src/services/scraper.service.ts
// Source: WebApp/lib/scrape-utils.ts  (scrapeCompanyInfo)
//
// Wraps Firecrawl + AI extraction into one clean async function.
// Uses providers from config/providers.ts (same as WebApp).
// ─────────────────────────────────────────────────────────────

import { generateObject } from 'ai';
import { z } from 'zod';
import { Company } from '../types';
import { firecrawl } from '../config/firecrawl';
import {
    getConfiguredProviders,
    getProviderModel,
} from '../config/providers';
import { isQuotaError } from '../utils/errors';

// ── Error Classes ─────────────────────────────────────────────

class AIProviderError extends Error {
    constructor(provider: string, cause: Error) {
        super(`AI Provider (${provider}) failed: ${cause.message}`);
        this.name = 'AIProviderError';
    }
}

// ── Helpers ───────────────────────────────────────────────────

function resolveUrl(url: string | undefined, base: string): string | undefined {
    if (!url) return undefined;
    try {
        return new URL(url, base).href;
    } catch {
        return undefined;
    }
}

async function basicFallbackScrape(url: string): Promise<{ content: string; metadata: any }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            DNT: '1',
            Connection: 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        },
        signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const html = await response.text();
    const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);

    return {
        content: textContent.substring(0, 10000),
        metadata: {
            title: titleMatch?.[1]?.trim(),
            description: descriptionMatch?.[1]?.trim(),
            ogImage: ogImageMatch ? resolveUrl(ogImageMatch[1].trim(), url) : undefined,
            favicon: faviconMatch ? resolveUrl(faviconMatch[1].trim(), url) : undefined,
        },
    };
}

// ── Zod Schema ────────────────────────────────────────────────

const CompanyInfoSchema = z.object({
    name: z.string(),
    description: z.string(),
    keywords: z.array(z.string()),
    industry: z.string(),
    mainProducts: z.array(z.string()),
    location: z
        .string()
        .optional()
        .describe('The physical location of the company, e.g., "Austin, TX"'),
    competitors: z.array(z.string()).optional(),
});

// ── Main Export ───────────────────────────────────────────────

/**
 * Scrapes a company URL via Firecrawl (with basic HTTP fallback) and then
 * uses the configured AI providers to extract structured company info.
 *
 * If all AI providers fail, returns a minimal Company object derived
 * from the URL hostname so the caller always gets something usable.
 */
export async function scrapeCompanyInfo(url: string, maxAge?: number): Promise<Company> {
    // ── 1. Normalize URL ──────────────────────────────────────

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
    }

    const cacheAge = maxAge ? Math.floor(maxAge / 1000) : 604800; // 1 week
    const maxRetries = 2;
    const timeoutMs = 30000;

    // ── 2. Firecrawl scrape (with retry + fallback) ───────────

    let response: any;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Scraper] Firecrawl attempt ${attempt}/${maxRetries}: ${normalizedUrl}`);

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Scrape timeout after 30 seconds')), timeoutMs),
            );

            const scrapePromise = firecrawl.scrapeUrl(normalizedUrl, {
                formats: ['markdown'],
                maxAge: cacheAge,
                timeout: 25000,
            });

            response = await Promise.race([scrapePromise, timeoutPromise]);

            if (!response.success) throw new Error(response.error || 'Firecrawl scrape failed');
            break;
        } catch (err) {
            lastError = err as Error;
            console.warn(`[Scraper] Firecrawl attempt ${attempt} failed:`, lastError.message);
            if (attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, attempt * 2000));
            }
        }
    }

    if (!response?.success) {
        console.warn('[Scraper] Firecrawl failed — attempting basic fallback scrape');
        try {
            const fallback = await basicFallbackScrape(normalizedUrl);
            response = { success: true, markdown: fallback.content, metadata: fallback.metadata };
        } catch (fallbackErr) {
            console.error('[Scraper] Fallback scrape also failed:', (fallbackErr as Error).message);
            throw lastError ?? new Error('All scraping attempts failed');
        }
    }

    const html: string = response.markdown ?? '';
    const metadata: any = response.metadata ?? {};

    // Ensure image URLs are absolute
    if (metadata.ogImage) metadata.ogImage = resolveUrl(metadata.ogImage, normalizedUrl);
    if (metadata.favicon) metadata.favicon = resolveUrl(metadata.favicon, normalizedUrl);

    // ── 3. AI extraction ──────────────────────────────────────

    const configuredProviders = getConfiguredProviders()
        .filter((p) => p.capabilities.structuredOutput)
        .sort((a, b) => {
            if (a.id === 'openai') return -1;
            if (b.id === 'openai') return 1;
            return 0;
        });

    if (configuredProviders.length === 0) {
        throw new Error('No AI providers configured and enabled for content extraction');
    }

    let extractedData: z.infer<typeof CompanyInfoSchema> | undefined;
    let lastAIError: Error | undefined;

    for (let i = 0; i < configuredProviders.length; i++) {
        const provider = configuredProviders[i];
        const fastModelId = provider.models.find(
            (m) => m.name.toLowerCase().includes('mini') || m.name.toLowerCase().includes('flash'),
        )?.id ?? provider.defaultModel;

        const model = getProviderModel(provider.id, fastModelId);
        if (!model) {
            console.warn(`[Scraper] ${provider.name} model not available, trying next`);
            continue;
        }

        try {
            console.log(`[Scraper] AI extraction with ${provider.name} (attempt ${i + 1}/${configuredProviders.length})`);

            const { object } = await generateObject({
                model,
                schema: CompanyInfoSchema,
                prompt: buildExtractionPrompt(normalizedUrl, html),
            });

            extractedData = object;
            console.log(`[Scraper] AI extraction successful with ${provider.name}`);
            break;
        } catch (err) {
            const aiErr = new AIProviderError(provider.name, err as Error);
            lastAIError = aiErr;
            console.error('[Scraper]', aiErr.message);
            if (isQuotaError(err as Error)) {
                console.log(`[Scraper] ${provider.name} quota exceeded, trying next provider`);
            }
            continue;
        }
    }

    if (!extractedData) {
        console.error('[Scraper] All AI providers failed');
        throw lastAIError ?? new Error('All AI providers failed to extract company information');
    }

    // ── 4. Build Company object ───────────────────────────────

    const urlObj = new URL(normalizedUrl);
    const domain = urlObj.hostname.replace('www.', '');
    const faviconUrl =
        metadata.favicon ??
        `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

    return {
        id: crypto.randomUUID(),
        url: normalizedUrl,
        name: extractedData.name,
        description: extractedData.description,
        industry: extractedData.industry,
        location: extractedData.location,
        logo: metadata.ogImage ?? faviconUrl ?? undefined,
        favicon: faviconUrl,
        scraped: true,
        scrapedData: {
            title: extractedData.name,
            description: extractedData.description,
            keywords: extractedData.keywords,
            mainContent: html,
            mainProducts: extractedData.mainProducts,
            competitors: extractedData.competitors,
            ogImage: metadata.ogImage ?? undefined,
            favicon: faviconUrl,
        },
    };
}

// ── Prompt Builder ────────────────────────────────────────────

function buildExtractionPrompt(url: string, html: string): string {
    return `Extract company information from this website content:

URL: ${url}
Content: ${html}

Extract the company name, location (city and state/country), a brief description, relevant keywords, and identify the PRIMARY industry category.

Industry detection rules:
- Outdoor gear: coolers, drinkware, outdoor equipment, camping gear, fishing, hiking, survival gear.
- Web scraping: scraping, crawling, data extraction, HTML parsing, bots, proxies, data aggregator.
- AI/ML: AI, machine learning, deep learning, computer vision, NLP, LLM, generative AI.
- Cloud/Deployment: hosting, deployment, cloud infrastructure, servers, DevOps, Kubernetes.
- E-commerce platforms: online store builder, Shopify competitor, marketplace builder, storefront SaaS.
- Direct-to-consumer brand (D2C): sells physical products directly to consumers.
- Apparel & Fashion: clothing, underwear, footwear, luxury fashion, jewelry, eyewear.
- Developer Tools: APIs, SDKs, frameworks, developer platforms, testing tools, CI/CD.
- Marketplace: aggregator, multi-vendor platform, gig platforms, P2P rentals, service exchanges.
- SaaS (B2B software): CRM, HR, payroll, analytics, workflow, productivity, marketing automation.
- Consumer Goods: food, beverages, skincare, wellness, household items, packaged goods.
- Fintech: payments, lending, wallets, neobanks, investments, insurance tech.
- Healthtech: telemedicine, digital health, wearables, diagnostics, fitness apps.
- Edtech: online learning, upskilling, tutoring, digital classrooms.
- Mobility/Transportation: ride-hailing, EV, logistics, fleet management, drones.
- Hardware/IoT: electronics, devices, wearables, robotics, sensors, smart home.
- Media/Entertainment: streaming, gaming, content platforms, social media.
- GreenTech/CleanTech: renewable energy, EV charging, carbon credits, recycling, sustainability.
- Real Estate/PropTech: housing platforms, rental apps, construction tech, co-living.

IMPORTANT:
1. For mainProducts, list the ACTUAL PRODUCTS (e.g., "coolers", "tumblers", "drinkware") not product categories
2. For competitors, extract FULL COMPANY NAMES (e.g., "RTIC", "IGLOO", "Coleman") not just initials
3. Focus on what the company MAKES/SELLS`;
}
