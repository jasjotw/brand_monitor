const { Pool } = require("pg");
require("dotenv").config({ path: __dirname + "/.env" });

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing in .env");
    process.exit(1);
  }
  console.log(process.env.DATABASE_URL)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`
      ALTER TABLE brand_profile
        ADD COLUMN IF NOT EXISTS usp jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS audience text,
        ADD COLUMN IF NOT EXISTS market_positioning text;
    `);
    console.log("brand_profile columns ensured");
  } catch (error) {
    console.error("SQL error:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
