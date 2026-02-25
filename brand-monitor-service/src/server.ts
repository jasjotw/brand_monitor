// ─────────────────────────────────────────────────────────────
// src/server.ts
// Entry point — loads env vars, validates config, starts the
// Express server, and sets up graceful shutdown.
// ─────────────────────────────────────────────────────────────

import * as dotenv from 'dotenv';
dotenv.config(); // load .env before anything else

import { createApp } from './app';
// Importing env ensures required vars are validated and throws on startup if missing
import { env } from './config/env';
import { testConnection } from './db/utils';
import http from 'http';

// ── Bootstrap ─────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
    // 1. Verify database is reachable (retry up to 5x — Neon cold-starts can timeout)
    let dbOk = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
        dbOk = await testConnection();
        if (dbOk) break;
        if (attempt < 5) {
            console.log(`[Server] DB not ready (attempt ${attempt}/5), retrying in 3s...`);
            await new Promise((r) => setTimeout(r, 3000));
        }
    }
    if (!dbOk) {
        // Warn but don't abort — Neon may just be slow to wake up.
        // Each request has its own retry logic via withRetry().
        console.warn('[Server] ⚠️  DB startup check failed — starting anyway. Requests will retry on first use.');
    }

    // 2. Create Express app
    const app = createApp();
    const PORT = Number(env.PORT || 4001);

    // 3. Create HTTP server (needed for graceful shutdown)
    const server = http.createServer(app);

    server.listen(PORT, () => {
        console.log(`\n✅  brand-monitor-service running on port ${PORT}`);
        console.log(`   Health: http://localhost:${PORT}/health`);
        console.log(`   Env:    ${process.env.NODE_ENV || 'development'}\n`);
    });

    // ── Graceful Shutdown ──────────────────────────────────────
    let shutdownCalled = false;

    const shutdown = (signal: string) => {
        if (shutdownCalled) return;
        shutdownCalled = true;

        console.log(`\n[Server] Received ${signal}. Graceful shutdown...`);

        server.close((err) => {
            if (err) {
                console.error('[Server] Error during shutdown:', err);
                process.exit(1);
            }
            console.log('[Server] HTTP server closed. Exiting.');
            process.exit(0);
        });

        // Force-kill after 10 seconds if server hasn't closed
        setTimeout(() => {
            console.error('[Server] Graceful shutdown timed out. Force-exiting.');
            process.exit(1);
        }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Catch unhandled promise rejections so the process doesn't silently dies
    process.on('unhandledRejection', (reason) => {
        console.error('[Server] Unhandled rejection:', reason);
    });
}

bootstrap().catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
});
