const { Pool } = require('pg');
require('dotenv').config({ path: __dirname + '/.env' });

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing in .env');
    process.exit(1);
  }

  const initial = Number(process.env.INITIAL_FREE_CREDITS || '100');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_wallets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL UNIQUE,
        balance numeric(12,2) NOT NULL DEFAULT 0,
        reserved_balance numeric(12,2) NOT NULL DEFAULT 0,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_ledger (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        delta numeric(12,2) NOT NULL,
        reason text NOT NULL,
        reference_type text,
        reference_id text,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_reservations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        amount_total numeric(12,2) NOT NULL,
        amount_remaining numeric(12,2) NOT NULL,
        status text NOT NULL DEFAULT 'reserved',
        reason text NOT NULL DEFAULT 'usage_reserve',
        reference_type text,
        reference_id text,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    await pool.query(`
      ALTER TABLE credit_wallets
      ALTER COLUMN balance TYPE numeric(12,2)
      USING balance::numeric(12,2);
    `);

    await pool.query(`
      ALTER TABLE credit_wallets
      ADD COLUMN IF NOT EXISTS reserved_balance numeric(12,2) NOT NULL DEFAULT 0;
    `);

    await pool.query(`
      ALTER TABLE credit_ledger
      ALTER COLUMN delta TYPE numeric(12,2)
      USING delta::numeric(12,2);
    `);

    await pool.query(`
      ALTER TABLE brand_analyses
      ALTER COLUMN credits_used TYPE numeric(12,2)
      USING credits_used::numeric(12,2);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created
      ON credit_ledger (user_id, created_at DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_credit_reservations_user_created
      ON credit_reservations (user_id, created_at DESC);
    `);

    await pool.query(
      `
      INSERT INTO credit_wallets (user_id, balance, reserved_balance)
      SELECT CAST(id AS text), $1::numeric, 0
      FROM users
      ON CONFLICT (user_id) DO NOTHING;
      `,
      [initial],
    );

    await pool.query(
      `
      INSERT INTO credit_ledger (user_id, delta, reason, reference_type, reference_id, metadata)
      SELECT CAST(id AS text), $1::numeric, 'signup_bonus', 'migration', CAST(id AS text), '{}'::jsonb
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM credit_ledger l
        WHERE l.user_id = CAST(u.id AS text)
          AND l.reason = 'signup_bonus'
      );
      `,
      [initial],
    );

    console.log('credit_wallets, credit_ledger, and credit_reservations tables ensured');
  } catch (error) {
    console.error('SQL error:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
