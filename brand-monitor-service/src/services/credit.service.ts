// ─────────────────────────────────────────────────────────────
// src/services/credit.service.ts
// Source: Inline Autumn SDK calls from:
//   - WebApp/app/api/brand-monitor/analyze/route.ts
//   - WebApp/app/api/brand-monitor/scrape/route.ts
//
// Centralises all credit-check / credit-deduction logic so
// the controllers stay thin.
// ─────────────────────────────────────────────────────────────

// autumn-js uses the non-standard package.json "exports" field
// which requires moduleResolution: bundler / node16 / nodenext.
// As a simpler alternative we import the built distribution directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Autumn } = require('autumn-js') as { Autumn: new (opts: { apiKey: string }) => any };

import {
    InsufficientCreditsError,
    ExternalServiceError,
} from '../utils/errors';
import {
    FEATURE_ID_MESSAGES,
    CREDITS_PER_BRAND_ANALYSIS,
} from '../config/constants';

// Lazy singleton — constructed on first use so that dotenv.config()
// in server.ts has already run before we read AUTUMN_SECRET_KEY.
let _autumn: any = null;
function getAutumnClient() {
    if (!_autumn) {
        const key = process.env.AUTUMN_SECRET_KEY;
        if (!key) throw new Error('AUTUMN_SECRET_KEY is not set in environment');
        _autumn = new Autumn({ apiKey: key });
    }
    return _autumn;
}


// ── Types ─────────────────────────────────────────────────────

export interface CreditCheckResult {
    allowed: boolean;
    balance: number;
}

// ── Core Helpers ─────────────────────────────────────────────

/**
 * Checks whether the user has access and a sufficient balance.
 * Throws InsufficientCreditsError or ExternalServiceError on failure.
 */
export async function checkCredits(
    customerId: string,
    required = 1,
    logTag = '[Credit]',
): Promise<CreditCheckResult> {
    // ── Dev bypass ────────────────────────────────────────────
    // Skip real credit check when running locally with the dev auth bypass.
    // Any user ID that isn't a real UUID (e.g. 'test-user-123') is treated
    // as having unlimited credits so Postman testing works without Autumn.
    if (process.env.NODE_ENV === 'development') {
        const looksLikeRealId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
        if (!looksLikeRealId) {
            console.log(`${logTag} DEV BYPASS — skipping credit check for test user: ${customerId}`);
            return { allowed: true, balance: 9999 };
        }
    }

    try {
        console.log(`${logTag} Checking access — Customer ID: ${customerId}`);
        const access = await getAutumnClient().check({
            customer_id: customerId,
            feature_id: FEATURE_ID_MESSAGES,
        });
        console.log(`${logTag} Access check result:`, JSON.stringify(access.data));

        const balance = access.data?.balance ?? 0;
        const allowed = !!access.data?.allowed;

        if (!allowed || balance < required) {
            console.log(`${logTag} Insufficient credits — Balance: ${balance}, Required: ${required}`);
            throw new InsufficientCreditsError(
                `Insufficient credits. You need at least ${required} credit${required !== 1 ? 's' : ''}.`,
                { required, available: balance },
            );
        }

        return { allowed, balance };
    } catch (err) {
        if (err instanceof InsufficientCreditsError) throw err;
        console.error(`${logTag} Failed to check access:`, err);
        throw new ExternalServiceError('Unable to verify credits. Please try again', 'autumn');
    }
}

/**
 * Deducts `count` credits from the user's account.
 * Throws ExternalServiceError if the Autumn call fails.
 */
export async function trackCredits(
    customerId: string,
    count = CREDITS_PER_BRAND_ANALYSIS,
    logTag = '[Credit]',
): Promise<void> {
    // ── Dev bypass ────────────────────────────────────────────
    if (process.env.NODE_ENV === 'development') {
        const looksLikeRealId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
        if (!looksLikeRealId) {
            console.log(`${logTag} DEV BYPASS — skipping credit track for test user: ${customerId}`);
            return;
        }
    }

    try {
        console.log(`${logTag} Recording usage — Customer ID: ${customerId}, Count: ${count}`);
        await getAutumnClient().track({
            customer_id: customerId,
            feature_id: FEATURE_ID_MESSAGES,
            count,
        });
        console.log(`${logTag} Usage recorded successfully`);
    } catch (err) {
        console.error(`${logTag} Failed to track usage:`, err);
        throw new ExternalServiceError('Unable to process credit deduction. Please try again', 'autumn');
    }
}

/**
 * Returns the current balance for a customer.
 * Returns 0 on error (non-fatal — used for informational purposes only).
 */
export async function getRemainingCredits(
    customerId: string,
    logTag = '[Credit]',
): Promise<number> {
    try {
        const usage = await getAutumnClient().check({
            customer_id: customerId,
            feature_id: FEATURE_ID_MESSAGES,
        });
        return usage.data?.balance ?? 0;
    } catch (err) {
        console.error(`${logTag} Failed to get remaining credits:`, err);
        return 0;
    }
}
