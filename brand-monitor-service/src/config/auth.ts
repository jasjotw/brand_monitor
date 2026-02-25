// ─────────────────────────────────────────────────────────────
// src/config/auth.ts
// Source: WebApp/lib/auth.ts  (session validation only)
//
// We reuse the same better-auth config so that session cookies
// issued by the Next.js WebApp are fully trusted here.
//
// NOTE: The autumn() better-auth plugin is intentionally NOT
// included here. That plugin is only needed for the auth login
// flow (e.g. granting credits on signup). This microservice only
// validates existing sessions — credit checks go directly through
// the Autumn SDK in credit.service.ts without needing the plugin.
// ─────────────────────────────────────────────────────────────

import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL!,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    }),
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.WEBAPP_BASE_URL || 'http://localhost:3000',
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7,   // 7 days — must match WebApp
        updateAge: 60 * 60 * 24,         // update if older than 1 day
        cookieOptions: {
            httpOnly: true,
            sameSite: 'lax' as const,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
        },
    },
    advanced: {
        crossSubDomainCookies: {
            enabled: process.env.NODE_ENV === 'production',
        },
    },
    // No plugins — autumn() is not needed for session validation only.
    // Credit tracking is handled directly in credit.service.ts.
});
