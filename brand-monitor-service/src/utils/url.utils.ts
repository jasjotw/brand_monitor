// ─────────────────────────────────────────────────────────────
// src/utils/url.utils.ts
// Source: WebApp/lib/brand-monitor-utils.ts
//   - isValidUrlFormat()
//   - validateUrl()
//   - validateCompetitorUrl()
// + inline URL normalization found in the scrape route handler.
// ─────────────────────────────────────────────────────────────

/**
 * Validates the format of a URL without making a network call.
 * Returns true if the URL has a valid hostname structure.
 */
export function isValidUrlFormat(url: string): boolean {
    try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        const hostname = urlObj.hostname;
        const parts = hostname.split('.');

        if (parts.length < 2) return false;

        const tld = parts[parts.length - 1];
        if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;

        for (const part of parts) {
            if (!/^[a-zA-Z0-9-]+$/.test(part) || part.startsWith('-') || part.endsWith('-')) {
                return false;
            }
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * Live HTTP reachability check — makes a HEAD (or GET fallback) request.
 * Returns false on timeout (5 s) or any network error.
 */
export async function validateUrl(url: string): Promise<boolean> {
    if (!isValidUrlFormat(url)) return false;

    try {
        const normalized = url.startsWith('http') ? url : `https://${url}`;
        const urlObj = new URL(normalized);

        const fetchWithTimeout = async (method: string): Promise<boolean> => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            try {
                const response = await fetch(urlObj.toString(), {
                    method,
                    redirect: 'follow',
                    signal: controller.signal,
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    },
                });
                clearTimeout(timeoutId);
                return response.ok;
            } catch {
                clearTimeout(timeoutId);
                return false;
            }
        };

        const headOk = await fetchWithTimeout('HEAD');
        if (headOk) return true;

        // HEAD sometimes returns 405/403/404 even for live sites — retry with GET
        return fetchWithTimeout('GET');
    } catch {
        return false;
    }
}

/**
 * Normalises and validates a competitor URL.
 * Adds `https://` prefix if missing, strips trailing slashes,
 * and returns the origin (scheme + host) only.
 * Returns undefined if the URL is unparseable.
 */
export function validateCompetitorUrl(url: string): string | undefined {
    if (!url) return undefined;

    let cleanUrl = url.trim().replace(/\/$/, '');

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
    }

    try {
        return new URL(cleanUrl).origin;
    } catch {
        return undefined;
    }
}

/**
 * Ensures a URL has an `https://` scheme and returns the full normalised URL.
 * Used when writing brand URLs into the database.
 */
export function normalizeUrl(url: string): string {
    if (!url) return url;
    const trimmed = url.trim().replace(/\/$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    return `https://${trimmed}`;
}
