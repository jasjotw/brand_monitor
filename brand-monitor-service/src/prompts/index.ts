// ─────────────────────────────────────────────────────────────
// src/prompts/index.ts
// Source: WebApp/prompts/*.ts  (3 prompt files used by brand-monitor)
//
// Copied verbatim — these are pure string-template functions with
// no Next.js or external dependencies.
// ─────────────────────────────────────────────────────────────

// ── competitor-identification ──────────────────────────────────

export interface CompetitorIdentificationParams {
    companyName: string;
    industry: string;
    description: string;
    keywords?: string;
    knownCompetitors?: string;
    location?: string;
}

export const COMPETITOR_IDENTIFICATION_PROMPT = (params: CompetitorIdentificationParams) => `
Identify 10-15 real, established competitors of ${params.companyName} in the ${params.industry} industry.

Company: ${params.companyName}
Industry: ${params.industry}
Description: ${params.description}
${params.location ? `Location: ${params.location}` : ''} 
${params.keywords ? `Keywords: ${params.keywords}` : ''}
${params.knownCompetitors ? `Known competitors: ${params.knownCompetitors}` : ''}

Based on this company's specific business model and target market, identify ONLY direct competitors that:
1. Offer the SAME type of products/services (not just retailers that sell them)
2. Target the SAME customer segment
3. Have a SIMILAR business model (e.g., if it's a DTC brand, find other DTC brands)
4. Actually compete for the same customers
5. If a location is provided, prioritize competitors from the same city/region and same country; include at least 4 from that country/region if possible.

For example:
- If it's a DTC underwear brand, find OTHER DTC underwear brands (not department stores)
- If it's a web scraping API, find OTHER web scraping APIs (not general data tools)
- If it's an AI model provider, find OTHER AI model providers (not AI applications)

IMPORTANT:
- Only include companies you are confident actually exist
- If a location is available, ensure at least 4 competitors are from the same country/region; prefer city/region matches when possible
- Focus on TRUE competitors with similar offerings
- Exclude retailers, marketplaces, or aggregators unless the company itself is one
- Aim for 10-15 competitors total
`;

export const AI_COMPETITOR_DETECTION_PROMPT = (params: {
    companyName: string;
    companyContext: string;
    location?: string;
}) => `
Based on the following company information, identify exactly 10 direct competitors in the same industry/market segment.

${params.companyContext}
${params.location ? `\nThe company is located in ${params.location}.` : '\nNo location is provided.'}

Requirements:
- Focus on DIRECT competitors offering similar products/services to the same target market
- Return exactly 10 unique competitors (no duplicates by name or domain)
- If location is provided: include exactly 5 "local" competitors (same city/region/country) and 5 "global" competitors (outside that location)
- If location is not provided: return 10 "global" competitors
- Provide the most common official domain for each competitor (e.g., "shopify.com", no protocol, no path)
- Be specific and relevant to this exact business, not generic industry players

Return ONLY valid JSON in this exact format with no additional text:
{
  "competitors": [
    {"name": "Competitor Name", "url": "domain.com", "scope": "local"},
    {"name": "Another Competitor", "url": "example.com", "scope": "global"}
  ]
}
`;

// ── prompt-generation ──────────────────────────────────────────

export interface PromptGenerationParams {
    brandName: string;
    industry: string;
    mainProducts: string;
    keywords: string;
    description: string;
    competitors: string;
    location?: string;
    usp?: string;
    targetAudience?: string;
    positioning?: string;
    personas?: { role: string; description: string }[];
    icp?: {
        summary?: string;
        industries?: string[];
        companySize?: string;
        annualRevenueRange?: string;
        geographies?: string[];
        budgetRange?: string;
        buyingCommittee?: string[];
        painPoints?: string[];
        successCriteria?: string[];
    };
}

export const PERSONA_GENERATION_SYSTEM_PROMPT = (params: PromptGenerationParams) => `
You are a marketing strategist and AI-era buyer behavior expert

Create exactly 3 user personas for the company below.

Location Rules:

If a company location is provided (${params.location || "none"}):

Create 2 personas based in the same location.

Create 1 persona with a global or international context.

Local personas must reflect local business behavior, regional market maturity, and local buying considerations.

The global persona should represent a broader international segment.

If no location is provided:

Create 3 globally neutral personas.

Each persona must include:

name (location-aware if applicable)

role

decisionAuthority (Final Decision Maker | Strong Influencer | Researcher / Evaluator)

budgetSensitivity (High | Medium | Low)

urgencyLevel (Low | Medium | High)

description

aiSearchBehavior

painPoints (exactly 3)

goals (exactly 3)

Personas must represent:

Core buyer segment

Influencer or evaluator segment

Broader or emerging market segment

Output strictly in JSON:

{
"personas": [
{
"name": "",
"role": "",
"decisionAuthority": "",
"budgetSensitivity": "",
"urgencyLevel": "",
"description": "",
"aiSearchBehavior": "",
"painPoints": [],
"goals": []
}
]
}

Company Info:
Name: ${params.brandName}
Location: ${params.location || "none"}
Industry: ${params.industry}
Main Products: ${params.mainProducts}
Keywords: ${params.keywords}
Description: ${params.description}
`;

