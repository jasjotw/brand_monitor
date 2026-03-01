import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export function jwtAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authorization header missing or malformed' });
        return;
    }

    const token = authHeader.slice(7);

    try {
        const payload = verifyToken(token);
        req.user = payload;
        next();
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid or expired token';
        const code = message.toLowerCase().includes('expired')
            ? 'TOKEN_EXPIRED'
            : 'UNAUTHORIZED';
        res.status(401).json({ error: message, code });
    }
}
