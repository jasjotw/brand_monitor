import { InsufficientCreditsError, ExternalServiceError } from '../utils/errors';
import {
    CREDITS_PER_BACKLINK_COMPETITOR,
    CREDITS_PER_BRAND_ANALYSIS,
    CREDITS_PER_ICP_GENERATION,
    CREDITS_PER_PERSONAS_GENERATION,
    CREDITS_PER_PROMPT_GENERATED,
    CREDITS_PER_PROMPT_RUN,
    CREDITS_PER_SCRAPE,
} from '../config/constants';
import { env } from '../config/env';
import { pool } from '../db/client';

export interface CreditCheckResult {
    allowed: boolean;
    balance: number;
}

export type CreditFeatureCode =
    | 'prompt_generation'
    | 'prompt_run'
    | 'personas_generation'
    | 'icp_generation'
    | 'backlinks_competitor'
    | 'scrape';

interface TrackCreditsOptions {
    reason?: string;
    referenceType?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
}

interface ReserveCreditsResult {
    reservationId: string;
    amountReserved: number;
    remainingCredits: number;
}

interface FeatureChargeInput {
    userId: string;
    featureCode: CreditFeatureCode;
    quantity?: number;
    referenceType?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
    logTag?: string;
}

interface FeatureReserveInput extends FeatureChargeInput {}

interface FeatureCaptureInput {
    userId: string;
    reservationId: string;
    featureCode: CreditFeatureCode;
    quantity?: number;
    referenceType?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
    logTag?: string;
}

interface ReconcileReservationInput {
    userId: string;
    reservationId: string;
    logTag?: string;
    referenceType?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
    startedAt?: Date;
}

const DEFAULT_INITIAL_CREDITS = Number(env.INITIAL_FREE_CREDITS || 100);

const FEATURE_PRICING: Record<CreditFeatureCode, { mode: 'flat' | 'unit'; amount: number }> = {
    prompt_generation: { mode: 'unit', amount: CREDITS_PER_PROMPT_GENERATED },
    prompt_run: { mode: 'unit', amount: CREDITS_PER_PROMPT_RUN },
    personas_generation: { mode: 'flat', amount: CREDITS_PER_PERSONAS_GENERATION },
    icp_generation: { mode: 'flat', amount: CREDITS_PER_ICP_GENERATION },
    backlinks_competitor: { mode: 'unit', amount: CREDITS_PER_BACKLINK_COMPETITOR },
    scrape: { mode: 'flat', amount: CREDITS_PER_SCRAPE },
};

function roundCredits(value: number): number {
    return Math.round(value * 100) / 100;
}

function toPositiveQuantity(value: number | undefined): number {
    const parsed = Number(value ?? 1);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return parsed;
}

export function estimateFeatureCost(featureCode: CreditFeatureCode, quantity = 1): number {
    const pricing = FEATURE_PRICING[featureCode];
    const q = toPositiveQuantity(quantity);
    if (!pricing || q <= 0) return 0;
    if (pricing.mode === 'flat') return roundCredits(pricing.amount);
    return roundCredits(pricing.amount * q);
}

export function getFeatureUnitCost(featureCode: CreditFeatureCode): number {
    return FEATURE_PRICING[featureCode]?.amount ?? 0;
}

async function ensureWallet(customerId: string, client?: any): Promise<void> {
    const executor = client ?? pool;
    await executor.query(
        `
        INSERT INTO credit_wallets (user_id, balance, reserved_balance)
        VALUES ($1, $2::numeric, 0)
        ON CONFLICT (user_id) DO NOTHING
        `,
        [customerId, roundCredits(DEFAULT_INITIAL_CREDITS)],
    );
}

async function getBalance(customerId: string): Promise<number> {
    await ensureWallet(customerId);
    const result = await pool.query(
        `SELECT balance FROM credit_wallets WHERE user_id = $1 LIMIT 1`,
        [customerId],
    );
    return roundCredits(Number(result.rows[0]?.balance ?? 0));
}

