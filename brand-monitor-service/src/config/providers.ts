// ─────────────────────────────────────────────────────────────
// src/config/providers.ts
// Source: WebApp/lib/provider-config.ts  (full copy, no changes)
// All providers route through OpenRouter — no individual API keys needed.
// Ollama (local / ngrok) added as an optional self-hosted provider.
// ─────────────────────────────────────────────────────────────

import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModelV1 } from 'ai';

// ── OpenRouter client (cloud providers) ──────────────────────
const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

// ── Ollama client (self-hosted, OpenAI-compatible API) ────────
// Ollama exposes an OpenAI-compatible endpoint at <baseURL>/api
// When hosted on Colab via ngrok, set:
//   OLLAMA_BASE_URL=https://versicolor-nonshedding-leola.ngrok-free.dev
//   OLLAMA_MODEL=llama3   (or any model you have pulled)
//   OLLAMA_ENABLED=true
function createOllamaClient() {
    const baseUrl = process.env.OLLAMA_BASE_URL?.replace(/\/$/, '');
    if (!baseUrl) return null;
    return createOpenAI({
        baseURL: `${baseUrl}/v1`,
        // Ollama doesn't require a real API key, but the header must exist
        apiKey: 'ollama',
        // ngrok requires this header to bypass the browser warning page
        headers: { 'ngrok-skip-browser-warning': 'true' },
    });
}

export interface ProviderModel {
    id: string;
    name: string;
    maxTokens?: number;
    supportsFunctionCalling?: boolean;
    supportsStructuredOutput?: boolean;
    supportsWebSearch?: boolean;
}

export interface ProviderCapabilities {
    webSearch: boolean;
    functionCalling: boolean;
    structuredOutput: boolean;
    streamingResponse: boolean;
    maxRequestsPerMinute?: number;
}

export interface ProviderConfig {
    id: string;
    name: string;
    icon: string;
    envKey: string;
    models: ProviderModel[];
    defaultModel: string;
    capabilities: ProviderCapabilities;
    getModel: (modelId?: string, options?: any) => LanguageModelV1 | null;
    isConfigured: () => boolean;
    enabled: boolean;
}

