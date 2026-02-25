// ─────────────────────────────────────────────────────────────
// src/utils/sentiment.utils.ts
// Source: WebApp/lib/ai-utils.ts (lines 1161–1178)
//   - calculateSentimentScore()   (was private, exported here)
//   - determineSentiment()        (was private, exported here)
// These were originally private helpers inside ai-utils.ts.
// Extracted so scoring.utils.ts and competitor.service.ts can
// share them without circular imports.
// ─────────────────────────────────────────────────────────────

type Sentiment = 'positive' | 'neutral' | 'negative';

/**
 * Converts an array of sentiment labels to a 0–100 score.
 *   positive = 100, neutral = 50, negative = 0
 * Returns 50 for an empty array.
 */
export function calculateSentimentScore(sentiments: Sentiment[]): number {
    if (sentiments.length === 0) return 50;

    const sentimentValues: Record<Sentiment, number> = { positive: 100, neutral: 50, negative: 0 };
    const sum = sentiments.reduce((acc, s) => acc + sentimentValues[s], 0);
    return Math.round(sum / sentiments.length);
}

/**
 * Returns the dominant sentiment label from an array.
 * Falls back to 'neutral' when tied or empty.
 */
export function determineSentiment(sentiments: Sentiment[]): Sentiment {
    if (sentiments.length === 0) return 'neutral';

    const counts: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
    sentiments.forEach((s) => counts[s]++);

    if (counts.positive > counts.negative && counts.positive > counts.neutral) return 'positive';
    if (counts.negative > counts.positive && counts.negative > counts.neutral) return 'negative';
    return 'neutral';
}
