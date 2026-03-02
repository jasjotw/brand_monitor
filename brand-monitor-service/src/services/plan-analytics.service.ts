import { pool } from '../db/client';
import { ensureUserSubscription, getUserActivePlanCode } from './plan.service';

export type SelectablePlanCode = 'basic' | 'pro' | 'business';

interface PlanSummary {
    code: string;
    name: string;
    monthlyNeurons: number;
}

interface UsageSummary {
    neuronsRemaining: number;
    brandsTracked: number;
    analysesThisMonth: number;
    promptsRunThisMonth: number;
}

interface LimitsSummary {
    maxBrands: number | null;
    maxSeats: number | null;
}

export interface CurrentPlanAnalytics {
    plan: PlanSummary;
    usage: UsageSummary;
    limits: LimitsSummary;
    features: Record<string, { enabled: boolean; limitValue: number | null }>;
}

export interface PlanCatalogItem {
    code: string;
    name: string;
    description: string;
    monthlyNeurons: number;
    features: Record<string, { enabled: boolean; limitValue: number | null }>;
}

function toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export async function getCurrentPlanAnalytics(userId: string): Promise<CurrentPlanAnalytics> {
    await ensureUserSubscription(userId, 'basic', '[Plan Analytics]');

    const planCode = (await getUserActivePlanCode(userId)) || 'basic';

    const [planRes, featureRes, walletRes, brandsRes, analysesRes, promptRunsRes] = await Promise.all([
        pool.query(
            `
            SELECT code, name, monthly_credits
            FROM plans
            WHERE code = $1
            LIMIT 1
            `,
            [planCode],
        ),
        pool.query(
            `
            SELECT feature_code, enabled, limit_value
            FROM plan_features
            WHERE plan_code = $1
            `,
            [planCode],
        ),
        pool.query(
            `
            SELECT balance
            FROM credit_wallets
            WHERE user_id = $1
            LIMIT 1
            `,
            [userId],
        ),
        pool.query(
            `
            SELECT COUNT(*)::int AS count
            FROM brand_profile
            WHERE user_id = $1
            `,
            [userId],
        ),
        pool.query(
            `
            SELECT COUNT(*)::int AS count
            FROM brand_analyses
            WHERE user_id = $1
              AND created_at >= date_trunc('month', now())
            `,
            [userId],
        ),
        pool.query(
            `
            SELECT COALESCE(SUM((metadata->>'quantity')::numeric), 0) AS total
            FROM credit_ledger
            WHERE user_id = $1
              AND reason = 'capture'
              AND metadata->>'featureCode' = 'prompt_run'
              AND created_at >= date_trunc('month', now())
            `,
            [userId],
        ),
    ]);

    const planRow = planRes.rows[0] || { code: planCode, name: planCode, monthly_credits: 0 };
    const features: Record<string, { enabled: boolean; limitValue: number | null }> = {};
    featureRes.rows.forEach((row) => {
        features[String(row.feature_code)] = {
            enabled: row.enabled === true || row.enabled === 'true',
            limitValue: toNumberOrNull(row.limit_value),
        };
    });

    return {
        plan: {
            code: String(planRow.code),
            name: String(planRow.name),
            monthlyNeurons: toNumber(planRow.monthly_credits),
        },
        usage: {
            neuronsRemaining: toNumber(walletRes.rows[0]?.balance ?? 0),
            brandsTracked: toNumber(brandsRes.rows[0]?.count ?? 0),
            analysesThisMonth: toNumber(analysesRes.rows[0]?.count ?? 0),
            promptsRunThisMonth: toNumber(promptRunsRes.rows[0]?.total ?? 0),
        },
        limits: {
            maxBrands: features['brands.max']?.limitValue ?? null,
            maxSeats: features['seats.max']?.limitValue ?? null,
        },
        features,
    };
}

export async function selectUserPlan(userId: string, planCode: SelectablePlanCode): Promise<CurrentPlanAnalytics> {
    const exists = await pool.query(
        `
        SELECT code
        FROM plans
        WHERE code = $1
          AND is_active = true
        LIMIT 1
        `,
        [planCode],
    );

    if (exists.rowCount === 0) {
        throw new Error('Requested plan is not available');
    }

    await ensureUserSubscription(userId, 'basic', '[Plan Select]');

    const updated = await pool.query(
        `
        UPDATE user_subscriptions
        SET plan_code = $2,
            updated_at = now()
        WHERE user_id = $1
          AND status = 'active'
        `,
        [userId, planCode],
    );

    if (updated.rowCount === 0) {
        await pool.query(
            `
            INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, auto_renew, metadata)
            VALUES ($1, $2, 'active', now(), true, '{}'::jsonb)
            `,
            [userId, planCode],
        );
    }

    return getCurrentPlanAnalytics(userId);
}

export async function getPlanCatalog(): Promise<PlanCatalogItem[]> {
    const plansRes = await pool.query(
        `
        SELECT code, name, description, monthly_credits
        FROM plans
        WHERE is_active = true
        ORDER BY CASE code WHEN 'basic' THEN 1 WHEN 'pro' THEN 2 WHEN 'business' THEN 3 ELSE 99 END, code
        `,
    );

    const featuresRes = await pool.query(
        `
        SELECT plan_code, feature_code, enabled, limit_value
        FROM plan_features
        `,
    );

    const featureMap = new Map<string, Record<string, { enabled: boolean; limitValue: number | null }>>();
    featuresRes.rows.forEach((row) => {
        const key = String(row.plan_code);
        const existing = featureMap.get(key) || {};
        existing[String(row.feature_code)] = {
            enabled: row.enabled === true || row.enabled === 'true',
            limitValue: toNumberOrNull(row.limit_value),
        };
        featureMap.set(key, existing);
    });

    return plansRes.rows.map((row) => ({
        code: String(row.code),
        name: String(row.name),
        description: String(row.description ?? ''),
        monthlyNeurons: toNumber(row.monthly_credits),
        features: featureMap.get(String(row.code)) || {},
    }));
}
