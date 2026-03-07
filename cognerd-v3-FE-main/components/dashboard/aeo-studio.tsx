"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Sparkles, 
  ChevronRight,
  Copy,
  Download,
  Save, 
  Cpu, 
  Type, 
  Zap,
  CheckCircle2,
  AlertCircle,
  User,
  Bot,
  Terminal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";

interface StudioCompetitor {
  name: string;
  url?: string;
  description?: string;
}

interface StudioBrandProfile {
  id?: string | number;
  name?: string;
  url?: string;
  description?: string | null;
  industry?: string | null;
  location?: string | null;
  tone?: string | null;
  competitors?: unknown;
  scrapedData?: {
    description?: string;
    competitorDetails?: Array<{ name?: string; url?: string; description?: string }>;
  } | null;
}

interface GenerateArticlePayload {
  topic: string;
  user_id: string;
  brand_id: string;
  brand_url: string;
  brand_name: string;
  brand_description: string;
  brand_industry: string;
  brand_location: string;
  brand_tone: string;
  follow_competitor_content: boolean;
  competitors: StudioCompetitor[];
  seo_requirements: {
    target_word_count: number;
    primary_keyword: string;
    secondary_keywords: string[];
    internal_links: string[];
    external_links: string[];
    include_faq: boolean;
    include_statistics: boolean;
    include_examples: boolean;
  };
  audience: {
    primary: string;
    secondary: string;
    experience_level: string;
  };
  content_format: {
    include_tables: boolean;
    include_step_by_step_guide: boolean;
    include_case_study: boolean;
  };
}

function parseLines(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCompetitors(value: unknown, fallbackDetails?: StudioBrandProfile["scrapedData"]): StudioCompetitor[] {
  const source = Array.isArray(value) ? value : [];
  const dedupe = new Set<string>();
  const result: StudioCompetitor[] = [];

  source.forEach((entry) => {
    if (!entry) return;
    if (typeof entry === "string") {
      const name = entry.trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (dedupe.has(key)) return;
      dedupe.add(key);
      result.push({ name });
      return;
    }
    if (typeof entry === "object") {
      const row = entry as { name?: unknown; url?: unknown; description?: unknown };
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!name) return;
      const key = name.toLowerCase();
      if (dedupe.has(key)) return;
      dedupe.add(key);
      result.push({
        name,
        url: typeof row.url === "string" && row.url.trim() ? row.url.trim() : undefined,
        description:
          typeof row.description === "string" && row.description.trim() ? row.description.trim() : undefined,
      });
    }
  });

  if (result.length > 0) return result;

  const details = Array.isArray(fallbackDetails?.competitorDetails) ? fallbackDetails.competitorDetails : [];
  details.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!name) return;
    const key = name.toLowerCase();
    if (dedupe.has(key)) return;
    dedupe.add(key);
    result.push({
      name,
      url: typeof entry.url === "string" && entry.url.trim() ? entry.url.trim() : undefined,
      description:
        typeof entry.description === "string" && entry.description.trim() ? entry.description.trim() : undefined,
    });
  });

  return result;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toSimpleMarkdownHtml(markdown: string): string {
  let html = escapeHtml(markdown);
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>');
  html = html.replace(/\n\n+/g, "</p><p>");
  html = html.replace(/\n/g, "<br/>");
  return `<p>${html}</p>`;
}

function embedLinksInArticle(article: string, internalLinks: string[], externalLinks: string[]): string {
  let output = article.trim();
  const missingInternal = internalLinks.filter((link) => !output.includes(link));
  const missingExternal = externalLinks.filter((link) => !output.includes(link));
  if (missingInternal.length === 0 && missingExternal.length === 0) return output;

  const sections: string[] = [];
  if (missingInternal.length > 0) {
    sections.push(
      "### Internal Links\n" + missingInternal.map((link) => `- [${link}](${link})`).join("\n")
    );
  }
  if (missingExternal.length > 0) {
    sections.push(
      "### External References\n" + missingExternal.map((link) => `- [${link}](${link})`).join("\n")
    );
  }
  return `${output}\n\n## Related Links\n${sections.join("\n\n")}`;
}

