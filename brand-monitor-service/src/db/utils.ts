// ─────────────────────────────────────────────────────────────
// src/db/utils.ts
// Source: WebApp/lib/db/utils.ts
// DB retry helpers — copied verbatim, import adjusted to local db.
// ─────────────────────────────────────────────────────────────

import { db } from './client';

/**
 * Retries a database operation with exponential backoff.
 * Skips retries for fatal errors (auth, permission, not-found).
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000,
): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;

            // Don't retry on certain types of errors
            if (
                error instanceof Error &&
                (error.message.includes('authentication') ||
                    error.message.includes('permission') ||
                    error.message.includes('not found'))
            ) {
                throw error;
            }

            if (attempt === maxRetries) {
                console.error(`Database operation failed after ${maxRetries} attempts:`, error);
                throw error;
            }

            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, error);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError!;
}

/** Convenience wrapper: 3 retries with 1-second base delay. */
export async function executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    return withRetry(operation, 3, 1000);
}

/** Smoke-tests the DB connection using a fresh pool with generous timeout. */
export async function testConnection(): Promise<boolean> {
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('[DB] Connection established');
        return true;
    } catch (error: any) {
        console.error('Database connection test failed:', error?.message ?? error);
        return false;
    } finally {
        await pool.end().catch(() => { });
    }
}
