// ─────────────────────────────────────────────────────────────
// src/config/env.ts
// Environment variable validation — fails fast on startup if
// required vars are missing.
// ─────────────────────────────────────────────────────────────

import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`[env] Missing required environment variable: ${key}`);
    }
    return value;
}

function optionalEnv(key: string, defaultValue = ''): string {
    return process.env[key] || defaultValue;
}

export const env = {
    // Server
    PORT: parseInt(optionalEnv('PORT', '3001'), 10),
    NODE_ENV: optionalEnv('NODE_ENV', 'development'),

    // Database
    DATABASE_URL: requireEnv('DATABASE_URL'),
    DB_POOL_MAX: parseInt(optionalEnv('DB_POOL_MAX', '30'), 10),
    DB_POOL_IDLE_TIMEOUT_MS: parseInt(optionalEnv('DB_POOL_IDLE_TIMEOUT_MS', '30000'), 10),
    DB_POOL_CONN_TIMEOUT_MS: parseInt(optionalEnv('DB_POOL_CONN_TIMEOUT_MS', '10000'), 10),

    // AI Providers
    OPENROUTER_API_KEY: optionalEnv('OPENROUTER_API_KEY'),

    // Firecrawl
    FIRECRAWL_API_KEY: optionalEnv('FIRECRAWL_API_KEY'),

    // Credits
    INITIAL_FREE_CREDITS: parseInt(optionalEnv('INITIAL_FREE_CREDITS', '100'), 10),

    // Auth
    BETTER_AUTH_SECRET: optionalEnv('BETTER_AUTH_SECRET'),
    BETTER_AUTH_URL: optionalEnv('BETTER_AUTH_URL', 'http://localhost:3001'),
    JWT_SECRET: optionalEnv('JWT_SECRET'),

    // Superuser
    SUPERUSER_EMAILS: optionalEnv('SUPERUSER_EMAILS', ''),

    // Geo/Proxy service
    GEO_SERVICE_URL: optionalEnv('GEO_SERVICE_URL', 'http://localhost:3002'),

    // DataForSEO
    DATAFORSEO_LOGIN: optionalEnv('DATAFORSEO_LOGIN'),
    DATAFORSEO_PASSWORD: optionalEnv('DATAFORSEO_PASSWORD'),

    // Diagnostics provider
    DIAGNOSTICS_SERVICE_URL: optionalEnv('DIAGNOSTICS_SERVICE_URL'),
    DIAGNOSTICS_API_KEY: optionalEnv('DIAGNOSTICS_API_KEY'),

    // Misc
    USE_MOCK_MODE: optionalEnv('USE_MOCK_MODE', 'false') === 'true',
    BRAND_CREATE_SKIP_SCRAPE: optionalEnv('BRAND_CREATE_SKIP_SCRAPE', 'false') === 'true',

    isProd: () => process.env.NODE_ENV === 'production',
};
