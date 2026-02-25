// ─────────────────────────────────────────────────────────────
// src/config/firecrawl.ts
// Firecrawl client singleton used by scraper.service.ts
// Source: inline `new FirecrawlApp(...)` in WebApp/lib/scrape-utils.ts
// ─────────────────────────────────────────────────────────────

import FirecrawlApp from '@mendable/firecrawl-js';
import { env } from './env';

export const firecrawl = new FirecrawlApp({
    apiKey: env.FIRECRAWL_API_KEY,
});
