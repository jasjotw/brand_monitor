const { Pool } = require("pg");
require("dotenv").config({ path: __dirname + "/.env" });

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing in .env");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS brand_backlink_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        brand_id uuid NOT NULL REFERENCES brand_profile(id) ON DELETE CASCADE,
        snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        UNIQUE (user_id, brand_id)
      );

      CREATE INDEX IF NOT EXISTS idx_brand_backlink_snapshots_user_id
        ON brand_backlink_snapshots(user_id);

      CREATE INDEX IF NOT EXISTS idx_brand_backlink_snapshots_brand_id
        ON brand_backlink_snapshots(brand_id);
    `);

    console.log("brand_backlink_snapshots table ensured");
  } catch (error) {
    console.error("SQL error:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
