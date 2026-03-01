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
      ALTER TABLE brand_analyses
        ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brand_profile(id);
    `);
    console.log("brand_analyses brand_id column ensured");
  } catch (error) {
    console.error("SQL error:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
