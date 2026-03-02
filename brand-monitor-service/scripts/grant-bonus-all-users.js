const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const BONUS_AMOUNT = 100;
const BONUS_REASON = "manual_bonus_100_2026_03_02";

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("[Bonus] DATABASE_URL missing in brand-monitor-service/.env");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Ensure wallet exists for every user
    await client.query(
      `
      INSERT INTO credit_wallets (user_id, balance, reserved_balance)
      SELECT CAST(id AS text), 0::numeric, 0::numeric
      FROM users
      ON CONFLICT (user_id) DO NOTHING;
      `
    );

    // Insert bonus ledger entries only once per user for this reason
    // and apply wallet credit only to users inserted in this run.
    const applyResult = await client.query(
      `
      WITH target_users AS (
        SELECT CAST(u.id AS text) AS user_id
        FROM users u
        WHERE NOT EXISTS (
          SELECT 1
          FROM credit_ledger l
          WHERE l.user_id = CAST(u.id AS text)
            AND l.reason = $1
        )
      ),
      inserted AS (
        INSERT INTO credit_ledger (user_id, delta, reason, reference_type, reference_id, metadata)
        SELECT
          t.user_id,
          $2::numeric,
          $1,
          'manual_bonus',
          t.user_id,
          jsonb_build_object('granted_at', now(), 'amount', $2)
        FROM target_users t
        RETURNING user_id
      )
      UPDATE credit_wallets w
      SET
        balance = w.balance + $2::numeric,
        updated_at = now()
      FROM inserted i
      WHERE w.user_id = i.user_id
      RETURNING w.user_id;
      `,
      [BONUS_REASON, BONUS_AMOUNT]
    );

    await client.query("COMMIT");
    console.log(`[Bonus] Granted +${BONUS_AMOUNT} credits to ${applyResult.rowCount} user(s).`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Bonus] Failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
