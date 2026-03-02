import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logInfo } from '../utils/logger';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const requestId = req.headers['x-request-id']?.toString() || randomUUID();
    res.setHeader('x-request-id', requestId);

    const reqMeta = {
        requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
    };

    logInfo('REQUEST_START', reqMeta);

    res.on('finish', () => {
        const durationMs = Date.now() - start;
        const userId = (res.locals as any)?.user?.id;
        logInfo('REQUEST_END', {
            ...reqMeta,
            statusCode: res.statusCode,
            durationMs,
            userId: userId ?? null,
        });
    });

    next();
}

