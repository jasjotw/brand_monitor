// ─────────────────────────────────────────────────────────────
// src/middleware/auth.middleware.ts
// Source: auth.api.getSession() calls in all Next.js route handlers
//
// Validates the better-auth session cookie and attaches the user
// to res.locals.user so downstream controllers can access it.
// ─────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/auth';
import { AuthenticationError } from '../utils/errors';

// ── Extended locals ─────────────────────────────────────────

declare global {
    namespace Express {
        interface Locals {
            user: {
                id: string;
                email?: string | null;
                name?: string | null;
                image?: string | null;
            };
        }
    }
}

// ── Middleware ───────────────────────────────────────────────

/**
 * Validates the session attached to the incoming request.
 * Attaches `res.locals.user` on success.
 * Returns 401 on failure.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // ── Dev bypass (local Postman testing only) ───────────
        // Send header  X-Dev-User-Id: test-user-id  to skip real auth.
        // NEVER active in production (NODE_ENV !== 'development').
        if (process.env.NODE_ENV === 'development') {
            const devUserId = req.headers['x-dev-user-id'] as string | undefined;
            if (devUserId) {
                res.locals.user = {
                    id: devUserId,
                    email: process.env.SUPERUSER_EMAILS?.split(',')[0]?.trim() || 'dev@local.test',
                    name: 'Dev User',
                    image: null,
                };
                return next();
            }
        }

        // better-auth reads cookies / Authorization header from the raw request headers
        const sessionResponse = await auth.api.getSession({
            headers: req.headers as any,
        });

        if (!sessionResponse?.user) {
            throw new AuthenticationError('Please log in to use this feature');
        }

        res.locals.user = sessionResponse.user as any;
        next();
    } catch (err) {
        if (err instanceof AuthenticationError) {
            res.status(401).json({
                error: {
                    message: err.message,
                    code: err.code,
                    statusCode: 401,
                    timestamp: new Date().toISOString(),
                },
            });
        } else {
            console.error('[Auth Middleware]', err);
            res.status(401).json({
                error: {
                    message: 'Authentication failed',
                    code: 'UNAUTHORIZED',
                    statusCode: 401,
                    timestamp: new Date().toISOString(),
                },
            });
        }
    }
}


// ── Helpers ──────────────────────────────────────────────────

/**
 * Returns true if the authenticated user is a superuser.
 * Superuser emails are comma-separated in SUPERUSER_EMAILS env var.
 */
export function isSuperuser(email?: string | null): boolean {
    if (!email) return false;
    const superuserEmails = (process.env.SUPERUSER_EMAILS || '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
    return superuserEmails.includes(email);
}
