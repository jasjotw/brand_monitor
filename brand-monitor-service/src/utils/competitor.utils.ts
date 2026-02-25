// ─────────────────────────────────────────────────────────────
// src/utils/competitor.utils.ts
// Source: WebApp/lib/brand-monitor-utils.ts
//   - normalizeCompetitorName()
//   - assignUrlToCompetitor()
//   - deriveCompetitorNameFromUrl()
//   - getDomainFromUrl()
// ─────────────────────────────────────────────────────────────

/**
 * Normalises known competitor name variations to canonical forms
 * (e.g. "Amazon Web Services" → "aws").
 */
export function normalizeCompetitorName(name: string): string {
    const normalized = name.toLowerCase().trim();

    const nameNormalizations: Record<string, string> = {
        'amazon web services': 'aws',
        'amazon web services (aws)': 'aws',
        'amazon aws': 'aws',
        'microsoft azure': 'azure',
        'google cloud platform': 'google cloud',
        'google cloud platform (gcp)': 'google cloud',
        gcp: 'google cloud',
        'digital ocean': 'digitalocean',
        'beautiful soup': 'beautifulsoup',
        'bright data': 'brightdata',
    };

    return nameNormalizations[normalized] || normalized;
}

/**
 * Looks up a known URL for a competitor name, or derives a plausible
 * `.com` domain when `allowGuess` is true.
 */
export function assignUrlToCompetitor(competitorName: string, allowGuess = true): string | undefined {
    const urlMappings: Record<string, string> = {
        // Web scraping
        apify: 'apify.com',
        scrapy: 'scrapy.org',
        octoparse: 'octoparse.com',
        parsehub: 'parsehub.com',
        diffbot: 'diffbot.com',
        'import.io': 'import.io',
        'bright data': 'brightdata.com',
        zyte: 'zyte.com',
        puppeteer: 'pptr.dev',
        playwright: 'playwright.dev',
        selenium: 'selenium.dev',
        'beautiful soup': 'pypi.org/project/beautifulsoup4',
        scrapfly: 'scrapfly.io',
        crawlbase: 'crawlbase.com',
        webharvy: 'webharvy.com',
        // AI
        openai: 'openai.com',
        anthropic: 'anthropic.com',
        'google ai': 'ai.google',
        'microsoft azure': 'azure.microsoft.com',
        'ibm watson': 'ibm.com/watson',
        'amazon aws': 'aws.amazon.com',
        perplexity: 'perplexity.ai',
        claude: 'anthropic.com',
        chatgpt: 'openai.com',
        gemini: 'gemini.google.com',
        // SaaS
        salesforce: 'salesforce.com',
        hubspot: 'hubspot.com',
        zendesk: 'zendesk.com',
        slack: 'slack.com',
        atlassian: 'atlassian.com',
        'monday.com': 'monday.com',
        notion: 'notion.so',
        airtable: 'airtable.com',
        // E-commerce
        shopify: 'shopify.com',
        woocommerce: 'woocommerce.com',
        magento: 'magento.com',
        bigcommerce: 'bigcommerce.com',
        squarespace: 'squarespace.com',
        wix: 'wix.com',
        // Cloud/hosting
        vercel: 'vercel.com',
        netlify: 'netlify.com',
        aws: 'aws.amazon.com',
        'google cloud': 'cloud.google.com',
        azure: 'azure.microsoft.com',
        heroku: 'heroku.com',
        digitalocean: 'digitalocean.com',
        cloudflare: 'cloudflare.com',
    };

    const normalized = competitorName.toLowerCase().trim();
    if (!normalized) return undefined;

    if (urlMappings[normalized]) return urlMappings[normalized];

    if (!allowGuess) return undefined;

    // Derive a plausible domain from the company name
    const cleaned = normalized
        .replace(/&/g, ' and ')
        .replace(/\b(the|inc|llc|ltd|co|corp|company|corporation)\b/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const compact = cleaned.replace(/\s+/g, '');
    if (!cleaned || compact.length < 3) return undefined;

    return `${compact}.com`;
}

/**
 * Derives a human-readable company name from a URL hostname.
 * e.g. "some-tool.io" → "Some Tool"
 */
export function deriveCompetitorNameFromUrl(url: string): string {
    try {
        const withProtocol = url.startsWith('http') ? url : `https://${url}`;
        const hostname = new URL(withProtocol).hostname.replace(/^www\./, '');
        const base = hostname.split('.')[0] || hostname;
        const words = base.split('-').filter(Boolean);
        return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    } catch {
        return url;
    }
}

/**
 * Extracts the bare hostname (no `www.`) from a URL.
 * Returns undefined if the URL is unparseable.
 */
export function getDomainFromUrl(url: string): string | undefined {
    try {
        const withProtocol = url.startsWith('http') ? url : `https://${url}`;
        return new URL(withProtocol).hostname.replace(/^www\./, '');
    } catch {
        return undefined;
    }
}
