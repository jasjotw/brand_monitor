// ─────────────────────────────────────────────────────────────
// src/utils/brand-detection.utils.ts
// Sources:
//   - WebApp/lib/brand-detection-config.ts  (config + getBrandDetectionConfig)
//   - WebApp/lib/brand-detection-utils.ts   (all detection logic)
//
// Both files are merged here because brand-detection-config.ts
// imports from brand-detection-utils.ts (types only) and vice-versa,
// creating a circular dependency. Merging eliminates it cleanly.
// ─────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────

export interface BrandDetectionOptions {
    caseSensitive?: boolean;
    wholeWordOnly?: boolean;
    includeVariations?: boolean;
    customVariations?: string[];
    excludeNegativeContext?: boolean;
    includeUrlDetection?: boolean;
    brandUrls?: string[];
    minConfidenceThreshold?: number;
}

export interface BrandDetectionResult {
    mentioned: boolean;
    matches: {
        text: string;
        index: number;
        pattern: string;
        confidence: number;
    }[];
    confidence: number;
}

export interface BrandDetectionConfig {
    defaultOptions: BrandDetectionOptions;
    brandAliases: Map<string, string[]>;
    ignoredSuffixes: string[];
    negativeContextPatterns: RegExp[];
    confidenceThresholds: {
        high: number;
        medium: number;
        low: number;
    };
}

// ── Default Config ────────────────────────────────────────────

export const DEFAULT_BRAND_DETECTION_CONFIG: BrandDetectionConfig = {
    defaultOptions: {
        caseSensitive: false,
        wholeWordOnly: true,
        includeVariations: true,
        excludeNegativeContext: true,
    },
    brandAliases: new Map(),
    ignoredSuffixes: [
        'inc', 'incorporated',
        'llc', 'limited liability company',
        'ltd', 'limited',
        'corp', 'corporation',
        'co', 'company',
        'plc', 'public limited company',
        'gmbh', 'ag', 'sa', 'srl',
    ],
    negativeContextPatterns: [
        /\bnot\s+(?:recommended|good|worth|reliable|suitable)\b/i,
        /\bavoid(?:ing)?\s+/i,
        /\bworse\s+than\b/i,
        /\binferior\s+to\b/i,
        /\bdon't\s+(?:use|recommend|like|trust)\b/i,
        /\bstay\s+away\s+from\b/i,
        /\bnever\s+use\b/i,
        /\bterrible\s+(?:service|product|quality)\b/i,
        /\bscam\b/i,
        /\bfraud(?:ulent)?\b/i,
    ],
    confidenceThresholds: {
        high: 0.85,
        medium: 0.65,
        low: 0.4,
    },
};

// Global singleton config
let globalConfig: BrandDetectionConfig = {
    ...DEFAULT_BRAND_DETECTION_CONFIG,
    brandAliases: new Map(),
};

// ── Config Accessors ──────────────────────────────────────────

export function getBrandDetectionConfig(): BrandDetectionConfig {
    return { ...globalConfig };
}

export function getBrandDetectionOptions(brandName: string): BrandDetectionOptions {
    const options = { ...globalConfig.defaultOptions };
    const aliases = globalConfig.brandAliases.get(brandName);
    if (aliases && aliases.length > 0) {
        options.customVariations = aliases;
    }
    return options;
}

// ── Name Normalization ────────────────────────────────────────

export function normalizeBrandName(name: string): string {
    const config = getBrandDetectionConfig();
    const suffixPattern = new RegExp(`\\b(${config.ignoredSuffixes.join('|')})\\b\\.?$`, 'gi');

    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/'s\b/g, '')
        .replace(suffixPattern, '')
        .trim();
}

// ── Variation Generation ──────────────────────────────────────

