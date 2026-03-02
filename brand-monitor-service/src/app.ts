// ─────────────────────────────────────────────────────────────
// src/app.ts
// The Express application factory.
// Separate from server.ts so the app object can be imported by
// tests without binding a port.
// ─────────────────────────────────────────────────────────────

import express, { Application, Request, Response } from 'express';
import cors from 'cors';

// Routes
import scrapeRoutes from './routes/scrape.routes';
import analyzeRoutes from './routes/analyze.routes';
import analysesRoutes from './routes/analyses.routes';
import authRoutes from './modules/auth/auth.routes';
import brandProfileRoutes from './routes/brand-profile.routes';
import audienceRoutes from './routes/audience.routes';
import analyticsRoutes from './routes/analytics.routes';
import backlinksRoutes from './routes/backlinks.routes';
import plansRoutes from './routes/plans.routes';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware';

// Error handler (must be registered LAST)
import { errorHandler } from './utils/errors';

// ── App Factory ───────────────────────────────────────────────

export function createApp(): Application {
    const app = express();

    // ── Trust proxy (required for correct IP detection behind Nginx / LB)
    app.set('trust proxy', 1);

    // ── CORS ─────────────────────────────────────────────────────
    const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

    app.use(
        cors({
            origin: (origin, callback) => {
                // Allow requests with no origin (curl, Postman, server-to-server)
                if (!origin) return callback(null, true);
                if (allowedOrigins.includes(origin)) return callback(null, true);
                callback(new Error(`Origin "${origin}" is not allowed by CORS`));
            },
            credentials: true, // allow cookies to be forwarded (better-auth sessions)
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
            exposedHeaders: ['Set-Cookie'],
        }),
    );

    // ── Body parsing ───────────────────────────────────────────
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(requestLoggerMiddleware);

    // ── Health check ───────────────────────────────────────────
    app.get('/health', (_req: Request, res: Response) => {
        res.json({
            status: 'ok',
            service: 'brand-monitor-service',
            timestamp: new Date().toISOString(),
            env: process.env.NODE_ENV || 'development',
        });
    });

    // ── API Routes ─────────────────────────────────────────────
    app.use('/api/auth', authRoutes);
    app.use('/auth', authRoutes);
    app.use('/api/brand-monitor/brand-profile', brandProfileRoutes);
    app.use('/api/brand-monitor/audience', audienceRoutes);
    app.use('/api/brand-monitor/scrape', scrapeRoutes);
    app.use('/api/brand-monitor/analyze', analyzeRoutes);
    app.use('/api/brand-monitor/analyses', analysesRoutes);
    app.use('/api/brand-monitor/analytics', analyticsRoutes);
    app.use('/api/brand-monitor/backlinks', backlinksRoutes);
    app.use('/api/brand-monitor/plans', plansRoutes);

    // ── 404 fallback ───────────────────────────────────────────
    app.use((_req: Request, res: Response) => {
        res.status(404).json({
            error: {
                message: 'Route not found',
                code: 'NOT_FOUND',
                statusCode: 404,
                timestamp: new Date().toISOString(),
            },
        });
    });

    // ── Global error handler (must be last) ───────────────────
    app.use(errorHandler);

    return app;
}
