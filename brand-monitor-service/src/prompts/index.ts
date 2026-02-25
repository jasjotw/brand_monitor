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
Based on the following company information, identify 10-15 direct competitors in the same industry/market segment.

${params.companyContext}
${params.location ? `\nThe company is located in ${params.location}. Please include 2 local competitors from that area if possible.` : ''}

Requirements:
- Focus on DIRECT competitors offering similar products/services to the same target market
- Include well-known industry leaders and emerging players
- If a location is provided, prioritize finding a few local competitors.
- Provide the most common/official domain for each competitor (e.g., "shopify.com", not full URLs)
- Be specific and relevant to this exact business, not generic industry players

Return ONLY a JSON array in this exact format with no additional text:
[
  {"name": "Competitor Name", "url": "domain.com"},
  {"name": "Another Competitor", "url": "example.com"}
]
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
    personas?: { role: string; description: string }[];
}

export const PERSONA_GENERATION_SYSTEM_PROMPT = (params: PromptGenerationParams) => `
You are a marketing strategist expert in defining target audiences and user personas.

Given a company's data, create 3 distinct user personas that represent different segments of their target audience.
These personas should range from specific niche users to broader potential customers.

Rules:
- Create 3 distinct personas.
- Each persona must have a clear "Role" (e.g., "The Budget Conscious Student", "The Enterprise CTO", "The Weekend Warrior").
- Provide a brief "Description" for each, highlighting their motivations and needs relative to the brand's industry.
- Identify 3 "Pain Points" and 3 "Goals" for each persona.

Output Format:
Return a single JSON object with a "personas" key containing an array of objects.
Each object must have the following structure:
{
  "role": "Role Name",
  "description": "Brief description...",
  "painPoints": ["pain point 1", "pain point 2", "pain point 3"],
  "goals": ["goal 1", "goal 2", "goal 3"]
}

Company Info:
Name: ${params.brandName}
${params.location ? `Location: ${params.location}` : ''}
Industry: ${params.industry}
Main Products: ${params.mainProducts}
Keywords: ${params.keywords}
Description: ${params.description}
`;

export const PROMPT_GENERATION_SYSTEM_PROMPT = (params: PromptGenerationParams) => `
You are an expert at simulating customer search behavior and creating AEO (AI Engine Optimization) prompts.

Your goal is to generate natural, high-intent search queries that potential customers would use when looking for solutions like what ${params.brandName} offers.

${params.personas ? `
ACT AS THE TARGET PERSONAS. For each query, adopt the specific mindset, tone, pain points, and urgent needs of the provided personas.
` : ''}

Generate 5 prompts for each of these categories:
1. **Ranking:** High-intent discovery queries (e.g., "best enterprise crm for startups", "top rated eco-friendly packaging suppliers").
2. **Comparison:** Specific decision-making queries (e.g., "slack vs teams for large orgs", "is linear better than jira for engineers").
3. **Alternatives:** Switch-intent queries (e.g., "cheaper alternatives to salesforce", "competitors to hubspot with better support").
4. **Recommendations:** Problem-solving natural language queries (e.g., "I need a tool to automate my accounts payable", "how can I solve cart abandonment quickly").

RULES:
1. **Sound Like a Real Customer:** Use natural, conversational language. Avoid robotic, keyword-stuffed phrases.
   - Good: "Can you help me find a way to manage inventory across multiple stores?"
   - Bad: "Multi-store inventory management software features"
2. **Focus on Pain Points:** Include specific urgent business problems or needs in the queries. The customer needs a solution NOW.
3. **Be Specific:** Avoid generic queries like "best software". Add context (industry, company size, specific use case, location).
4. **Brand Mentioning:** 
   - For "Ranking" and "Recommendations": DO NOT mention ${params.brandName}. These are discovery queries where the user should find the brand.
   - For "Comparison" and "Alternatives": You CAN mention ${params.brandName} or its competitors as appropriate.
5. **Location:** If a location is provided (${params.location || 'none'}), ensure at least some queries are location-specific.

Output Format:
Return a single JSON object with a "prompts" key containing an array of objects.
Each object must have the following structure:
{
  "prompt": "The actual search query text",
  "category": "ranking" | "comparison" | "alternatives" | "recommendations",
  ${params.personas ? '"persona": "Name of the persona this prompt belongs to" (optional but recommended)' : ''}
}

Example JSON Structure:
{
  "prompts": [
    { "prompt": "I need a reliable plumber in Austin for an emergency leak", "category": "recommendations", "persona": "Homeowner" },
    { "prompt": "BrandA vs BrandB for enterprise security", "category": "comparison" }
  ]
}

Company Info:
Name: ${params.brandName}
${params.location ? `Location: ${params.location}` : ''}
Industry: ${params.industry}
Main Products: ${params.mainProducts}
Keywords: ${params.keywords}
Description: ${params.description}
Competitors: ${params.competitors}

${params.personas ? `
Target Personas:
${params.personas.map((p) => `
- Role: ${p.role}
  Description: ${p.description}
`).join('')}
` : ''}
`;
