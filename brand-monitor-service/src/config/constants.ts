// ─────────────────────────────────────────────────────────────
// src/config/constants.ts
// Source: WebApp/config/constants.ts  (brand-monitor exports only)
// ─────────────────────────────────────────────────────────────

// ── Autumn Billing ────────────────────────────────────────────
export const FEATURE_ID_MESSAGES = 'messages';
export const CREDITS_PER_BRAND_ANALYSIS = 30;

// ── SSE ───────────────────────────────────────────────────────
export const SSE_MAX_DURATION = 300; // seconds (5 minutes)

// ── Error Messages ────────────────────────────────────────────
export const ERROR_MESSAGES = {
    AUTHENTICATION_REQUIRED: 'Please log in to access this feature',
    SESSION_EXPIRED: 'Your session has expired. Please log in again',

    NO_CREDITS_REMAINING: 'You have no credits remaining. Please upgrade your plan to continue.',
    INSUFFICIENT_CREDITS_BRAND_ANALYSIS: 'Insufficient credits. You need at least 10 credits to run a brand analysis.',

    INVALID_REQUEST: 'Invalid request format',
    COMPANY_INFO_REQUIRED: 'Company information is required',
    URL_REQUIRED: 'URL is required',

    AUTUMN_SERVICE_ERROR: 'Unable to process credits. Please try again',
    AI_SERVICE_ERROR: 'AI service is temporarily unavailable. Please try again',
    DATABASE_ERROR: 'Database error occurred. Please try again',

    INTERNAL_ERROR: 'An unexpected error occurred',
} as const;
