import { Request, Response } from 'express';
import { handleApiError } from '../utils/errors';
import { getCurrentBacklinks, refreshCurrentBacklinks } from '../services/backlinks.service';

function readBrandId(req: Request): string | undefined {
    const raw = req.query.brandId;
    if (typeof raw !== 'string') return undefined;
    const value = raw.trim();
    return value || undefined;
}

export async function currentBacklinksHandler(req: Request, res: Response): Promise<void> {
    try {
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
        const userId = String(res.locals.user.id);
        const data = await refreshCurrentBacklinks({
            userId,
            brandId: readBrandId(req),
        });
        res.json(data);
    } catch (error) {
        handleApiError(error, res);
    }
}
