import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/auth';
import { AuthenticationError } from '../utils/errors';
import { verifyToken } from '../utils/jwt';

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

/**
 * Auth middleware supporting both JWT Bearer tokens and better-auth sessions.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const authHeader = req.headers['authorization'];
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            const payload = verifyToken(token);
            res.locals.user = {
                id: String(payload.userId),
                email: payload.email,
                name: null,
                image: null,
            };
            return next();
        }

        // Dev bypass (local testing only)
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
            return;
        }

        const message = err instanceof Error ? err.message : 'Authentication failed';
        const code = message.toLowerCase().includes('expired')
            ? 'TOKEN_EXPIRED'
            : 'UNAUTHORIZED';

        res.status(401).json({
            error: {
                message,
                code,
                statusCode: 401,
                timestamp: new Date().toISOString(),
            },
        });
    }
}

/**
 * Returns true if the authenticated user is a superuser.
 */
export function isSuperuser(email?: string | null): boolean {
    if (!email) return false;
    const superuserEmails = (process.env.SUPERUSER_EMAILS || '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
    return superuserEmails.includes(email);
}