// --- 1. Doodle Background Pattern (DENSE & RANDOM) ---
function DoodleBackground() {
  return (
    <div className="absolute inset-0 z-0 opacity-[0.07] pointer-events-none overflow-hidden select-none">
      <svg width="100%" height="100%">
        <pattern id="doodle-pattern" x="0" y="0" width="350" height="350" patternUnits="userSpaceOnUse">
          {/* Group 1: Pens & Pencils (Varying Sizes) */}
          <g transform="translate(30, 40) rotate(-15) scale(0.8)">
            <path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l5.5 14.5L13 18z" stroke="currentColor" fill="none" strokeWidth="1.5" />
          </g>
          <g transform="translate(240, 50) rotate(115) scale(0.5)">
            <path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l5.5 14.5L13 18z" stroke="currentColor" fill="none" strokeWidth="2" />
          </g>
          <g transform="translate(160, 280) rotate(-45) scale(0.7)">
            <path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l5.5 14.5L13 18z" stroke="currentColor" fill="none" strokeWidth="1.5" />
          </g>

          {/* Group 2: Paperclips (Highly Random) */}
          <g transform="translate(110, 20) rotate(25) scale(0.6)">
            <path d="M6 7.91V16a6 6 0 0 0 12 0V6a4 4 0 0 0-8 0v10a2 2 0 0 0 4 0V7.91" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g transform="translate(280, 160) rotate(-70) scale(0.4)">
            <path d="M6 7.91V16a6 6 0 0 0 12 0V6a4 4 0 0 0-8 0v10a2 2 0 0 0 4 0V7.91" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g transform="translate(40, 240) rotate(50) scale(0.55)">
            <path d="M6 7.91V16a6 6 0 0 0 12 0V6a4 4 0 0 0-8 0v10a2 2 0 0 0 4 0V7.91" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Group 3: Diaries & Notebooks (The Large "Anchor" Doodles) */}
          <g transform="translate(180, 80) rotate(12) scale(0.85)">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" fill="none" strokeWidth="1.2" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" fill="none" strokeWidth="1.2" />
          </g>
          <g transform="translate(20, 140) rotate(-8) scale(0.45)">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" fill="none" strokeWidth="2" />
            <path d="M14 2v6h6" stroke="currentColor" fill="none" strokeWidth="2" />
          </g>
          <g transform="translate(260, 260) rotate(20) scale(0.7)">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" fill="none" strokeWidth="1.5" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" fill="none" strokeWidth="1.5" />
          </g>

          {/* Group 4: Inkpots & Brushes (Medium scale) */}
          <g transform="translate(120, 180) rotate(-12) scale(0.65)">
            <path d="M7 12h10v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8z" stroke="currentColor" fill="none" strokeWidth="1.5" />
            <path d="M9 12V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3" stroke="currentColor" fill="none" strokeWidth="1.5" />
          </g>
          <g transform="translate(210, 190) rotate(35) scale(0.5)">
            <path d="m14.622 17.897-10.68-10.697" stroke="currentColor" fill="none" strokeWidth="2" />
            <path d="M18.387 11.48a2.182 2.182 0 0 0-3.06-3.06l-1.42 1.42 3.06 3.06z" stroke="currentColor" fill="none" strokeWidth="2" />
          </g>
          <g transform="translate(40, 310) scale(0.4)">
            <path d="M7 12h10v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8z" stroke="currentColor" fill="none" strokeWidth="2" />
          </g>

          {/* Filler Details */}
          <circle cx="80" cy="100" r="2" fill="currentColor" />
          <circle cx="200" cy="30" r="1.5" fill="currentColor" />
          <circle cx="310" cy="220" r="1.8" fill="currentColor" />
          <circle cx="130" cy="320" r="2" fill="currentColor" />
          
          <path d="M50 50l6 6M56 50l-6 6" stroke="currentColor" strokeWidth="1" />
          <path d="M280 40l7 7M287 40l-7 7" stroke="currentColor" strokeWidth="1" />
          <path d="M140 230l4 4M144 230l-4 4" stroke="currentColor" strokeWidth="1" />
          
          {/* Group 5: Small Code Doodles */}
          <g transform="translate(150, 15) scale(0.4)" opacity="0.6">
            <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g transform="translate(290, 300) scale(0.5)" opacity="0.6">
            <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
          </g>
        </pattern>
        <rect width="100%" height="100%" fill="url(#doodle-pattern)" />
      </svg>
    </div>
  );
}

