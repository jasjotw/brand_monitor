// ─────────────────────────────────────────────────────────────
// src/db/client.ts
// Re-exports the shared db instance from config/database.ts so
// service files can import from a clean path: '../db/client'.
// ─────────────────────────────────────────────────────────────

export { db, pool } from '../config/database';