export async function initializeCreditsForUser(customerId: string): Promise<void> {
    try {
        await ensureWallet(customerId);
        await pool.query(
            `
            INSERT INTO credit_ledger (user_id, delta, reason, reference_type, reference_id, metadata)
            SELECT $1, $2::numeric, 'signup_bonus', 'auth', $1, '{}'::jsonb
            WHERE NOT EXISTS (
              SELECT 1 FROM credit_ledger WHERE user_id = $1 AND reason = 'signup_bonus'
            )
            `,
            [customerId, roundCredits(DEFAULT_INITIAL_CREDITS)],
        );
    } catch (err) {
        console.error('[Credit] Failed to initialize wallet:', err);
        throw new ExternalServiceError('Unable to initialize user credits', 'credits_db');
    }
}

export async function checkCredits(
    customerId: string,
    required = 1,
    logTag = '[Credit]',
): Promise<CreditCheckResult> {
    try {
        const requiredRounded = roundCredits(required);
        const balance = await getBalance(customerId);
        const allowed = balance >= requiredRounded;

        if (!allowed) {
            console.log(`${logTag} Insufficient credits - Balance: ${balance}, Required: ${requiredRounded}`);
            throw new InsufficientCreditsError(
                `Insufficient credits. You need at least ${requiredRounded} credits.`,
                { required: requiredRounded, available: balance },
            );
        }

        return { allowed: true, balance };
    } catch (err) {
        if (err instanceof InsufficientCreditsError) throw err;
        console.error(`${logTag} Failed to check credits:`, err);
        throw new ExternalServiceError('Unable to verify credits. Please try again', 'credits_db');
    }
}

export async function reserveCredits(
    customerId: string,
    amount: number,
    logTag = '[Credit]',
    options: TrackCreditsOptions = {},
): Promise<ReserveCreditsResult> {
    const reserveAmount = roundCredits(amount);
    if (reserveAmount <= 0) {
        return {
            reservationId: '',
            amountReserved: 0,
            remainingCredits: await getBalance(customerId),
        };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await ensureWallet(customerId, client);

        const debit = await client.query(
            `
            UPDATE credit_wallets
            SET balance = balance - $2::numeric,
                reserved_balance = reserved_balance + $2::numeric,
                updated_at = now()
            WHERE user_id = $1
              AND balance >= $2::numeric
            RETURNING balance
            `,
            [customerId, reserveAmount],
        );

        if (debit.rowCount === 0) {
            const balanceRes = await client.query(
                `SELECT balance FROM credit_wallets WHERE user_id = $1 LIMIT 1`,
                [customerId],
            );
            const balance = roundCredits(Number(balanceRes.rows[0]?.balance ?? 0));
            throw new InsufficientCreditsError(
                `Insufficient credits. You need at least ${reserveAmount} credits.`,
                { required: reserveAmount, available: balance },
            );
        }

        const reservation = await client.query(
            `
            INSERT INTO credit_reservations (
                user_id,
                amount_total,
                amount_remaining,
                status,
                reason,
                reference_type,
                reference_id,
                metadata
            )
            VALUES ($1, $2::numeric, $2::numeric, 'reserved', $3, $4, $5, $6::jsonb)
            RETURNING id
            `,
            [
                customerId,
                reserveAmount,
                options.reason ?? 'usage_reserve',
                options.referenceType ?? 'feature',
                options.referenceId ?? 'brand-monitor',
                JSON.stringify(options.metadata ?? { amount: reserveAmount }),
            ],
        );

        await client.query(
            `
            INSERT INTO credit_ledger (user_id, delta, reason, reference_type, reference_id, metadata)
            VALUES ($1, $2::numeric, 'reserve', $3, $4, $5::jsonb)
            `,
            [
                customerId,
                -reserveAmount,
                options.referenceType ?? 'feature',
                reservation.rows[0].id,
                JSON.stringify(options.metadata ?? { amount: reserveAmount }),
            ],
        );

        await client.query('COMMIT');

        return {
            reservationId: String(reservation.rows[0].id),
            amountReserved: reserveAmount,
            remainingCredits: roundCredits(Number(debit.rows[0].balance ?? 0)),
        };
    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof InsufficientCreditsError) throw err;
        console.error(`${logTag} Failed to reserve credits:`, err);
        throw new ExternalServiceError('Unable to reserve credits. Please try again', 'credits_db');
    } finally {
        client.release();
    }
}

