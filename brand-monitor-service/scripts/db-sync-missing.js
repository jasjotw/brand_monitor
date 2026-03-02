const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

async function runStep(pool, label, sql, params = []) {
  try {
    await pool.query(sql, params);
    console.log(`[DB Sync] OK: ${label}`);
  } catch (error) {
    console.error(`[DB Sync] FAIL: ${label}`);
    throw error;
  }
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("[DB Sync] DATABASE_URL missing in brand-monitor-service/.env");
    process.exit(1);
  }

  const initialCredits = Number(process.env.INITIAL_FREE_CREDITS || "100");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await runStep(pool, "enable pgcrypto extension", `
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `);

    // brand_profile updates
    await runStep(pool, "brand_profile columns", `
      ALTER TABLE brand_profile
        ADD COLUMN IF NOT EXISTS usp jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS audience text,
        ADD COLUMN IF NOT EXISTS market_positioning text;
    `);

    // brand_analyses updates
    await runStep(pool, "brand_analyses.brand_id", `
      ALTER TABLE brand_analyses
        ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES brand_profile(id);
    `);

    await runStep(pool, "brand_analyses.draft_prompts jsonb", `
      ALTER TABLE brand_analyses
        ADD COLUMN IF NOT EXISTS draft_prompts jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);

    await runStep(pool, "brand_analyses.draft_prompts backfill", `
      UPDATE brand_analyses
      SET draft_prompts = COALESCE(prompts, '[]'::jsonb)
      WHERE analysis_data->>'status' = 'prompt_draft'
        AND (draft_prompts IS NULL OR jsonb_array_length(draft_prompts) = 0)
        AND prompts IS NOT NULL;
    `);

    await runStep(pool, "brand_analyses.credits_used numeric(12,2)", `
      ALTER TABLE brand_analyses
      ALTER COLUMN credits_used TYPE numeric(12,2)
      USING credits_used::numeric(12,2);
    `);

    // audience profiles
    await runStep(pool, "audience_profiles table", `
      CREATE TABLE IF NOT EXISTS audience_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        brand_id uuid NOT NULL REFERENCES brand_profile(id) ON DELETE CASCADE,
        personas jsonb DEFAULT '[]'::jsonb,
        icp jsonb,
        additional_inputs jsonb DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        UNIQUE (user_id, brand_id)
      );
    `);

    // backlinks snapshot
    await runStep(pool, "brand_backlink_snapshots table", `
      CREATE TABLE IF NOT EXISTS brand_backlink_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        brand_id uuid NOT NULL REFERENCES brand_profile(id) ON DELETE CASCADE,
        snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        UNIQUE (user_id, brand_id)
      );
    `);

    await runStep(pool, "brand_backlink_snapshots indexes", `
      CREATE INDEX IF NOT EXISTS idx_brand_backlink_snapshots_user_id
        ON brand_backlink_snapshots(user_id);
      CREATE INDEX IF NOT EXISTS idx_brand_backlink_snapshots_brand_id
        ON brand_backlink_snapshots(brand_id);
    `);

    // credits system
    await runStep(pool, "credit_wallets table", `
      CREATE TABLE IF NOT EXISTS credit_wallets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL UNIQUE,
        balance numeric(12,2) NOT NULL DEFAULT 0,
        reserved_balance numeric(12,2) NOT NULL DEFAULT 0,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    await runStep(pool, "credit_ledger table", `
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

    await runStep(pool, "credit_reservations table", `
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

    await runStep(pool, "credit columns normalize", `
      ALTER TABLE credit_wallets
      ALTER COLUMN balance TYPE numeric(12,2)
      USING balance::numeric(12,2);

      ALTER TABLE credit_wallets
      ADD COLUMN IF NOT EXISTS reserved_balance numeric(12,2) NOT NULL DEFAULT 0;

      ALTER TABLE credit_ledger
      ALTER COLUMN delta TYPE numeric(12,2)
      USING delta::numeric(12,2);
    `);

    await runStep(pool, "credit indexes", `
      CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created
      ON credit_ledger (user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_credit_reservations_user_created
      ON credit_reservations (user_id, created_at DESC);
    `);

    await runStep(
      pool,
      "credit_wallets backfill",
      `
      INSERT INTO credit_wallets (user_id, balance, reserved_balance)
      SELECT CAST(id AS text), $1::numeric, 0
      FROM users
      ON CONFLICT (user_id) DO NOTHING;
      `,
      [initialCredits]
    );

    await runStep(
      pool,
      "signup_bonus ledger backfill",
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
      [initialCredits]
    );

    // plans and subscriptions
    await runStep(pool, "plans table", `
      CREATE TABLE IF NOT EXISTS plans (
        code text PRIMARY KEY,
        name text NOT NULL,
        description text,
        monthly_credits numeric(12,2) NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    await runStep(pool, "plan_features table", `
      CREATE TABLE IF NOT EXISTS plan_features (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_code text NOT NULL REFERENCES plans(code) ON DELETE CASCADE,
        feature_code text NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        limit_value numeric(12,2),
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        UNIQUE (plan_code, feature_code)
      );
    `);

    await runStep(pool, "user_subscriptions table", `
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        plan_code text NOT NULL REFERENCES plans(code),
        status text NOT NULL DEFAULT 'active',
        starts_at timestamp DEFAULT now(),
        ends_at timestamp,
        auto_renew boolean NOT NULL DEFAULT true,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    await runStep(pool, "brand_plan_overrides table", `
      CREATE TABLE IF NOT EXISTS brand_plan_overrides (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        brand_id uuid NOT NULL REFERENCES brand_profile(id) ON DELETE CASCADE,
        plan_code text NOT NULL REFERENCES plans(code),
        status text NOT NULL DEFAULT 'active',
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        UNIQUE (user_id, brand_id)
      );
    `);

    await runStep(pool, "plans seed", `
      INSERT INTO plans (code, name, description, monthly_credits, is_active, metadata)
      VALUES
        ('basic', 'Basic', 'Starter plan for single-brand monitoring', 300, true, '{}'::jsonb),
        ('pro', 'Pro', 'Growth plan for teams and multi-brand monitoring', 1200, true, '{}'::jsonb),
        ('business', 'Business', 'Advanced plan for whitelabel and high-volume usage', 5000, true, '{}'::jsonb)
      ON CONFLICT (code) DO UPDATE
      SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        monthly_credits = EXCLUDED.monthly_credits,
        is_active = true,
        updated_at = now();
    `);

    await runStep(pool, "plan_features seed", `
      INSERT INTO plan_features (plan_code, feature_code, enabled, limit_value, config)
      VALUES
        ('basic', 'brands.max', true, 1, '{}'::jsonb),
        ('pro', 'brands.max', true, 5, '{}'::jsonb),
        ('business', 'brands.max', true, 20, '{}'::jsonb),
        ('basic', 'seats.max', true, 1, '{}'::jsonb),
        ('pro', 'seats.max', true, 3, '{}'::jsonb),
        ('business', 'seats.max', true, 10, '{}'::jsonb),
        ('basic', 'api.analytics', true, null, '{}'::jsonb),
        ('pro', 'api.analytics', true, null, '{}'::jsonb),
        ('business', 'api.analytics', true, null, '{}'::jsonb)
      ON CONFLICT (plan_code, feature_code) DO UPDATE
      SET
        enabled = EXCLUDED.enabled,
        limit_value = EXCLUDED.limit_value,
        updated_at = now();
    `);

    await runStep(pool, "user_subscriptions backfill", `
      INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, auto_renew, metadata)
      SELECT
        CAST(u.id AS text),
        CASE
          WHEN LOWER(COALESCE(u.config->>'branding_mode', 'self')) IN ('white-label', 'whitelabel')
            THEN 'business'
          ELSE 'basic'
        END AS plan_code,
        'active',
        now(),
        true,
        '{}'::jsonb
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1
        FROM user_subscriptions s
        WHERE s.user_id = CAST(u.id AS text)
          AND s.status = 'active'
      );
    `);

    console.log("[DB Sync] Completed successfully.");
  } catch (error) {
    console.error("[DB Sync] Error:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
