import { Request, Response } from 'express';
import { handleApiError } from '../utils/errors';
import {
    getRunsForAnalytics,
    buildOverviewAnalytics,
    buildVisibilityAnalytics,
    buildCompetitorAnalytics,
    buildPromptAnalytics,
    buildAlerts,
    buildSourceAttribution,
} from '../services/analytics.service';
import { buildDiagnosticsAnalytics } from '../services/diagnostics.service';
import { logMethodEntry } from '../utils/logger';

function readLimit(value: unknown): number | undefined {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.max(2, Math.min(200, parsed));
}

async function loadRuns(req: Request, res: Response): Promise<{ runs: any[]; resolvedBrandId?: string }> {
    const userId = String(res.locals.user.id);
    const brandId = typeof req.query.brandId === 'string' && req.query.brandId.trim()
        ? req.query.brandId.trim()
        : undefined;
    const limit = readLimit(req.query.limit);
    return getRunsForAnalytics({ userId, brandId, limit });
}

export async function overviewAnalyticsHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('analytics.overviewAnalyticsHandler');
        const { runs, resolvedBrandId } = await loadRuns(req, res);
        res.json({
            brandId: resolvedBrandId || null,
            ...buildOverviewAnalytics(runs as any),
        });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function visibilityAnalyticsHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('analytics.visibilityAnalyticsHandler');
        const { runs, resolvedBrandId } = await loadRuns(req, res);
        res.json({
            brandId: resolvedBrandId || null,
            ...buildVisibilityAnalytics(runs as any),
        });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function competitorsAnalyticsHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('analytics.competitorsAnalyticsHandler');
        const { runs, resolvedBrandId } = await loadRuns(req, res);
        res.json({
            brandId: resolvedBrandId || null,
            ...buildCompetitorAnalytics(runs as any),
        });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function promptsAnalyticsHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('analytics.promptsAnalyticsHandler');
        const { runs, resolvedBrandId } = await loadRuns(req, res);
        res.json({
            brandId: resolvedBrandId || null,
            ...buildPromptAnalytics(runs as any),
        });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function alertsAnalyticsHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('analytics.alertsAnalyticsHandler');
        const { runs, resolvedBrandId } = await loadRuns(req, res);
        res.json({
            brandId: resolvedBrandId || null,
            ...buildAlerts(runs as any),
        });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function sourcesAnalyticsHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('analytics.sourcesAnalyticsHandler');
        const { runs, resolvedBrandId } = await loadRuns(req, res);
        res.json({
            brandId: resolvedBrandId || null,
            ...buildSourceAttribution(runs as any),
        });
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function diagnosticsAnalyticsHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('analytics.diagnosticsAnalyticsHandler');
        const userId = String(res.locals.user.id);
        const brandId = typeof req.query.brandId === 'string' && req.query.brandId.trim()
            ? req.query.brandId.trim()
            : undefined;
        const diagnostics = await buildDiagnosticsAnalytics({ userId, brandId });
        res.json(diagnostics);
    } catch (error) {
        handleApiError(error, res);
    }
}

export async function dashboardAnalyticsHandler(req: Request, res: Response): Promise<void> {
    try {
        logMethodEntry('analytics.dashboardAnalyticsHandler');
        const { runs, resolvedBrandId } = await loadRuns(req, res);
        res.json({
            brandId: resolvedBrandId || null,
            overview: buildOverviewAnalytics(runs as any),
            visibility: buildVisibilityAnalytics(runs as any),
            competitors: buildCompetitorAnalytics(runs as any),
            prompts: buildPromptAnalytics(runs as any),
            sources: buildSourceAttribution(runs as any),
            alerts: buildAlerts(runs as any),
        });
    } catch (error) {
        handleApiError(error, res);
    }
}