export async function captureReservedCredits(
    customerId: string,
    reservationId: string,
    amount: number,
    logTag = '[Credit]',
    options: TrackCreditsOptions = {},
): Promise<void> {
    const captureAmount = roundCredits(amount);
    if (!reservationId || captureAmount <= 0) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const reservationRes = await client.query(
            `
            SELECT amount_remaining
            FROM credit_reservations
            WHERE id = $1
              AND user_id = $2
              AND status IN ('reserved', 'partially_captured', 'partially_reversed')
            FOR UPDATE
            `,
            [reservationId, customerId],
        );

        if (reservationRes.rowCount === 0) {
            throw new ExternalServiceError('Credit reservation not found', 'credits_db');
        }

        const amountRemaining = roundCredits(Number(reservationRes.rows[0].amount_remaining ?? 0));
        if (amountRemaining < captureAmount) {
            throw new InsufficientCreditsError('Reserved credits are not enough for capture', {
                required: captureAmount,
                available: amountRemaining,
            });
        }

        await client.query(
            `
            UPDATE credit_wallets
            SET reserved_balance = reserved_balance - $2::numeric,
                updated_at = now()
            WHERE user_id = $1
            `,
            [customerId, captureAmount],
        );

        const nextRemaining = roundCredits(amountRemaining - captureAmount);
        const nextStatus = nextRemaining === 0 ? 'captured' : 'partially_captured';

        await client.query(
            `
            UPDATE credit_reservations
            SET amount_remaining = $2::numeric,
                status = $3,
                updated_at = now()
            WHERE id = $1
            `,
            [reservationId, nextRemaining, nextStatus],
        );

        await client.query(
            `
            INSERT INTO credit_ledger (user_id, delta, reason, reference_type, reference_id, metadata)
            VALUES ($1, 0::numeric, 'capture', $2, $3, $4::jsonb)
            `,
            [
                customerId,
                options.referenceType ?? 'feature',
                reservationId,
                JSON.stringify({ captureAmount, ...(options.metadata ?? {}) }),
            ],
        );

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof InsufficientCreditsError) throw err;
        console.error(`${logTag} Failed to capture reserved credits:`, err);
        throw new ExternalServiceError('Unable to capture reserved credits. Please try again', 'credits_db');
    } finally {
        client.release();
    }
}

export async function reverseReservedCredits(
    customerId: string,
    reservationId: string,
    amount?: number,
    logTag = '[Credit]',
    options: TrackCreditsOptions = {},
): Promise<void> {
    if (!reservationId) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const reservationRes = await client.query(
            `
            SELECT amount_remaining
            FROM credit_reservations
            WHERE id = $1
              AND user_id = $2
              AND status IN ('reserved', 'partially_captured', 'partially_reversed')
            FOR UPDATE
            `,
            [reservationId, customerId],
        );

        if (reservationRes.rowCount === 0) {
            await client.query('COMMIT');
            return;
        }

        const amountRemaining = roundCredits(Number(reservationRes.rows[0].amount_remaining ?? 0));
        const reverseAmount = roundCredits(typeof amount === 'number' ? amount : amountRemaining);
        if (reverseAmount <= 0) {
            await client.query('COMMIT');
            return;
        }
        if (reverseAmount > amountRemaining) {
            throw new InsufficientCreditsError('Reverse amount exceeds reserved credits', {
                required: reverseAmount,
                available: amountRemaining,
            });
        }

        await client.query(
            `
            UPDATE credit_wallets
            SET balance = balance + $2::numeric,
                reserved_balance = reserved_balance - $2::numeric,
                updated_at = now()
            WHERE user_id = $1
            `,
            [customerId, reverseAmount],
        );

        const nextRemaining = roundCredits(amountRemaining - reverseAmount);
        const nextStatus = nextRemaining === 0 ? 'reversed' : 'partially_reversed';

        await client.query(
            `
            UPDATE credit_reservations
            SET amount_remaining = $2::numeric,
                status = $3,
                updated_at = now()
            WHERE id = $1
            `,
            [reservationId, nextRemaining, nextStatus],
        );

        await client.query(
            `
            INSERT INTO credit_ledger (user_id, delta, reason, reference_type, reference_id, metadata)
            VALUES ($1, $2::numeric, 'reverse', $3, $4, $5::jsonb)
            `,
            [
                customerId,
                reverseAmount,
                options.referenceType ?? 'feature',
                reservationId,
                JSON.stringify({ reverseAmount, ...(options.metadata ?? {}) }),
            ],
        );

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof InsufficientCreditsError) throw err;
        console.error(`${logTag} Failed to reverse reserved credits:`, err);
        throw new ExternalServiceError('Unable to reverse reserved credits. Please try again', 'credits_db');
    } finally {
        client.release();
    }
}

