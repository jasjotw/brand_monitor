import { Pool } from 'pg';

let authInstance: any = null;

export async function getAuth() {
    if (authInstance) return authInstance;

    // Load ESM-only better-auth from CommonJS runtime.
    const { betterAuth } = await eval("import('better-auth')");

    authInstance = betterAuth({
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
            expiresIn: 60 * 60 * 24 * 7,
            updateAge: 60 * 60 * 24,
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
        // Billing/credits are handled by in-house services.
    });

    return authInstance;
}
