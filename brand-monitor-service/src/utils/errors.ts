// ─────────────────────────────────────────────────────────────
// src/utils/errors.ts
// Source: WebApp/lib/api-errors.ts
// Re-implemented without Next.js NextResponse — uses plain Express
// Response objects instead.
// ─────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';

// ── Error Codes ───────────────────────────────────────────────

export enum ErrorCode {
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    INVALID_TOKEN = 'INVALID_TOKEN',
    SESSION_EXPIRED = 'SESSION_EXPIRED',

    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INVALID_INPUT = 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

    NOT_FOUND = 'NOT_FOUND',
    ALREADY_EXISTS = 'ALREADY_EXISTS',

    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',

    EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
    AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',

    DATABASE_ERROR = 'DATABASE_ERROR',
    CONNECTION_ERROR = 'CONNECTION_ERROR',

    INTERNAL_ERROR = 'INTERNAL_ERROR',
    BAD_REQUEST = 'BAD_REQUEST',
}

// ── Base Error Class ──────────────────────────────────────────

export class ApiError extends Error {
    public readonly statusCode: number;
    public readonly code: ErrorCode;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, code: ErrorCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

// ── Specific Error Classes ─────────────────────────────────────

export class AuthenticationError extends ApiError {
    constructor(message = 'Authentication required', code = ErrorCode.UNAUTHORIZED) {
        super(message, 401, code);
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}

export class ValidationError extends ApiError {
    public readonly fields?: Record<string, string>;
    constructor(message = 'Validation failed', fields?: Record<string, string>, code = ErrorCode.VALIDATION_ERROR) {
        super(message, 400, code);
        this.fields = fields;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

export class NotFoundError extends ApiError {
    constructor(resource = 'Resource', code = ErrorCode.NOT_FOUND) {
        super(`${resource} not found`, 404, code);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

export class InsufficientCreditsError extends ApiError {
    public readonly creditsRequired?: number;
    public readonly creditsAvailable?: number;

    constructor(message = 'Insufficient credits', credits?: { required?: number; available?: number }) {
        super(message, 403, ErrorCode.INSUFFICIENT_CREDITS);
        this.creditsRequired = credits?.required;
        this.creditsAvailable = credits?.available;
        Object.setPrototypeOf(this, InsufficientCreditsError.prototype);
    }
}

export class ExternalServiceError extends ApiError {
    public readonly service?: string;
    constructor(message: string, service?: string, code = ErrorCode.EXTERNAL_SERVICE_ERROR) {
        super(message, 503, code);
        this.service = service;
        Object.setPrototypeOf(this, ExternalServiceError.prototype);
    }
}

export class DatabaseError extends ApiError {
    constructor(message = 'Database operation failed', code = ErrorCode.DATABASE_ERROR) {
        super(message, 500, code, false);
        Object.setPrototypeOf(this, DatabaseError.prototype);
    }
}

// ── Error Response Builder ─────────────────────────────────────

function buildErrorBody(error: ApiError) {
    const body: Record<string, unknown> = {
        error: {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode,
            timestamp: new Date().toISOString(),
        },
    };

    const errObj = body.error as Record<string, unknown>;

    if (error instanceof ValidationError && error.fields) {
        errObj.fields = error.fields;
    }
    if (error instanceof InsufficientCreditsError) {
        errObj.metadata = {
            creditsRequired: error.creditsRequired,
            creditsAvailable: error.creditsAvailable,
        };
    }
    if (error instanceof ExternalServiceError && error.service) {
        errObj.metadata = { service: error.service };
    }

    return body;
}

// ── Express Global Error Handler Middleware ───────────────────

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
    console.error('[API Error]', err);

    if (err instanceof ApiError) {
        res.status(err.statusCode).json(buildErrorBody(err));
        return;
    }

    if (err instanceof Error) {
        if (err.message.toLowerCase().includes('unauthorized')) {
            const e = new AuthenticationError();
            res.status(e.statusCode).json(buildErrorBody(e));
            return;
        }
        if (err.message.includes('Database') || err.message.includes('ECONNREFUSED')) {
            const e = new DatabaseError();
            res.status(e.statusCode).json(buildErrorBody(e));
            return;
        }
    }

    const generic = new ApiError(
        process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : String(err),
        500,
        ErrorCode.INTERNAL_ERROR,
        false,
    );
    res.status(500).json(buildErrorBody(generic));
}

// ── Convenience helper for controller try/catch ───────────────

export function handleApiError(error: unknown, res: Response): void {
    if (error instanceof Error) {
        console.error('[API Error][handleApiError]', error.message, error.stack);
    } else {
        console.error('[API Error][handleApiError]', error);
    }

    if (error instanceof ApiError) {
        res.status(error.statusCode).json(buildErrorBody(error));
        return;
    }
    const generic = new ApiError('An unexpected error occurred', 500, ErrorCode.INTERNAL_ERROR, false);
    res.status(500).json(buildErrorBody(generic));
}

// ── Quota / billing detection ─────────────────────────────────

/**
 * Returns true when the error message indicates a quota or billing issue
 * (e.g. OpenAI / Anthropic / Google rate-limit or billing errors).
 */
export function isQuotaError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
        msg.includes('quota') ||
        msg.includes('billing') ||
        msg.includes('insufficient') ||
        msg.includes('exceeded') ||
        msg.includes('limit') ||
        msg.includes('usage')
    );
}