export const PROMPT_GENERATION_SYSTEM_PROMPT = (params: PromptGenerationParams) => `
You are an expert at simulating customer search behavior and creating AEO (AI Engine Optimization) prompts.

Your goal is to generate natural, high-intent conversational queries that decision-makers would use when interacting with AI engines (ChatGPT, Gemini, Claude, Perplexity) while looking for solutions like what ${params.brandName} offers.

These prompts will be used for AI visibility monitoring, competitive analysis, and citation measurement.

${params.personas ? 'ACT AS THE TARGET PERSONAS. For each query, adopt the specific mindset, tone, authority level, urgency, and decision pressure of the provided personas.' : ''}

Generate 5 prompts for each of these intent layers:

Organic_Discovery:
Pure problem-based queries.
DO NOT mention ${params.brandName} or competitors.
Used for TRUE Visibility Score.

Category_Authority:
Category-focused discovery queries.
DO NOT mention ${params.brandName}.
Competitors may be implied but not explicitly forced.
Used for Market Position Score.

Competitive_Evaluation:
Direct comparison queries.
You MAY mention ${params.brandName} and competitors.
Used for Competitive Strength Index.

Replacement_Intent:
Switch-intent queries mentioning competitors.
${params.brandName} optional.
Used for Switch Opportunity Score.

Conversational_Recall:
Longer, advisory-style AI queries with executive or team tone.
Include citation-triggering language like:
"Which companies are known for"
"What tools are trusted by"
"According to industry experts"
Used for Narrative Authority Score.

POSITIONING RULES:
Marketing Position: ${params.positioning ?? 'budget'}

If "budget":
- Include price sensitivity.
- Mention ROI pressure.
- Mention cost comparison or affordability.
- Include switching from expensive tools.

If "premium":
- Include reliability, scalability, performance.
- Mention trust signals.
- Include mid-to-large company context.
- Focus on long-term value.

If "luxury":
- Emphasize exclusivity and white-glove service.
- Avoid price sensitivity.
- Focus on experience, prestige, and high-end performance.

DEPTH REQUIREMENTS:
Each prompt MUST include at least TWO of the following:
- Company size or ARR
- Industry specificity
- Budget range
- Timeline urgency
- KPI goal
- Current tool used
- Geographic reference (if provided: ${params.location || 'none'})

Each prompt must be between 20–40 words.

RULES:
1. Sound Like a Real Decision-Maker: Use natural conversational language. Avoid robotic keyword stuffing.
2. Focus on Business Pressure: Include urgency, metrics, growth pressure, switching pain, or operational challenges.
3. Be Specific: Avoid generic queries like "best software." Add context (industry, company size, budget, timeline, KPI).
4. Brand Mentioning:
   - Organic_Discovery & Category_Authority: DO NOT mention ${params.brandName}.
   - Competitive_Evaluation & Replacement_Intent: You MAY mention ${params.brandName}.
   - Conversational_Recall: Brand mention optional.
5. Location: If ${params.location || 'none'} is provided, at least 30% of prompts should include geographic context.
6. DO NOT mix intent layers. Each prompt must clearly belong to exactly one category.

Output Format:
Return a single JSON object with:
{
  "prompts": [
    {
      "prompt": "The actual search query text",
      "category": "organic_discovery | category_authority | competitive_evaluation | replacement_intent | conversational_recall",
      ${params.personas ? '"persona": "Name of the persona this prompt belongs to" (optional but recommended)' : ''}
    }
  ],
  "monitoring_framework": {
    "visibility_score_definition": "Calculated ONLY from organic_discovery and category_authority responses.",
    "competitive_strength_definition": "Calculated ONLY from competitive_evaluation responses.",
    "switch_opportunity_definition": "Calculated ONLY from replacement_intent responses.",
    "narrative_authority_definition": "Calculated ONLY from conversational_recall responses.",
    "calculation_logic": {
      "explicit_mention": "Brand directly named in AI response",
      "implicit_mention": "Brand described but not named",
      "citation_presence": "External source referenced",
      "ranking_position": "Order of appearance in AI answer"
    }
  }
}

Example JSON Structure:
{
  "prompts": [
    { "prompt": "We are a 50-person SaaS company struggling to track AI brand visibility across ChatGPT and Gemini. What tools are experts recommending in 2026?", "category": "conversational_recall" },
    { "prompt": "Looking for affordable alternatives to enterprise AI monitoring tools under $500/month for a growing ecommerce brand.", "category": "replacement_intent" }
  ]
}

Company Info:
Name: ${params.brandName}
${params.location ? `Location: ${params.location}` : ''}
Industry: ${params.industry}
Main Products: ${params.mainProducts}
Keywords: ${params.keywords}
USP: ${params.usp ?? ''}
Target Audience: ${params.targetAudience ?? ''}
Marketing Position: ${params.positioning ?? 'budget'}
Description: ${params.description}
Competitors: ${params.competitors}

${params.icp ? `Ideal Customer Profile:
Summary: ${params.icp.summary ?? ''}
Industries: ${(params.icp.industries ?? []).join(', ')}
Company Size: ${params.icp.companySize ?? ''}
Annual Revenue Range: ${params.icp.annualRevenueRange ?? ''}
Geographies: ${(params.icp.geographies ?? []).join(', ')}
Budget Range: ${params.icp.budgetRange ?? ''}
Buying Committee: ${(params.icp.buyingCommittee ?? []).join(', ')}
Pain Points: ${(params.icp.painPoints ?? []).join(', ')}
Success Criteria: ${(params.icp.successCriteria ?? []).join(', ')}` : ''}

${params.personas ? `Target Personas:
${params.personas
    .map(
        (p) => `Role: ${p.role}
Description: ${p.description}`,
    )
    .join('\n')}` : ''}
`;
