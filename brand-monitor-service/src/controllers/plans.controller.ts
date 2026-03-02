import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError, ErrorCode, handleApiError } from '../utils/errors';
import { logMethodEntry } from '../utils/logger';
import { getCurrentPlanAnalytics, getPlanCatalog, selectUserPlan } from '../services/plan-analytics.service';

const selectPlanSchema = z.object({
    planCode: z.enum(['basic', 'pro', 'business']),
});

export async function getCurrentPlanHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('plans.getCurrentPlanHandler');
        const userId = String(res.locals.user?.id ?? '');
        if (!userId) {
            throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }

        const payload = await getCurrentPlanAnalytics(userId);
        res.json(payload);
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function getPlanCatalogHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('plans.getPlanCatalogHandler');
        const userId = String(res.locals.user?.id ?? '');
        if (!userId) {
            throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }

        const plans = await getPlanCatalog();
        res.json({ plans });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function selectPlanHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('plans.selectPlanHandler');
        const userId = String(res.locals.user?.id ?? '');
        if (!userId) {
            throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }

        const { planCode } = selectPlanSchema.parse(req.body ?? {});
        const payload = await selectUserPlan(userId, planCode);
        res.json(payload);
    } catch (error) {
        handleApiError(error, res);
    }
}
