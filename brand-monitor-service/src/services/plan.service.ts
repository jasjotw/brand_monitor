import { pool } from '../db/client';

export type PlanCode = 'basic' | 'pro' | 'business';

const DEFAULT_PLAN_CODE: PlanCode = 'basic';

const PLAN_DEFINITIONS: Array<{
    code: PlanCode;
    name: string;
    description: string;
    monthlyCredits: number;
}> = [
    {
        code: 'basic',
        name: 'Basic',
        description: 'Starter plan for single-brand monitoring',
        monthlyCredits: 300,
    },
    {
        code: 'pro',
        name: 'Pro',
        description: 'Growth plan for teams and multi-brand monitoring',
        monthlyCredits: 1200,
    },
    {
        code: 'business',
        name: 'Business',
        description: 'Advanced plan for whitelabel and high-volume usage',
        monthlyCredits: 5000,
    },
];

const PLAN_FEATURES: Array<{
    planCode: PlanCode;
    featureCode: string;
    enabled: boolean;
    limitValue: number | null;
}> = [
    // brand limit
    { planCode: 'basic', featureCode: 'brands.max', enabled: true, limitValue: 1 },
    { planCode: 'pro', featureCode: 'brands.max', enabled: true, limitValue: 5 },
    { planCode: 'business', featureCode: 'brands.max', enabled: true, limitValue: 20 },
    // seats
    { planCode: 'basic', featureCode: 'seats.max', enabled: true, limitValue: 1 },
    { planCode: 'pro', featureCode: 'seats.max', enabled: true, limitValue: 3 },
    { planCode: 'business', featureCode: 'seats.max', enabled: true, limitValue: 10 },
    // api access
    { planCode: 'basic', featureCode: 'api.analytics', enabled: true, limitValue: null },
    { planCode: 'pro', featureCode: 'api.analytics', enabled: true, limitValue: null },
    { planCode: 'business', featureCode: 'api.analytics', enabled: true, limitValue: null },
];

export interface UserFeatureAccess {
    planCode: string;
    enabled: boolean;
    limitValue: number | null;
}

export async function ensurePlanCatalog(logTag = '[Plan]'): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const plan of PLAN_DEFINITIONS) {
            await client.query(
                `
                INSERT INTO plans (code, name, description, monthly_credits, is_active, metadata)
                VALUES ($1, $2, $3, $4::numeric, true, '{}'::jsonb)
                ON CONFLICT (code)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    monthly_credits = EXCLUDED.monthly_credits,
                    is_active = true,
                    updated_at = now()
                `,
                [plan.code, plan.name, plan.description, plan.monthlyCredits],
            );
        }

        for (const feature of PLAN_FEATURES) {
            await client.query(
                `
                INSERT INTO plan_features (plan_code, feature_code, enabled, limit_value, config)
                VALUES ($1, $2, $3, $4::numeric, '{}'::jsonb)
                ON CONFLICT (plan_code, feature_code)
                DO UPDATE SET
                    enabled = EXCLUDED.enabled,
                    limit_value = EXCLUDED.limit_value,
                    updated_at = now()
                `,
                [feature.planCode, feature.featureCode, feature.enabled, feature.limitValue],
            );
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`${logTag} Failed to ensure plan catalog:`, error);
        throw error;
    } finally {
        client.release();
    }
}

export async function ensureUserSubscription(
    userId: string,
    preferredPlanCode: PlanCode = DEFAULT_PLAN_CODE,
    logTag = '[Plan]',
): Promise<void> {
    await ensurePlanCatalog(logTag);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const existing = await client.query(
            `
            SELECT id
            FROM user_subscriptions
            WHERE user_id = $1
              AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [userId],
        );

        if (existing.rows.length === 0) {
            await client.query(
                `
                INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, auto_renew, metadata)
                VALUES ($1, $2, 'active', now(), true, '{}'::jsonb)
                `,
                [userId, preferredPlanCode],
            );
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`${logTag} Failed to ensure user subscription:`, error);
        throw error;
    } finally {
        client.release();
    }
}

export async function getUserActivePlanCode(userId: string): Promise<string | null> {
    const result = await pool.query(
        `
        SELECT plan_code
        FROM user_subscriptions
        WHERE user_id = $1
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [userId],
    );
    return result.rows[0]?.plan_code ?? null;
}

export async function getUserFeatureAccess(
    userId: string,
    featureCode: string,
    logTag = '[Plan]',
): Promise<UserFeatureAccess> {
    await ensureUserSubscription(userId, DEFAULT_PLAN_CODE, logTag);
    const result = await pool.query(
        `
        SELECT
          s.plan_code,
          COALESCE(f.enabled, false) AS enabled,
          f.limit_value
        FROM user_subscriptions s
        LEFT JOIN plan_features f
          ON f.plan_code = s.plan_code
         AND f.feature_code = $2
        WHERE s.user_id = $1
          AND s.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 1
        `,
        [userId, featureCode],
    );

    const row = result.rows[0];
    const limitRaw = row?.limit_value;
    const limitValue =
        limitRaw === null || limitRaw === undefined || limitRaw === ''
            ? null
            : Number(limitRaw);

    return {
        planCode: row?.plan_code ?? DEFAULT_PLAN_CODE,
        enabled: row?.enabled === true || row?.enabled === 'true',
        limitValue: Number.isFinite(limitValue as number) ? limitValue : null,
    };
}
