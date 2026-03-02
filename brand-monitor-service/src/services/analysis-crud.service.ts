// ─────────────────────────────────────────────────────────────
// src/services/analysis-crud.service.ts
// Source: Both analyses route handlers
//   - WebApp/app/api/brand-monitor/analyses/route.ts          (GET + POST)
//   - WebApp/app/api/brand-monitor/analyses/[analysisId]/route.ts (GET + DELETE)
//
// All CRUD operations on the `brandAnalyses` table.
// ─────────────────────────────────────────────────────────────

import { db } from '../db/client';
import { brandAnalyses } from '../db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { executeWithRetry } from '../db/utils';
import { NotFoundError } from '../utils/errors';

export type BrandAnalysisRow = typeof brandAnalyses.$inferSelect;

// ── List ──────────────────────────────────────────────────────

/**
 * Returns all analyses for a user (or all analyses for a superuser).
 */
export async function listAnalyses(
    userId: string,
    isSuperuser: boolean,
): Promise<BrandAnalysisRow[]> {
    return executeWithRetry(() =>
        db.query.brandAnalyses.findMany({
            where: isSuperuser ? undefined : eq(brandAnalyses.userId, userId),
            orderBy: desc(brandAnalyses.createdAt),
        }),
    );
}

// ── Get by ID ─────────────────────────────────────────────────

/**
 * Returns a single analysis by ID.
 * Superusers can access any analysis; regular users only their own.
 * Throws NotFoundError if not found.
 */
export async function getAnalysisById(
    analysisId: string,
    userId: string,
    isSuperuser: boolean,
): Promise<BrandAnalysisRow> {
    const analysis = await db.query.brandAnalyses.findFirst({
        where: isSuperuser
            ? eq(brandAnalyses.id, analysisId)
            : and(eq(brandAnalyses.id, analysisId), eq(brandAnalyses.userId, userId)),
    });

    if (!analysis) throw new NotFoundError('Analysis not found');
    return analysis;
}

// ── Create ────────────────────────────────────────────────────

export interface CreateAnalysisInput {
    userId: string;
    url: string;
    companyName?: string;
    industry?: string;
    analysisData: unknown;
    draftPrompts?: unknown;
    competitors?: unknown;
    prompts?: unknown;
    creditsUsed?: number;
    brandId?: string;
}

export interface UpdateAnalysisInput {
    analysisId: string;
    userId: string;
    analysisData?: unknown;
    draftPrompts?: unknown;
    competitors?: unknown;
    prompts?: unknown;
    companyName?: string;
    industry?: string;
    creditsUsed?: number;
}

/**
 * Inserts a new analysis and returns the inserted row.
 * Normalises the favicon field to match the logo when different.
 */
export async function createAnalysis(input: CreateAnalysisInput): Promise<BrandAnalysisRow> {
    // Normalise favicon to match logo when both are present
    try {
        const data = input.analysisData as any;
        if (data?.company) {
            const { logo, favicon } = data.company;
            if (logo && (!favicon || favicon !== logo)) {
                data.company.favicon = logo;
            }
        }
    } catch {
        console.warn('[Analysis CRUD] Could not normalize favicon field');
    }

    const rows = await executeWithRetry(() =>
        db
            .insert(brandAnalyses)
                .values({
                    userId: input.userId,
                    brandId: input.brandId,
                    url: input.url,
                companyName: input.companyName,
                industry: input.industry,
                analysisData: input.analysisData,
                draftPrompts: input.draftPrompts,
                competitors: input.competitors,
                prompts: input.prompts,
                creditsUsed:
                    typeof input.creditsUsed === 'number'
                        ? input.creditsUsed.toFixed(2)
                        : '10.00',
            })
            .returning(),
    ) as BrandAnalysisRow[];

    return rows[0];
}

/**
 * Updates an existing analysis owned by userId and returns the updated row.
 * Throws NotFoundError if the row doesn't exist or doesn't belong to the user.
 */
export async function updateAnalysis(input: UpdateAnalysisInput): Promise<BrandAnalysisRow> {
    const rows = await executeWithRetry(() =>
        db
            .update(brandAnalyses)
            .set({
                analysisData: input.analysisData,
                draftPrompts: input.draftPrompts,
                competitors: input.competitors,
                prompts: input.prompts,
                companyName: input.companyName,
                industry: input.industry,
                creditsUsed:
                    typeof input.creditsUsed === 'number'
                        ? input.creditsUsed.toFixed(2)
                        : undefined,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(brandAnalyses.id, input.analysisId),
                    eq(brandAnalyses.userId, input.userId),
                ),
            )
            .returning(),
    ) as BrandAnalysisRow[];

    if (rows.length === 0) throw new NotFoundError('Analysis not found');
    return rows[0];
}

// ── Delete ────────────────────────────────────────────────────

/**
 * Deletes an analysis owned by userId.
 * Throws NotFoundError if the row doesn't exist or doesn't belong to the user.
 */
export async function deleteAnalysis(analysisId: string, userId: string): Promise<void> {
    const result = await db
        .delete(brandAnalyses)
        .where(and(eq(brandAnalyses.id, analysisId), eq(brandAnalyses.userId, userId)))
        .returning();

    if (result.length === 0) throw new NotFoundError('Analysis not found');
}
