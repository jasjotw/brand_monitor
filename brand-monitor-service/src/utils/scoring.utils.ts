// ─────────────────────────────────────────────────────────────
// src/utils/scoring.utils.ts
// Source: WebApp/lib/ai-utils.ts (lines 1180–1230) — calculateBrandScores()
// Computes the final visibility / sentiment / share-of-voice /
// overall score from the aggregated competitor rankings.
// ─────────────────────────────────────────────────────────────

import { AIResponse, CompetitorRanking } from '../types';

export interface BrandScores {
    visibilityScore: number;
    sentimentScore: number;
    shareOfVoice: number;
    overallScore: number;
    averagePosition: number;
}

const ZERO_SCORES: BrandScores = {
    visibilityScore: 0,
    sentimentScore: 0,
    shareOfVoice: 0,
    overallScore: 0,
    averagePosition: 0,
};

/**
 * Derives overall brand scores from AI responses + the competitor ranking
 * list (which already contains the brand's own entry with `isOwn: true`).
 *
 * Weights:
 *   visibilityScore × 0.3
 *   sentimentScore  × 0.2
 *   shareOfVoice    × 0.3
 *   positionScore   × 0.2
 */
export function calculateBrandScores(
    responses: AIResponse[],
    _brandName: string,
    competitors: CompetitorRanking[],
): BrandScores {
    if (responses.length === 0) return ZERO_SCORES;

    const brandRanking = competitors.find((c) => c.isOwn);
    if (!brandRanking) return ZERO_SCORES;

    const { visibilityScore, sentimentScore, shareOfVoice, averagePosition } = brandRanking;

    // Position score: lower position number = better (scale to 0–100)
    const positionScore =
        averagePosition <= 10
            ? (11 - averagePosition) * 10
            : Math.max(0, 100 - averagePosition * 2);

    const overallScore =
        visibilityScore * 0.3 +
        sentimentScore * 0.2 +
        shareOfVoice * 0.3 +
        positionScore * 0.2;

    return {
        visibilityScore: Math.round(visibilityScore * 10) / 10,
        sentimentScore: Math.round(sentimentScore * 10) / 10,
        shareOfVoice: Math.round(shareOfVoice * 10) / 10,
        overallScore: Math.round(overallScore * 10) / 10,
        averagePosition: Math.round(averagePosition * 10) / 10,
    };
}
