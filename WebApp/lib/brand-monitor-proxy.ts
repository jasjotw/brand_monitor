// ─────────────────────────────────────────────────────────────
// WebApp/lib/brand-monitor-proxy.ts
//
// A thin fetch wrapper that routes every brand-monitor API call
// to the microservice instead of the internal Next.js handlers.
//
// Usage in server components / API routes:
//   import { brandMonitorFetch } from '@/lib/brand-monitor-proxy';
//   const res = await brandMonitorFetch('/api/brand-monitor/scrape', {
//     method: 'POST',
//     body: JSON.stringify({ url, maxAge }),
//     headers: { cookie: req.headers.get('cookie') ?? '' },  // forward session
//   });
// ─────────────────────────────────────────────────────────────

const BRAND_MONITOR_SERVICE_URL =
    process.env.BRAND_MONITOR_SERVICE_URL || 'http://localhost:4001';

/**
 * Forwards a request to the brand-monitor microservice.
 * Cookie headers are passed through so the service can validate the session.
 */
export async function brandMonitorFetch(
    path: string,
    init: RequestInit = {},
): Promise<Response> {
    const url = `${BRAND_MONITOR_SERVICE_URL}${path}`;

    const response = await fetch(url, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(init.headers as Record<string, string>),
        },
    });

    return response;
}
