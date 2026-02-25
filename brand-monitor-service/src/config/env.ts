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

    // AI Providers
    OPENROUTER_API_KEY: optionalEnv('OPENROUTER_API_KEY'),

    // Firecrawl
    FIRECRAWL_API_KEY: optionalEnv('FIRECRAWL_API_KEY'),

    // Billing
    AUTUMN_SECRET_KEY: optionalEnv('AUTUMN_SECRET_KEY'),

    // Auth
    BETTER_AUTH_SECRET: optionalEnv('BETTER_AUTH_SECRET'),
    BETTER_AUTH_URL: optionalEnv('BETTER_AUTH_URL', 'http://localhost:3001'),

    // Superuser
    SUPERUSER_EMAILS: optionalEnv('SUPERUSER_EMAILS', ''),

    // Geo/Proxy service
    GEO_SERVICE_URL: optionalEnv('GEO_SERVICE_URL', 'http://localhost:3002'),

    // Misc
    USE_MOCK_MODE: optionalEnv('USE_MOCK_MODE', 'false') === 'true',

    isProd: () => process.env.NODE_ENV === 'production',
};