export async function reconcileReservationAfterError(input: ReconcileReservationInput): Promise<'no-op' | 'reversed'> {
    const logTag = input.logTag ?? '[Credit]';
    if (!input.reservationId) return 'no-op';

    const client = await pool.connect();
    try {
        const startedAtIso = input.startedAt ? input.startedAt.toISOString() : null;
        const reservationRes = await client.query(
            `
            SELECT id, amount_remaining, status, updated_at
            FROM credit_reservations
            WHERE id = $1
              AND user_id = $2
            LIMIT 1
            `,
            [input.reservationId, input.userId],
        );

        if (reservationRes.rowCount === 0) {
            console.warn(`${logTag} Reconcile skipped: reservation not found (${input.reservationId})`);
            return 'no-op';
        }

        const reservation = reservationRes.rows[0];
        const amountRemaining = roundCredits(Number(reservation.amount_remaining ?? 0));
        const status = String(reservation.status ?? '');

        const ledgerRes = await client.query(
            `
            SELECT reason, created_at
            FROM credit_ledger
            WHERE user_id = $1
              AND reference_id = $2
              AND ($3::timestamp IS NULL OR created_at >= $3::timestamp)
            ORDER BY created_at DESC
            `,
            [input.userId, input.reservationId, startedAtIso],
        );

        const hasReverse = ledgerRes.rows.some((row) => String(row.reason) === 'reverse');
        if (hasReverse || status === 'reversed' || amountRemaining <= 0) {
            return 'no-op';
        }

        if (status === 'reserved' || status === 'partially_captured' || status === 'partially_reversed') {
            await reverseReservedCredits(
                input.userId,
                input.reservationId,
                amountRemaining,
                logTag,
                {
                    reason: 'reconcile_reverse',
                    referenceType: input.referenceType ?? 'feature',
                    referenceId: input.referenceId,
                    metadata: {
                        amountRemaining,
                        status,
                        startedAt: startedAtIso,
                        ...(input.metadata ?? {}),
                    },
                },
            );
            return 'reversed';
        }

        return 'no-op';
    } catch (err) {
        console.error(`${logTag} Failed to reconcile reservation (${input.reservationId}):`, err);
        throw new ExternalServiceError('Unable to reconcile credit reservation', 'credits_db');
    } finally {
        client.release();
    }
}

