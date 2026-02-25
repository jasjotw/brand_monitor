// ─────────────────────────────────────────────────────────────
// src/config/database.ts
// Source: WebApp/lib/db/index.ts
// Drizzle ORM connection pool for the shared PostgreSQL database.
// ─────────────────────────────────────────────────────────────

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';
import { env } from './env';

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    maxUses: 7500,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client:', err);
});

pool.on('connect', () => {
    console.log('[DB] Connection established');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('[DB] Closing pool (SIGINT)...');
    await pool.end();
});
process.on('SIGTERM', async () => {
    console.log('[DB] Closing pool (SIGTERM)...');
    await pool.end();
});

export const db = drizzle(pool, { schema });
export { pool };