export function generateBrandVariations(brandName: string): string[] {
    const normalized = normalizeBrandName(brandName);
    const variations = new Set<string>();

    variations.add(brandName.toLowerCase());
    variations.add(normalized);
    variations.add(normalized.replace(/\s+/g, ''));
    variations.add(normalized.replace(/\s+/g, '-'));
    variations.add(normalized.replace(/\s+/g, '_'));
    variations.add(normalized.replace(/\s+/g, '.'));

    const words = normalized.split(' ');
    if (words.length > 1) {
        variations.add(words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(''));
        variations.add(words[0] + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(''));
        variations.add(words.join('').toLowerCase());
        variations.add(words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').toLowerCase());
    }

    if (brandName.includes('&')) {
        variations.add(normalized.replace(/&/g, 'and'));
        variations.add(normalized.replace(/&/g, 'n'));
        variations.add(normalized.replace(/&/g, ''));
    }

    if (brandName.includes('+')) {
        variations.add(normalized.replace(/\+/g, 'plus'));
        variations.add(normalized.replace(/\+/g, 'and'));
        variations.add(normalized.replace(/\+/g, ''));
    }

    const numberMap: Record<string, string> = {
        '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
        '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '0': 'zero',
    };

    Object.entries(numberMap).forEach(([num, word]) => {
        if (normalized.includes(num)) {
            variations.add(normalized.replace(new RegExp(num, 'g'), word));
        }
    });

    const abbrevMap: Record<string, string[]> = {
        'artificial intelligence': ['ai'],
        'machine learning': ['ml'],
        'natural language': ['nl', 'nlp'],
        technologies: ['tech'],
        laboratories: ['labs'],
        solutions: ['sol'],
        systems: ['sys'],
        software: ['sw'],
        hardware: ['hw'],
        incorporated: ['inc'],
        corporation: ['corp'],
        limited: ['ltd'],
    };

    Object.entries(abbrevMap).forEach(([full, abbrevs]) => {
        if (normalized.includes(full)) {
            abbrevs.forEach((abbrev) => variations.add(normalized.replace(full, abbrev)));
        }
    });

    if (!brandName.includes('.') && brandName.length > 2) {
        ['com', 'io', 'ai', 'dev', 'co', 'net', 'org', 'app'].forEach((tld) => {
            variations.add(`${normalized.replace(/\s+/g, '')}.${tld}`);
        });
    }

    return Array.from(variations);
}

// ── Regex Pattern Builder ─────────────────────────────────────

export function createBrandRegexPatterns(brandName: string, variations?: string[]): RegExp[] {
    const allVariations = new Set([...generateBrandVariations(brandName), ...(variations || [])]);
    const patterns: RegExp[] = [];

    allVariations.forEach((variation) => {
        const escaped = variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        patterns.push(new RegExp(`\\b${escaped}\\b`, 'i'));
        patterns.push(new RegExp(`\\b${escaped}(?:-\\w+)*\\b`, 'i'));
        patterns.push(new RegExp(`\\b${escaped}'s?\\b`, 'i'));
        patterns.push(new RegExp(`\\b${escaped}(?:\\s+(?:inc|llc|ltd|corp|corporation|company|co)\\.?)?\\b`, 'i'));
    });

    return patterns;
}

// ── Core Detection ────────────────────────────────────────────

/**
 * Detects whether a brand is mentioned in a text string.
 * Uses regex patterns with word-boundary checks and optional URL matching.
 */
export function detectBrandMention(
    text: string,
    brandName: string,
    options: BrandDetectionOptions = {},
): BrandDetectionResult {
    const {
        caseSensitive = false,
        wholeWordOnly = true,
        includeVariations = true,
        customVariations = [],
        excludeNegativeContext = true,
        includeUrlDetection: includeUrlDetectionOption,
        brandUrls = [],
        minConfidenceThreshold = 0.65,
    } = options;

    const includeUrlDetection = includeUrlDetectionOption ?? brandUrls.length > 0;
    const normalizedBrand = normalizeBrandName(brandName);
    const compactBrand = normalizedBrand.replace(/[^a-z0-9]/g, '');
    const searchText = caseSensitive ? text : text.toLowerCase();
    const originalText = text;
    const matches: BrandDetectionResult['matches'] = [];

    const negativePatterns = [
        /\bnot\s+(?:recommended|good|worth|reliable)\b/i,
        /\bavoid\b/i,
        /\bworse\s+than\b/i,
        /\binferior\s+to\b/i,
        /\bdon't\s+(?:use|recommend|like)\b/i,
    ];

    const getContext = (start: number, length: number) => {
        const contextStart = Math.max(0, start - 50);
        const contextEnd = Math.min(searchText.length, start + length + 50);
        return searchText.substring(contextStart, contextEnd);
    };

    const pushMatch = (textMatch: string, index: number, pattern: string, confidence: number) => {
        if (confidence < minConfidenceThreshold) return;
        matches.push({ text: textMatch, index, pattern, confidence });
    };

    const patterns = wholeWordOnly
        ? createBrandRegexPatterns(brandName, customVariations)
        : [new RegExp(brandName, caseSensitive ? 'g' : 'gi')];

    patterns.forEach((pattern) => {
        const regex = new RegExp(pattern.source, pattern.flags + 'g');
        let match;
        while ((match = regex.exec(searchText)) !== null) {
            const matchText = match[0];
            const matchIndex = match.index;

            const beforeChar = matchIndex > 0 ? searchText[matchIndex - 1] : ' ';
            const afterChar =
                matchIndex + matchText.length < searchText.length
                    ? searchText[matchIndex + matchText.length]
                    : ' ';

            if (/[a-zA-Z0-9]/.test(beforeChar) || /[a-zA-Z0-9]/.test(afterChar)) continue;

            if (excludeNegativeContext) {
                const context = getContext(matchIndex, matchText.length);
                if (negativePatterns.some((np) => np.test(context))) continue;
            }

            const originalMatch = originalText.substring(matchIndex, matchIndex + matchText.length);
            const normalizedMatch = caseSensitive ? matchText.toLowerCase() : matchText;
            const cleanedMatch = normalizedMatch
                .replace(/['']s\b/, '')
                .replace(/^[^a-z0-9]+/, '')
                .replace(/[^a-z0-9]+$/, '')
                .trim();
            const compactMatch = cleanedMatch.replace(/[^a-z0-9]/g, '');

            let confidence = 0.45;

            if (cleanedMatch === normalizedBrand || (compactMatch && compactMatch === compactBrand)) {
                confidence = 1.0;
            } else if (compactMatch && compactBrand && (compactMatch.startsWith(compactBrand) || compactBrand.startsWith(compactMatch))) {
                confidence = Math.max(confidence, 0.92);
            } else if (cleanedMatch && normalizedBrand && (cleanedMatch.startsWith(normalizedBrand) || normalizedBrand.startsWith(cleanedMatch))) {
                confidence = Math.max(confidence, 0.85);
            } else if (includeVariations && compactMatch && compactBrand && (compactMatch.includes(compactBrand) || compactBrand.includes(compactMatch))) {
                confidence = Math.max(confidence, 0.72);
            } else if (includeVariations) {
                confidence = Math.max(confidence, 0.65);
            }

            pushMatch(originalMatch, matchIndex, pattern.source, confidence);
        }
    });

    // URL-based detection
    if (includeUrlDetection && brandUrls.length > 0) {
        const domainVariants = new Set<string>();

        brandUrls.forEach((url) => {
            if (!url) return;
            let candidate = url.trim();
            if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
            try {
                const parsed = new URL(candidate);
                const host = parsed.hostname.toLowerCase();
                if (host) {
                    domainVariants.add(host);
                    domainVariants.add(host.replace(/^www\./, ''));
                }
            } catch {
                const fallback = candidate
                    .replace(/^https?:\/\//i, '')
                    .replace(/^www\./i, '')
                    .replace(/\/.*$/, '')
                    .toLowerCase();
                if (fallback) domainVariants.add(fallback);
            }
        });

        domainVariants.forEach((domain) => {
            if (!domain) return;
            const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const flags = caseSensitive ? 'g' : 'gi';
            const domainRegex = new RegExp(`\\b${escaped}\\b`, flags);
            let match;
            while ((match = domainRegex.exec(searchText)) !== null) {
                const matchIndex = match.index;
                const matchedText = originalText.substring(matchIndex, matchIndex + match[0].length);
                if (excludeNegativeContext) {
                    const context = getContext(matchIndex, match[0].length);
                    if (negativePatterns.some((np) => np.test(context))) continue;
                }
                pushMatch(matchedText, matchIndex, `url:${domain}`, Math.max(0.88, minConfidenceThreshold));
            }
        });
    }

    // De-duplicate by position (keep highest confidence per index)
    const uniqueMatches = matches.reduce((acc, match) => {
        const existing = acc.find((m) => m.index === match.index);
        if (!existing || match.confidence > existing.confidence) {
            return [...acc.filter((m) => m.index !== match.index), match];
        }
        return acc;
    }, [] as typeof matches);

    const overallConfidence = uniqueMatches.length > 0 ? Math.max(...uniqueMatches.map((m) => m.confidence)) : 0;

    return {
        mentioned: uniqueMatches.length > 0 && overallConfidence >= minConfidenceThreshold,
        matches: uniqueMatches.sort((a, b) => b.confidence - a.confidence),
        confidence: overallConfidence,
    };
}

/**
 * Detects multiple brands in a text in one pass.
 * Returns a Map of brand name → BrandDetectionResult.
 */
export function detectMultipleBrands(
    text: string,
    brands: string[],
    options: BrandDetectionOptions = {},
): Map<string, BrandDetectionResult> {
    const results = new Map<string, BrandDetectionResult>();
    brands.forEach((brand) => {
        results.set(brand, detectBrandMention(text, brand, options));
    });
    return results;
}