export async function trackCredits(
    customerId: string,
    count = CREDITS_PER_BRAND_ANALYSIS,
    logTag = '[Credit]',
    options: TrackCreditsOptions = {},
): Promise<void> {
    const debitAmount = roundCredits(count);
    if (debitAmount <= 0) return;
    const operationStartedAt = new Date();

    const reservation = await reserveCredits(customerId, debitAmount, logTag, {
        reason: options.reason ? `${options.reason}_reserve` : 'usage_reserve',
        referenceType: options.referenceType,
        referenceId: options.referenceId,
        metadata: options.metadata,
    });

    try {
        await captureReservedCredits(
            customerId,
            reservation.reservationId,
            debitAmount,
            logTag,
            {
                reason: options.reason ? `${options.reason}_capture` : 'usage_capture',
                referenceType: options.referenceType,
                referenceId: options.referenceId,
                metadata: options.metadata,
            },
        );
    } catch (err) {
        await reconcileReservationAfterError({
            userId: customerId,
            reservationId: reservation.reservationId,
            logTag,
            referenceType: options.referenceType,
            referenceId: options.referenceId,
            metadata: options.metadata,
            startedAt: operationStartedAt,
        }).catch((reverseErr) => {
            console.error(`${logTag} Failed to reconcile reservation after capture error:`, reverseErr);
        });
        if (err instanceof InsufficientCreditsError) throw err;
        console.error(`${logTag} Failed to track usage:`, err);
        throw new ExternalServiceError('Unable to process credit deduction. Please try again', 'credits_db');
    }
}

export async function chargeFeature(input: FeatureChargeInput): Promise<number> {
    const quantity = toPositiveQuantity(input.quantity);
    const amount = estimateFeatureCost(input.featureCode, quantity);
    if (amount <= 0) return 0;

    await trackCredits(input.userId, amount, input.logTag ?? '[Credit]', {
        reason: `feature_${input.featureCode}`,
        referenceType: input.referenceType ?? 'feature',
        referenceId: input.referenceId,
        metadata: {
            featureCode: input.featureCode,
            quantity,
            unitCost: getFeatureUnitCost(input.featureCode),
            amount,
            ...(input.metadata ?? {}),
        },
    });

    return amount;
}

export async function reserveFeatureCredits(input: FeatureReserveInput): Promise<ReserveCreditsResult> {
    const quantity = toPositiveQuantity(input.quantity);
    const amount = estimateFeatureCost(input.featureCode, quantity);
    return reserveCredits(input.userId, amount, input.logTag ?? '[Credit]', {
        reason: `feature_${input.featureCode}_reserve`,
        referenceType: input.referenceType ?? 'feature',
        referenceId: input.referenceId,
        metadata: {
            featureCode: input.featureCode,
            quantity,
            unitCost: getFeatureUnitCost(input.featureCode),
            amount,
            ...(input.metadata ?? {}),
        },
    });
}

export async function captureFeatureCredits(input: FeatureCaptureInput): Promise<void> {
    const quantity = toPositiveQuantity(input.quantity);
    const amount = estimateFeatureCost(input.featureCode, quantity);
    return captureReservedCredits(input.userId, input.reservationId, amount, input.logTag ?? '[Credit]', {
        reason: `feature_${input.featureCode}_capture`,
        referenceType: input.referenceType ?? 'feature',
        referenceId: input.referenceId,
        metadata: {
            featureCode: input.featureCode,
            quantity,
            unitCost: getFeatureUnitCost(input.featureCode),
            amount,
            ...(input.metadata ?? {}),
        },
    });
}

export async function reverseFeatureCredits(input: FeatureCaptureInput & { amount?: number }): Promise<void> {
    const quantity = toPositiveQuantity(input.quantity);
    const derivedAmount = estimateFeatureCost(input.featureCode, quantity);
    const amount = typeof input.amount === 'number' ? input.amount : derivedAmount;

    return reverseReservedCredits(input.userId, input.reservationId, amount, input.logTag ?? '[Credit]', {
        reason: `feature_${input.featureCode}_reverse`,
        referenceType: input.referenceType ?? 'feature',
        referenceId: input.referenceId,
        metadata: {
            featureCode: input.featureCode,
            quantity,
            unitCost: getFeatureUnitCost(input.featureCode),
            amount,
            ...(input.metadata ?? {}),
        },
    });
}

export async function getRemainingCredits(
    customerId: string,
    logTag = '[Credit]',
): Promise<number> {
    try {
        return await getBalance(customerId);
    } catch (err) {
        console.error(`${logTag} Failed to get remaining credits:`, err);
        return 0;
    }
}