export const PROVIDER_ENABLED_CONFIG: Record<string, boolean> = {
    openai: true,
    anthropic: false,
    google: true,
    perplexity: true,
    deepseek: false,
    grok: false,
    // Ollama is enabled at runtime if OLLAMA_ENABLED=true AND OLLAMA_BASE_URL is set
    ollama: process.env.OLLAMA_ENABLED === 'true',
};

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    openai: {
        id: 'openai',
        name: 'OpenAI',
        icon: '🤖',
        envKey: 'OPENROUTER_API_KEY',
        enabled: PROVIDER_ENABLED_CONFIG.openai,
        models: [
            { id: 'openai/gpt-5-nano', name: 'GPT-5o-nano', maxTokens: 1280000, supportsFunctionCalling: true, supportsStructuredOutput: true, supportsWebSearch: false },
            { id: 'openai/gpt-4o-mini:online', name: 'GPT-4o Mini', maxTokens: 128000, supportsFunctionCalling: true, supportsStructuredOutput: true, supportsWebSearch: true },
            { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', maxTokens: 128000, supportsFunctionCalling: true, supportsStructuredOutput: true, supportsWebSearch: true },
        ],
        defaultModel: 'openai/gpt-4o-mini:online',
        capabilities: { webSearch: true, functionCalling: true, structuredOutput: true, streamingResponse: true, maxRequestsPerMinute: 500 },
        getModel: (modelId?: string) => {
            if (!process.env.OPENROUTER_API_KEY) return null;
            return openrouter(modelId || PROVIDER_CONFIGS.openai.defaultModel);
        },
        isConfigured: () => !!process.env.OPENROUTER_API_KEY,
    },

    anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        icon: '🧠',
        envKey: 'OPENROUTER_API_KEY',
        enabled: PROVIDER_ENABLED_CONFIG.anthropic,
        models: [
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', maxTokens: 200000, supportsFunctionCalling: true, supportsStructuredOutput: true, supportsWebSearch: true },
            { id: 'anthropic/claude-haiku-4.5:online', name: 'Claude 4.5 Haiku', maxTokens: 200000, supportsFunctionCalling: true, supportsStructuredOutput: true, supportsWebSearch: true },
        ],
        defaultModel: 'anthropic/claude-haiku-4.5:online',
        capabilities: { webSearch: true, functionCalling: true, structuredOutput: true, streamingResponse: true, maxRequestsPerMinute: 50 },
        getModel: (modelId?: string) => {
            if (!process.env.OPENROUTER_API_KEY) return null;
            return openrouter(modelId || PROVIDER_CONFIGS.anthropic.defaultModel);
        },
        isConfigured: () => !!process.env.OPENROUTER_API_KEY,
    },

    google: {
        id: 'google',
        name: 'Google',
        icon: '🌟',
        envKey: 'OPENROUTER_API_KEY',
        enabled: PROVIDER_ENABLED_CONFIG.google,
        models: [
            { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', maxTokens: 1000000, supportsFunctionCalling: true, supportsStructuredOutput: true, supportsWebSearch: true },
            { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro', maxTokens: 1000000, supportsFunctionCalling: true, supportsStructuredOutput: true, supportsWebSearch: true },
        ],
        defaultModel: 'google/gemini-2.5-flash:online',
        capabilities: { webSearch: true, functionCalling: true, structuredOutput: true, streamingResponse: true, maxRequestsPerMinute: 200 },
        getModel: (modelId?: string) => {
            if (!process.env.OPENROUTER_API_KEY) return null;
            return openrouter(modelId || PROVIDER_CONFIGS.google.defaultModel);
        },
        isConfigured: () => !!process.env.OPENROUTER_API_KEY,
    },

    perplexity: {
        id: 'perplexity',
        name: 'Perplexity',
        icon: '🔍',
        envKey: 'OPENROUTER_API_KEY',
        enabled: PROVIDER_ENABLED_CONFIG.perplexity,
        models: [
            { id: 'perplexity/sonar-reasoning', name: 'Sonar Reasoning', maxTokens: 127000, supportsWebSearch: true },
            { id: 'perplexity/sonar', name: 'Sonar', maxTokens: 127000, supportsWebSearch: true },
        ],
        defaultModel: 'perplexity/sonar',
        capabilities: { webSearch: true, functionCalling: false, structuredOutput: false, streamingResponse: true, maxRequestsPerMinute: 20 },
        getModel: (modelId?: string) => {
            if (!process.env.OPENROUTER_API_KEY) return null;
            return openrouter(modelId || PROVIDER_CONFIGS.perplexity.defaultModel);
        },
        isConfigured: () => !!process.env.OPENROUTER_API_KEY,
    },

    deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        icon: '🐳',
        envKey: 'OPENROUTER_API_KEY',
        enabled: PROVIDER_ENABLED_CONFIG.deepseek,
        models: [
            { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat (V3)', maxTokens: 64000, supportsFunctionCalling: true, supportsStructuredOutput: true },
            { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1 (Free)', maxTokens: 64000 },
        ],
        defaultModel: 'deepseek/deepseek-r1-0528:free',
        capabilities: { webSearch: true, functionCalling: true, structuredOutput: true, streamingResponse: true, maxRequestsPerMinute: 100 },
        getModel: (modelId?: string) => {
            if (!process.env.OPENROUTER_API_KEY) return null;
            return openrouter(modelId || PROVIDER_CONFIGS.deepseek.defaultModel);
        },
        isConfigured: () => !!process.env.OPENROUTER_API_KEY,
    },

    grok: {
        id: 'grok',
        name: 'Grok',
        icon: '🌌',
        envKey: 'OPENROUTER_API_KEY',
        enabled: PROVIDER_ENABLED_CONFIG.grok,
        models: [
            { id: 'x-ai/grok-2-1212', name: 'Grok 2', maxTokens: 131072, supportsFunctionCalling: true, supportsStructuredOutput: true },
            { id: 'x-ai/grok-4.1-fast:online', name: 'grok-4.1', maxTokens: 64000, supportsWebSearch: true },
        ],
        defaultModel: 'x-ai/grok-4.1-fast:online',
        capabilities: { webSearch: false, functionCalling: true, structuredOutput: true, streamingResponse: true, maxRequestsPerMinute: 100 },
        getModel: (modelId?: string) => {
            if (!process.env.OPENROUTER_API_KEY) return null;
            return openrouter(modelId || PROVIDER_CONFIGS.grok.defaultModel);
        },
        isConfigured: () => !!process.env.OPENROUTER_API_KEY,
    },

    ollama: {
        id: 'ollama',
        name: 'Ollama',
        icon: '🦙',
        // No env key in the traditional sense — just needs OLLAMA_BASE_URL
        envKey: 'OLLAMA_BASE_URL',
        enabled: PROVIDER_ENABLED_CONFIG.ollama,
        models: [
            // List whichever models you have pulled in your Ollama instance.
            // The model name here must exactly match what `ollama list` shows.
            { id: 'llama3', name: 'Llama 3', maxTokens: 8192, supportsFunctionCalling: false, supportsStructuredOutput: false },
            { id: 'llama3.1', name: 'Llama 3.1', maxTokens: 128000, supportsFunctionCalling: false },
            { id: 'mistral', name: 'Mistral', maxTokens: 8192, supportsFunctionCalling: false },
            { id: 'gemma2', name: 'Gemma 2', maxTokens: 8192, supportsFunctionCalling: false },
        ],
        defaultModel: process.env.OLLAMA_MODEL || 'llama3',
        capabilities: { webSearch: false, functionCalling: false, structuredOutput: false, streamingResponse: true },
        getModel: (modelId?: string): LanguageModelV1 | null => {
            if (!process.env.OLLAMA_BASE_URL || process.env.OLLAMA_ENABLED !== 'true') return null;
            const client = createOllamaClient();
            if (!client) return null;
            const model = modelId || process.env.OLLAMA_MODEL || 'llama3';
            return client(model);
        },
        isConfigured: () =>
            process.env.OLLAMA_ENABLED === 'true' && !!process.env.OLLAMA_BASE_URL,
    },
};

export const PROVIDER_PRIORITY: Record<string, number> = {
    // Ollama runs first (priority 0) when enabled — it's free and local.
    // Change to a higher number if you want cloud providers to run first.
    ollama: 0,
    google: 1,
    openai: 2,
    anthropic: 3,
    perplexity: 4,
    grok: 5,
    deepseek: 6,
};

export function getConfiguredProviders(): ProviderConfig[] {
    return Object.values(PROVIDER_CONFIGS)
        .filter(p => p.enabled && p.isConfigured())
        .sort((a, b) => (PROVIDER_PRIORITY[a.id] || 999) - (PROVIDER_PRIORITY[b.id] || 999));
}

export function getEnabledProviders(): ProviderConfig[] {
    return Object.values(PROVIDER_CONFIGS).filter(p => p.enabled);
}

export function getProviderConfig(providerId: string): ProviderConfig | undefined {
    return PROVIDER_CONFIGS[providerId.toLowerCase()];
}

export function getProviderModel(providerId: string, modelId?: string, options?: any): LanguageModelV1 | null {
    const provider = getProviderConfig(providerId);
    if (!provider || !provider.enabled || !provider.isConfigured()) return null;
    return provider.getModel(modelId, options);
}

export function normalizeProviderName(name: string): string {
    const MAP: Record<string, string> = {
        OpenAI: 'openai', Anthropic: 'anthropic', Google: 'google',
        Perplexity: 'perplexity', DeepSeek: 'deepseek', Grok: 'grok', xAI: 'grok',
        Ollama: 'ollama',
    };
    return MAP[name] || name.toLowerCase();
}

/**
 * Returns the single best provider to use for a one-shot AI call
 * (e.g. identifyCompetitors, generatePrompts, resolveURLs).
 *
 * Rules:
 *  - If OLLAMA_ENABLED=true AND Ollama is configured → always return Ollama.
 *  - Otherwise → return the first configured provider whose id matches
 *    `preferredCloudId`, then any other cloud provider as fallback.
 *
 * Usage:
 *   const { provider, model } = getPreferredProvider('openai');
 *   if (!model) throw new Error('No AI provider available');
 */
export function getPreferredProvider(preferredCloudId = 'openai'): {
    provider: ProviderConfig;
    model: LanguageModelV1;
} | null {
    // 1. Ollama first if enabled
    if (process.env.OLLAMA_ENABLED === 'true') {
        const ollama = PROVIDER_CONFIGS.ollama;
        if (ollama?.isConfigured()) {
            const model = ollama.getModel();
            if (model) return { provider: ollama, model };
        }
    }

    // 2. Preferred cloud provider
    const configured = getConfiguredProviders();
    const preferred = configured.find((p) => p.id === preferredCloudId);
    if (preferred) {
        const model = preferred.getModel();
        if (model) return { provider: preferred, model };
    }

    // 3. Any configured provider as last resort
    for (const p of configured) {
        const model = p.getModel();
        if (model) return { provider: p, model };
    }

    return null;
}
