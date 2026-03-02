import { Request, Response } from 'express';
import { handleApiError } from '../utils/errors';
import { getCurrentBacklinks, getRefreshCompetitorCount, refreshCurrentBacklinks } from '../services/backlinks.service';
import { logMethodEntry } from '../utils/logger';
import { chargeFeature, checkCredits, estimateFeatureCost } from '../services/credit.service';
import { CREDITS_PER_BACKLINK_COMPETITOR } from '../config/constants';

function readBrandId(req: Request): string | undefined {
    const raw = req.query.brandId;
    if (typeof raw !== 'string') return undefined;
    const value = raw.trim();
    return value || undefined;
}

export async function currentBacklinksHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('backlinks.currentBacklinksHandler');
        const userId = String(res.locals.user.id);
        const data = await getCurrentBacklinks({
            userId,
            brandId: readBrandId(req),
        });
        res.json(data);
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function refreshBacklinksHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('backlinks.refreshBacklinksHandler');
        const userId = String(res.locals.user.id);
        const brandId = readBrandId(req);
        const competitorCount = await getRefreshCompetitorCount({ userId, brandId });
        const requiredCredits = estimateFeatureCost('backlinks_competitor', competitorCount);
        if (requiredCredits > 0) {
            await checkCredits(userId, requiredCredits, '[Backlinks]');
        }
        const data = await refreshCurrentBacklinks({
            userId,
            brandId,
        });
        if (requiredCredits > 0 && data.source === 'fetched') {
            await chargeFeature({
                userId,
                featureCode: 'backlinks_competitor',
                quantity: competitorCount,
                referenceType: 'backlinks',
                referenceId: data.brandId ?? undefined,
                metadata: { competitorCount, perCompetitorCost: CREDITS_PER_BACKLINK_COMPETITOR },
                logTag: '[Backlinks]',
            });
        }
        res.json(data);
    } catch (error) {
        handleApiError(error, res);
    }
}