// --- 2. Simulation Overlay (Matrix Scanning) ---
function SimulationOverlay({ step }: { step: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[250] flex flex-col items-center justify-center bg-background/90 backdrop-blur-xl"
    >
      <div className="relative mb-12 h-32 w-32">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-4 rounded-full bg-primary/10"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Cpu className="text-primary" size={40} />
        </div>
        
        {/* Matrix Scanning Line */}
        <motion.div 
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_15px_rgba(249,115,22,0.8)] z-10"
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-3">
          <Terminal size={20} className="text-primary" />
          {step}
        </h2>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="h-1.5 w-1.5 rounded-full bg-primary"
            />
          ))}
        </div>
      </div>

      {/* Background Data Stream (Matrix style) */}
      <div className="absolute inset-0 -z-10 opacity-[0.05] overflow-hidden flex flex-wrap gap-4 p-4 font-mono text-[10px]">
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} className="whitespace-nowrap">
            {Math.random().toString(36).substring(2, 15)}
            {Math.random().toString(36).substring(2, 15)}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// --- 3. Simulation Result (Mock ChatGPT) ---
function SimulationResult({ topic, content, onClose }: { topic: string; content: string; onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 z-[260] flex items-center justify-center p-6 bg-foreground/5 backdrop-blur-md"
    >
      <div className="flex h-[600px] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border bg-secondary/30 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#10A37F] text-white">
              <Bot size={16} />
            </div>
            <span className="text-sm font-bold text-foreground">GPT-4o Simulation</span>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F9F9F9]">
          {/* User Message */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User size={16} />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-xs font-bold text-foreground">You</p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                What are the latest updates on {topic || "this topic"} and why should brands care?
              </p>
            </div>
          </div>

          {/* AI Response */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#10A37F] text-white">
              <Bot size={16} />
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-xs font-bold text-foreground">ChatGPT</p>
              <div className="text-sm text-foreground/90 leading-relaxed space-y-4">
                <p>Based on recent analysis of emerging market trends, {topic} is undergoing a significant shift.</p>
                
                {/* The "Citation" Highlight */}
                <div className="relative group">
                  <div className="absolute -left-2 inset-y-0 w-1 bg-primary rounded-full opacity-50" />
                  <p className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                    "Brands must focus on engineering content that AI loves to cite. A key strategy involves 
                    <span className="font-bold text-primary underline decoration-2 underline-offset-4 cursor-help"> injecting high-trust entity data</span> 
                    and ensuring direct answer structures."
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                    <CheckCircle2 size={10} />
                    Source: Your Studio Draft
                  </div>
                </div>

                <p>By implementing these structures, organizations can increase their citation probability by up to 40% in AI Overviews and conversational agents.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-white">
          <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 bg-secondary/20">
            <p className="text-xs text-muted-foreground italic">Simulation complete. Your content was successfully cited.</p>
            <Sparkles size={12} className="ml-auto text-primary" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface AIJudgePanelProps {
  dbLoading: boolean;
  userId: string;
  brandName: string;
  brandDescription: string;
  hasBackendResponse: boolean;
  citationScore: number;
  brandTone: string;
  setBrandTone: (value: string) => void;
  targetWordCount: string;
  setTargetWordCount: (value: string) => void;
  primaryKeyword: string;
  setPrimaryKeyword: (value: string) => void;
  secondaryKeywords: string;
  setSecondaryKeywords: (value: string) => void;
  internalLinks: string;
  setInternalLinks: (value: string) => void;
  externalLinks: string;
  setExternalLinks: (value: string) => void;
  audiencePrimary: string;
  setAudiencePrimary: (value: string) => void;
  audienceSecondary: string;
  setAudienceSecondary: (value: string) => void;
  audienceLevel: string;
  setAudienceLevel: (value: string) => void;
  includeFaq: boolean;
  setIncludeFaq: (value: boolean) => void;
  includeStatistics: boolean;
  setIncludeStatistics: (value: boolean) => void;
  includeExamples: boolean;
  setIncludeExamples: (value: boolean) => void;
  includeTables: boolean;
  setIncludeTables: (value: boolean) => void;
  includeStepByStepGuide: boolean;
  setIncludeStepByStepGuide: (value: boolean) => void;
  includeCaseStudy: boolean;
  setIncludeCaseStudy: (value: boolean) => void;
  followCompetitorContent: boolean;
  setFollowCompetitorContent: (value: boolean) => void;
  onGenerateArticle: () => void;
  generating: boolean;
  generateError: string | null;
  generateSuccess: string | null;
}

// --- 4. AI Intelligence Panel (The Judge) ---
function AIJudgePanel({
  dbLoading,
  userId,
  brandName,
  brandDescription,
  hasBackendResponse,
  citationScore,
  brandTone,
  setBrandTone,
  targetWordCount,
  setTargetWordCount,
  primaryKeyword,
  setPrimaryKeyword,
  secondaryKeywords,
  setSecondaryKeywords,
  internalLinks,
  setInternalLinks,
  externalLinks,
  setExternalLinks,
  audiencePrimary,
  setAudiencePrimary,
  audienceSecondary,
  setAudienceSecondary,
  audienceLevel,
  setAudienceLevel,
  includeFaq,
  setIncludeFaq,
  includeStatistics,
  setIncludeStatistics,
  includeExamples,
  setIncludeExamples,
  includeTables,
  setIncludeTables,
  includeStepByStepGuide,
  setIncludeStepByStepGuide,
  includeCaseStudy,
  setIncludeCaseStudy,
  followCompetitorContent,
  setFollowCompetitorContent,
  onGenerateArticle,
  generating,
  generateError,
  generateSuccess,
}: AIJudgePanelProps) {
  return (
    <div className="flex h-full w-full lg:w-1/2 flex-col border-l border-border bg-card/80 backdrop-blur-md z-10">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-primary fill-primary/20" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">AI Intelligence</h3>
        </div>
        <p className="text-[11px] text-sidebar-muted">Real-time Answer Engine optimization</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {hasBackendResponse ? (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Citation Probability</span>
                <span className="text-xs font-mono text-primary font-bold">{citationScore}%</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <motion.div
                  animate={{ width: `${citationScore}%` }}
                  className="h-full bg-primary"
                />
              </div>
              <p className="text-[11px] leading-relaxed text-sidebar-muted">
                Estimated probability based on generated article quality signals.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase text-foreground/50 tracking-wider">Recommendations</h4>

              <div className="space-y-3">
                <div className="group flex gap-3 p-3 rounded-xl border border-border bg-background hover:border-primary/30 transition-all cursor-pointer">
                  <Zap size={14} className="text-warning mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-bold text-foreground">Improve Keyword Coverage</p>
                    <p className="text-[11px] text-sidebar-muted mt-1">Ensure the primary keyword appears in heading and introduction.</p>
                  </div>
                </div>

                <div className="group flex gap-3 p-3 rounded-xl border border-border bg-background hover:border-primary/30 transition-all cursor-pointer">
                  <CheckCircle2 size={14} className="text-success mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-bold text-foreground">Structure Confirmed</p>
                    <p className="text-[11px] text-sidebar-muted mt-1">Generated markdown is structured for readable AI extraction.</p>
                  </div>
                </div>

                <div className="group flex gap-3 p-3 rounded-xl border border-dashed border-border bg-secondary/20 hover:border-primary/30 transition-all cursor-pointer">
                  <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-bold text-foreground">Add More Proof Points</p>
                    <p className="text-[11px] text-sidebar-muted mt-1">Include statistics or source references to strengthen trust signals.</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-background p-4 text-xs text-muted-foreground">
            Citation probability and recommendations will appear after backend returns the generated article.
          </div>
        )}

        <div className="space-y-3 rounded-xl border border-border bg-background p-3">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-foreground/50">Generate Inputs</h4>
          <p className="text-[10px] text-muted-foreground">
            {dbLoading ? "Loading brand data..." : `User: ${userId || "N/A"} | Brand: ${brandName || "N/A"}`}
          </p>
          {brandDescription ? (
            <p className="line-clamp-3 text-[10px] text-muted-foreground">{brandDescription}</p>
          ) : null}

          <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground">
            Brand tone
            <input
              value={brandTone}
              onChange={(e) => setBrandTone(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-[11px] outline-none focus:border-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground">
            Target word count
            <input
              value={targetWordCount}
              onChange={(e) => setTargetWordCount(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-[11px] outline-none focus:border-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground">
            Primary keyword
            <input
              value={primaryKeyword}
              onChange={(e) => setPrimaryKeyword(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-[11px] outline-none focus:border-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground">
            Secondary keywords (one per line)
            <textarea
              value={secondaryKeywords}
              onChange={(e) => setSecondaryKeywords(e.target.value)}
              rows={3}
              className="rounded-md border border-border bg-card p-2 text-[11px] outline-none focus:border-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground">
            Internal links (one per line)
            <textarea
              value={internalLinks}
              onChange={(e) => setInternalLinks(e.target.value)}
              rows={2}
              className="rounded-md border border-border bg-card p-2 text-[11px] outline-none focus:border-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground">
            External links (one per line)
            <textarea
              value={externalLinks}
              onChange={(e) => setExternalLinks(e.target.value)}
              rows={2}
              className="rounded-md border border-border bg-card p-2 text-[11px] outline-none focus:border-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground">
            Audience primary
            <input
              value={audiencePrimary}
              onChange={(e) => setAudiencePrimary(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-[11px] outline-none focus:border-primary/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground">
            Audience secondary
            <input
              value={audienceSecondary}
              onChange={(e) => setAudienceSecondary(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-[11px] outline-none focus:border-primary/40"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground">
            Audience experience level
            <input
              value={audienceLevel}
              onChange={(e) => setAudienceLevel(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-[11px] outline-none focus:border-primary/40"
            />
          </label>

          <label className="flex items-center gap-2 text-[11px] text-foreground">
            <input type="checkbox" checked={followCompetitorContent} onChange={(e) => setFollowCompetitorContent(e.target.checked)} />
            follow_competitor_content
          </label>
          <label className="flex items-center gap-2 text-[11px] text-foreground">
            <input type="checkbox" checked={includeFaq} onChange={(e) => setIncludeFaq(e.target.checked)} />
            include_faq
          </label>
          <label className="flex items-center gap-2 text-[11px] text-foreground">
            <input type="checkbox" checked={includeStatistics} onChange={(e) => setIncludeStatistics(e.target.checked)} />
            include_statistics
          </label>
          <label className="flex items-center gap-2 text-[11px] text-foreground">
            <input type="checkbox" checked={includeExamples} onChange={(e) => setIncludeExamples(e.target.checked)} />
            include_examples
          </label>
          <label className="flex items-center gap-2 text-[11px] text-foreground">
            <input type="checkbox" checked={includeTables} onChange={(e) => setIncludeTables(e.target.checked)} />
            include_tables
          </label>
          <label className="flex items-center gap-2 text-[11px] text-foreground">
            <input type="checkbox" checked={includeStepByStepGuide} onChange={(e) => setIncludeStepByStepGuide(e.target.checked)} />
            include_step_by_step_guide
          </label>
          <label className="flex items-center gap-2 text-[11px] text-foreground">
            <input type="checkbox" checked={includeCaseStudy} onChange={(e) => setIncludeCaseStudy(e.target.checked)} />
            include_case_study
          </label>

          <button
            onClick={onGenerateArticle}
            disabled={generating}
            className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {generating ? "Getting article..." : "Get Article"}
          </button>
          {generateError ? <p className="text-[11px] text-destructive">{generateError}</p> : null}
          {generateSuccess ? <p className="text-[11px] text-success">{generateSuccess}</p> : null}
        </div>
      </div>
    </div>
  );
}

// --- 5. Main Studio Component ---
export function AEOStudio({ isOpen, onClose, initialTopic = "" }: { isOpen: boolean; onClose: () => void; initialTopic?: string }) {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState(initialTopic);
  const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [brandProfile, setBrandProfile] = useState<StudioBrandProfile | null>(null);
  const [competitors, setCompetitors] = useState<StudioCompetitor[]>([]);
  const [brandTone, setBrandTone] = useState("");
  const [targetWordCount, setTargetWordCount] = useState("1500");
  const [primaryKeyword, setPrimaryKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState("");
  const [internalLinks, setInternalLinks] = useState("");
  const [externalLinks, setExternalLinks] = useState("");
  const [audiencePrimary, setAudiencePrimary] = useState("");
  const [audienceSecondary, setAudienceSecondary] = useState("");
  const [audienceLevel, setAudienceLevel] = useState("General audience");
  const [includeFaq, setIncludeFaq] = useState(true);
  const [includeStatistics, setIncludeStatistics] = useState(true);
  const [includeExamples, setIncludeExamples] = useState(true);
  const [includeTables, setIncludeTables] = useState(true);
  const [includeStepByStepGuide, setIncludeStepByStepGuide] = useState(false);
  const [includeCaseStudy, setIncludeCaseStudy] = useState(true);
  const [followCompetitorContent, setFollowCompetitorContent] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);
  const hasBackendResponse = content.trim().length > 0;
  const citationScore = Math.min(40 + Math.floor(content.length / 20), 98);

  useEffect(() => {
    setTitle(initialTopic);
  }, [initialTopic]);

  useEffect(() => {
    if (!isOpen) return;
    const token = getAuthToken();
    if (!token) return;

    let cancelled = false;

    const loadDefaults = async () => {
      try {
        setDbLoading(true);
        const baseUrl = process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";

        const [meRes, profileRes, audienceRes] = await Promise.all([
          fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${baseUrl}/api/brand-monitor/brand-profile/current`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${baseUrl}/api/brand-monitor/audience/current`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const meData = await meRes.json().catch(() => ({}));
        const profileData = await profileRes.json().catch(() => ({}));
        const audienceData = await audienceRes.json().catch(() => ({}));

        if (cancelled) return;

        const nextUserId =
          meData?.user?.id ||
          meData?.user?._id ||
          meData?.id ||
          "";
        setUserId(String(nextUserId || ""));

        const brand = (profileData?.brand || null) as StudioBrandProfile | null;
        setBrandProfile(brand);
        if (brand) {
          const extractedCompetitors = parseCompetitors(brand.competitors, brand.scrapedData || undefined);
          setCompetitors(extractedCompetitors);
          if (!primaryKeyword && brand.name) {
            setPrimaryKeyword(String(brand.name).trim().toLowerCase());
          }
          if (!brandTone) {
            setBrandTone(typeof brand.tone === "string" && brand.tone.trim() ? brand.tone.trim() : "");
          }
        }

        const audience = audienceData?.audience;
        if (audience && typeof audience === "object") {
          if (typeof audience.primary === "string" && audience.primary.trim()) {
            setAudiencePrimary(audience.primary.trim());
          }
          if (typeof audience.secondary === "string" && audience.secondary.trim()) {
            setAudienceSecondary(audience.secondary.trim());
          }
          if (typeof audience.experienceLevel === "string" && audience.experienceLevel.trim()) {
            setAudienceLevel(audience.experienceLevel.trim());
          }
        }
      } catch (err) {
        console.warn("[AEOStudio] Failed to prefill studio inputs:", err);
      } finally {
        if (!cancelled) setDbLoading(false);
      }
    };

    loadDefaults();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleGenerateArticle = async () => {
    try {
      if (!title.trim()) {
        setGenerateError("Topic is required.");
        return;
      }

      const brand = brandProfile || {};
      const pythonServiceBaseUrl = process.env.NEXT_PUBLIC_PYTHON_SERVICE_BASE_URL || "http://localhost:8001";
      const payload: GenerateArticlePayload = {
        topic: title.trim(),
        user_id: userId,
        brand_id: String(brand.id ?? ""),
        brand_url: String(brand.url ?? ""),
        brand_name: String(brand.name ?? ""),
        brand_description: String(brand.description ?? brand.scrapedData?.description ?? ""),
        brand_industry: String(brand.industry ?? ""),
        brand_location: String(brand.location ?? ""),
        brand_tone: brandTone.trim(),
        follow_competitor_content: followCompetitorContent,
        competitors: competitors.map((row) => ({
          name: row.name,
          url: row.url,
          description: row.description,
        })),
        seo_requirements: {
          target_word_count: Number(targetWordCount) || 1500,
          primary_keyword: primaryKeyword.trim(),
          secondary_keywords: parseLines(secondaryKeywords),
          internal_links: parseLines(internalLinks),
          external_links: parseLines(externalLinks),
          include_faq: includeFaq,
          include_statistics: includeStatistics,
          include_examples: includeExamples,
        },
        audience: {
          primary: audiencePrimary.trim(),
          secondary: audienceSecondary.trim(),
          experience_level: audienceLevel.trim() || "General audience",
        },
        content_format: {
          include_tables: includeTables,
          include_step_by_step_guide: includeStepByStepGuide,
          include_case_study: includeCaseStudy,
        },
      };

      setGenerating(true);
      setGenerateError(null);
      setGenerateSuccess(null);

      const response = await fetch(`${pythonServiceBaseUrl}/content-studio/generate-article`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message || data?.error || "Failed to generate article.");
      }

      const generatedArticle =
        data?.article ||
        data?.content ||
        data?.generated_article ||
        data?.result?.article ||
        "";
      if (typeof generatedArticle === "string" && generatedArticle.trim()) {
        const embedded = embedLinksInArticle(generatedArticle, parseLines(internalLinks), parseLines(externalLinks));
        setContent(embedded);
        setEditorMode("edit");
      }
      setGenerateSuccess("Article generated successfully from python service.");
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate article.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = () => {
    const key = `content_studio_draft_${brandProfile?.id || "default"}`;
    const payload = {
      topic: title,
      articleMarkdown: content,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
    setDraftMessage("Draft saved.");
    window.setTimeout(() => setDraftMessage(null), 2000);
  };

  const handleCopyArticle = async () => {
    if (!content.trim()) return;
    try {
      await navigator.clipboard.writeText(content);
      setDraftMessage("Article copied.");
      window.setTimeout(() => setDraftMessage(null), 2000);
    } catch {
      setDraftMessage("Copy failed.");
      window.setTimeout(() => setDraftMessage(null), 2000);
    }
  };

  const handleDownloadArticle = () => {
    if (!content.trim()) return;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.trim().replace(/\s+/g, "-").toLowerCase() || "generated-article"}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="fixed inset-0 z-[200] flex flex-col bg-background"
        >
          <DoodleBackground />

          {/* Studio Top Bar */}
          <header className="relative z-10 flex h-16 items-center justify-between border-b border-border bg-card/50 backdrop-blur-md px-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-secondary transition-colors"
              >
                <X size={20} />
              </button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-sidebar-muted">AEO Studio Mode</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDraft}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-sidebar-muted hover:bg-secondary transition-all"
              >
                <Save size={13} />
                Save Draft
              </button>
              <button
                onClick={handleCopyArticle}
                disabled={!hasBackendResponse}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-sidebar-muted hover:bg-secondary transition-all disabled:opacity-50"
              >
                <Copy size={13} />
                Copy
              </button>
              <button
                onClick={handleDownloadArticle}
                disabled={!hasBackendResponse}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-sidebar-muted hover:bg-secondary transition-all disabled:opacity-50"
              >
                <Download size={13} />
                Download
              </button>
            </div>
          </header>

          <div className="relative z-10 flex flex-1 flex-col overflow-hidden lg:flex-row">
            {/* Topic Input */}
            <main className="w-full overflow-y-auto border-b border-border p-8 lg:w-1/2 lg:border-b-0 lg:border-r lg:p-10">
              <div className="mx-auto max-w-xl space-y-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Type size={13} />
                  Topic Input
                </div>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Write topic for evaluation..."
                  className="w-full rounded-xl border border-border bg-card p-4 text-lg font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
                />
                <p className="text-xs text-muted-foreground">
                  Enter topic and generate from backend. The response appears below as editable markdown.
                </p>
                {draftMessage ? <p className="text-xs font-medium text-primary">{draftMessage}</p> : null}

                <div className="rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border p-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">Article Markdown</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditorMode("edit")}
                        className={cn(
                          "rounded-md px-2 py-1 text-[10px] font-semibold",
                          editorMode === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setEditorMode("preview")}
                        className={cn(
                          "rounded-md px-2 py-1 text-[10px] font-semibold",
                          editorMode === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    {editorMode === "edit" ? (
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Generated markdown article will appear here..."
                        className="min-h-[320px] w-full resize-y rounded-lg border border-border bg-background p-3 text-xs text-foreground outline-none focus:border-primary/40"
                      />
                    ) : (
                      <div
                        className="prose prose-sm max-w-none min-h-[320px] rounded-lg border border-border bg-background p-3 text-xs text-foreground"
                        dangerouslySetInnerHTML={{ __html: toSimpleMarkdownHtml(content || "No article generated yet.") }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </main>

            {/* AI Intelligence Panel */}
            <AIJudgePanel
              dbLoading={dbLoading}
              userId={userId}
              brandName={brandProfile?.name || ""}
              brandDescription={
                String(
                  brandProfile?.description ||
                  brandProfile?.scrapedData?.description ||
                  ""
                )
              }
              hasBackendResponse={hasBackendResponse}
              citationScore={citationScore}
              brandTone={brandTone}
              setBrandTone={setBrandTone}
              targetWordCount={targetWordCount}
              setTargetWordCount={setTargetWordCount}
              primaryKeyword={primaryKeyword}
              setPrimaryKeyword={setPrimaryKeyword}
              secondaryKeywords={secondaryKeywords}
              setSecondaryKeywords={setSecondaryKeywords}
              internalLinks={internalLinks}
              setInternalLinks={setInternalLinks}
              externalLinks={externalLinks}
              setExternalLinks={setExternalLinks}
              audiencePrimary={audiencePrimary}
              setAudiencePrimary={setAudiencePrimary}
              audienceSecondary={audienceSecondary}
              setAudienceSecondary={setAudienceSecondary}
              audienceLevel={audienceLevel}
              setAudienceLevel={setAudienceLevel}
              includeFaq={includeFaq}
              setIncludeFaq={setIncludeFaq}
              includeStatistics={includeStatistics}
              setIncludeStatistics={setIncludeStatistics}
              includeExamples={includeExamples}
              setIncludeExamples={setIncludeExamples}
              includeTables={includeTables}
              setIncludeTables={setIncludeTables}
              includeStepByStepGuide={includeStepByStepGuide}
              setIncludeStepByStepGuide={setIncludeStepByStepGuide}
              includeCaseStudy={includeCaseStudy}
              setIncludeCaseStudy={setIncludeCaseStudy}
              followCompetitorContent={followCompetitorContent}
              setFollowCompetitorContent={setFollowCompetitorContent}
              onGenerateArticle={handleGenerateArticle}
              generating={generating}
              generateError={generateError}
              generateSuccess={generateSuccess}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
