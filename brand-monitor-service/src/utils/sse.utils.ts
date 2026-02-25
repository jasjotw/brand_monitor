// ─────────────────────────────────────────────────────────────
// src/utils/sse.utils.ts
// Source: createSSEMessage() from WebApp/lib/analyze-common.ts (line 497)
// Formats SSE events into the exact wire format required by the
// text/event-stream protocol.
// ─────────────────────────────────────────────────────────────

import { Response } from 'express';
import { SSEEvent } from '../types';

/**
 * Formats an SSEEvent object into a spec-compliant SSE string.
 * Each event is separated by a blank line.
 */
export function createSSEMessage(event: SSEEvent): string {
    const lines: string[] = [];
    if (event.type) {
        lines.push(`event: ${event.type}`);
    }
    lines.push(`data: ${JSON.stringify(event)}`);
    lines.push(''); // end-of-event blank line
    lines.push(''); // extra newline for strict SSE compat
    return lines.join('\n');
}

/**
 * Sets the SSE response headers on an Express Response and flushes them.
 * Call this once at the start of a streaming endpoint handler.
 */
export function initSSEResponse(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();
}

/**
 * Writes a single SSE event to the response stream.
 * Safe to call multiple times; does not close the stream.
 */
export function sendSSEEvent(res: Response, event: SSEEvent): void {
    res.write(createSSEMessage(event));
}

/**
 * Closes the SSE stream by ending the response.
 */
export function closeSSEStream(res: Response): void {
    res.end();
}
