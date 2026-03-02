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
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_POOL_CONN_TIMEOUT_MS,
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
