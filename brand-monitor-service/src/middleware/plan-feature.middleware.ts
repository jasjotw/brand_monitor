import { NextFunction, Request, Response } from 'express';
import { ApiError, ErrorCode } from '../utils/errors';
import { getUserFeatureAccess } from '../services/plan.service';

export function requirePlanFeature(featureCode: string) {
    return async function planFeatureGuard(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = String(res.locals.user?.id ?? '');
            if (!userId) {
                throw new ApiError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
            }

            const access = await getUserFeatureAccess(userId, featureCode, '[Plan Feature]');
            if (!access.enabled) {
                throw new ApiError(
                    `Feature "${featureCode}" is not available on your ${access.planCode} plan.`,
                    403,
                    ErrorCode.FORBIDDEN,
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

