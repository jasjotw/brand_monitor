"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { FileText, Sparkles, ListChecks, BarChart3, Wand2, Copy, ArrowRight, Star } from "lucide-react";
import { AEOStudio } from "../aeo-studio";
import { getAuthToken } from "@/lib/auth";

type ContentScoreItem = {
  id: string;
  title: string;
  url: string;
  score: number;
  citations: number;
  status: "optimized" | "needs-update" | "low";
  markdown: string;
};

type SuggestedTopicItem = {
  name: string;
  desc: string;
  icon: React.ReactNode;
};

const contentScores: ContentScoreItem[] = [
  { id: "ai-analytics-guide", title: "AI Analytics Complete Guide", url: "/blog/ai-analytics-guide", score: 92, citations: 67, status: "optimized", markdown: "" },
  { id: "seo-vs-aeo", title: "SEO vs AEO: What You Need to Know", url: "/blog/seo-vs-aeo", score: 78, citations: 41, status: "needs-update", markdown: "" },
  { id: "track-ai-visibility", title: "How to Track AI Visibility", url: "/blog/track-ai-visibility", score: 85, citations: 54, status: "optimized", markdown: "" },
  { id: "brand-monitoring", title: "Brand Monitoring in 2026", url: "/blog/brand-monitoring", score: 65, citations: 22, status: "needs-update", markdown: "" },
  { id: "enterprise-case-study", title: "Enterprise Case Study", url: "/case-studies/enterprise", score: 58, citations: 18, status: "low", markdown: "" },
  { id: "product-overview", title: "Product Overview", url: "/products/overview", score: 72, citations: 35, status: "needs-update", markdown: "" },
  { id: "api-docs", title: "API Documentation", url: "/docs/api", score: 88, citations: 28, status: "optimized", markdown: "" },
  { id: "competitor-analysis-template", title: "Competitor Analysis Template", url: "/resources/templates", score: 44, citations: 8, status: "low", markdown: "" },
];

const suggestedTopics = [
  { name: "Comparison Article", desc: "Side-by-side product comparison optimized for AI citations", icon: <ListChecks size={16} strokeWidth={1.5} /> },
  { name: "How-To Guide", desc: "Step-by-step guide structured for AI answer extraction", icon: <Wand2 size={16} strokeWidth={1.5} /> },
  { name: "FAQ Page", desc: "Question-answer format ideal for AI training data", icon: <FileText size={16} strokeWidth={1.5} /> },
  { name: "Listicle", desc: "Ranked list format that AI engines love to cite", icon: <Star size={16} strokeWidth={1.5} /> },
];

const statusConfig = {
  optimized: { label: "Optimized", color: "bg-success/10 text-success" },
  "needs-update": { label: "Needs Update", color: "bg-warning/10 text-warning" },
  low: { label: "Low Score", color: "bg-destructive/10 text-destructive" },
};

function normalizeStatus(score: number): "optimized" | "needs-update" | "low" {
  if (score >= 80) return "optimized";
  if (score >= 60) return "needs-update";
  return "low";
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function extractArrayPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.topics)) return payload.topics;
  if (Array.isArray(payload?.summary)) return payload.summary;
  if (Array.isArray(payload?.content_score)) return payload.content_score;
  if (Array.isArray(payload?.content_summary)) return payload.content_summary;
  if (Array.isArray(payload?.content_pieces)) return payload.content_pieces;
  if (Array.isArray(payload?.content_list)) return payload.content_list;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.results)) return payload.data.results;
  if (Array.isArray(payload?.data?.topics)) return payload.data.topics;
  if (Array.isArray(payload?.data?.content_score)) return payload.data.content_score;
  if (Array.isArray(payload?.data?.content_summary)) return payload.data.content_summary;
  if (Array.isArray(payload?.data?.content_pieces)) return payload.data.content_pieces;
  if (Array.isArray(payload?.data?.content_list)) return payload.data.content_list;
  return [];
}

function normalizeScore(raw: unknown, fallback = 65): number {
  const n = toNumber(raw, fallback);
  if (n <= 1.5) return Math.max(0, Math.min(100, Math.round(n * 100)));
  return Math.max(0, Math.min(100, Math.round(n)));
}

function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "<p class='text-muted-foreground'>No preview content available.</p>";
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>');
  html = html.replace(/\n\n+/g, "</p><p>");
  html = html.replace(/\n/g, "<br/>");
  return `<p>${html}</p>`;
}

export function ContentPage() {
  const [studioOpen, setStudioOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState("");
  const [dynamicContentScores, setDynamicContentScores] = useState<ContentScoreItem[]>([]);
  const [dynamicSuggestedTopics, setDynamicSuggestedTopics] = useState<SuggestedTopicItem[]>([]);
  const [backendCountPieces, setBackendCountPieces] = useState<number | null>(null);
  const [backendAvgSeoScore, setBackendAvgSeoScore] = useState<number | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [markdownById, setMarkdownById] = useState<Record<string, string>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const searchParams = useSearchParams();
  const globalQuery = (searchParams.get("q") || "").trim().toLowerCase();

  useEffect(() => {
    const topic = searchParams.get("topic");
    if (topic) {
      setActiveTopic(topic);
      setStudioOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const loadDynamicSummary = async () => {
      try {
        const token = getAuthToken();
        if (!token) return;

        setSummaryLoading(true);
        const brandBaseUrl = process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
        const pythonServiceBaseUrl = process.env.NEXT_PUBLIC_PYTHON_SERVICE_BASE_URL || "http://localhost:8001";

        const [meRes, brandRes] = await Promise.all([
          fetch(`${brandBaseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${brandBaseUrl}/api/brand-monitor/brand-profile/current`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const meData = await meRes.json().catch(() => ({}));
        const brandData = await brandRes.json().catch(() => ({}));
        const userId = String(meData?.user?.id || meData?.user?._id || "").trim();
        const brandUrl = String(brandData?.brand?.url || "").trim();
        if (!brandUrl) return;

        const params = new URLSearchParams();
        params.set("brand_url", brandUrl);
        if (userId) params.set("user_id", userId);
        params.set("limit", "12");

        const summaryRes = await fetch(`${pythonServiceBaseUrl}/content-studio/brand-content-summary?${params.toString()}`);
        if (!summaryRes.ok) return;
        const summaryData = await summaryRes.json().catch(() => ({}));

        const countPieces = toNumber(
          summaryData?.count_pieces ??
          summaryData?.countPieces ??
          summaryData?.content_pieces ??
          summaryData?.total_pieces ??
          summaryData?.totalPieces,
          0
        );
        const avgSeoScore = toNumber(
          summaryData?.avg_score?.seo_score ??
          summaryData?.avg_score?.seoScore ??
          summaryData?.avgSeoScore ??
          summaryData?.seo_score,
          NaN
        );
        const rows = extractArrayPayload(summaryData);
        if (cancelled) return;

        const mappedScores: ContentScoreItem[] = rows
          .map((row: any, idx: number) => {
            const title = String(row?.title || row?.topic || row?.headline || row?.name || "").trim();
            if (!title) return null;
            const url = String(row?.url || row?.link || row?.source_url || row?.page_url || "#").trim();
            const score = normalizeScore(row?.score ?? row?.seo_score ?? row?.ai_score ?? row?.relevance, 65);
            const citations = toNumber(row?.citations ?? row?.citation_count ?? row?.mentions, 0);
            const markdown = String(row?.markdown ?? row?.content_markdown ?? row?.content ?? row?.preview ?? row?.article ?? "");
            return {
              id: String(row?.id || row?._id || row?.topic_id || `${idx}-${title}`),
              title,
              url,
              score: Math.max(0, Math.min(100, Math.round(score))),
              citations: Math.max(0, Math.round(citations)),
              status: normalizeStatus(score),
              markdown,
            };
          })
          .filter(Boolean) as ContentScoreItem[];

        const mappedTopics: SuggestedTopicItem[] = rows
          .map((row: any, idx: number) => {
            const name = String(row?.topic || row?.title || row?.headline || row?.name || "").trim();
            if (!name) return null;
            const desc = String(row?.description || row?.summary || row?.reason || "Suggested based on your brand content summary.").trim();
            const icons = [
              <ListChecks key={`icon-list-${idx}`} size={16} strokeWidth={1.5} />,
              <Wand2 key={`icon-wand-${idx}`} size={16} strokeWidth={1.5} />,
              <FileText key={`icon-file-${idx}`} size={16} strokeWidth={1.5} />,
              <Star key={`icon-star-${idx}`} size={16} strokeWidth={1.5} />,
            ];
            return { name, desc, icon: icons[idx % icons.length] };
          })
          .filter(Boolean) as SuggestedTopicItem[];

        if (countPieces > 0) setBackendCountPieces(countPieces);
        if (Number.isFinite(avgSeoScore)) setBackendAvgSeoScore(normalizeScore(avgSeoScore, 65));
        if (mappedScores.length > 0) {
          setDynamicContentScores(mappedScores);
          const initialMarkdown = mappedScores.reduce<Record<string, string>>((acc, item) => {
            acc[item.id] = item.markdown || "";
            return acc;
          }, {});
          setMarkdownById(initialMarkdown);
        }
        if (mappedTopics.length > 0) setDynamicSuggestedTopics(mappedTopics);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };

    loadDynamicSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveContentScores = dynamicContentScores.length > 0 ? dynamicContentScores : contentScores;
  const effectiveSuggestedTopics = dynamicSuggestedTopics.length > 0 ? dynamicSuggestedTopics : suggestedTopics;

  const filteredContentScores = effectiveContentScores.filter((item) => {
    const haystack = `${item.title} ${item.url} ${item.status}`.toLowerCase();
    return !globalQuery || haystack.includes(globalQuery);
  });
  const filteredSuggestedTopics = effectiveSuggestedTopics.filter((t) => {
    const haystack = `${t.name} ${t.desc}`.toLowerCase();
    return !globalQuery || haystack.includes(globalQuery);
  });

  const avgScore = Math.round(
    filteredContentScores.reduce((a, b) => a + b.score, 0) / Math.max(1, filteredContentScores.length)
  );

  return (
    <div className="flex flex-col gap-6">
      <AEOStudio
        isOpen={studioOpen}
        onClose={() => setStudioOpen(false)}
        initialTopic={activeTopic}
      />

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Content Pieces", value: String(backendCountPieces ?? filteredContentScores.length), icon: <FileText size={16} strokeWidth={1.5} /> },
          { label: "Avg. AI Score", value: `${backendAvgSeoScore ?? avgScore}/100`, icon: <BarChart3 size={16} strokeWidth={1.5} /> },
          { label: "Total Citations", value: filteredContentScores.reduce((a, b) => a + b.citations, 0).toString(), icon: <Copy size={16} strokeWidth={1.5} /> },
          { label: "Optimized Pages", value: `${filteredContentScores.filter((c) => c.status === "optimized").length}/${Math.max(1, filteredContentScores.length)}`, icon: <Sparkles size={16} strokeWidth={1.5} /> },
        ].map((stat) => (
          <div key={stat.label} className="card-hover flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8 text-primary">{stat.icon}</div>
            <div>
              <span className="text-xl font-semibold text-foreground">{stat.value}</span>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 card-hover rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Content Scores</h3>
              <p className="text-xs text-muted-foreground">Topic list from your content summary</p>
            </div>
            <button
              onClick={() => { setActiveTopic(""); setStudioOpen(true); }}
              className="nav-item flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles size={12} strokeWidth={2} />
              Generate Content
            </button>
          </div>

          <div className="flex flex-col">
            {filteredContentScores.map((item, i) => (
              <div key={item.id} className={cn(i < filteredContentScores.length - 1 && "border-b border-border/50")}>
                <button
                  onClick={() => {
                    setExpandedItemId((prev) => (prev === item.id ? null : item.id));
                    setEditingItemId(null);
                  }}
                  className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-secondary/30"
                >
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                    <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#F5F0EB" strokeWidth="2.5" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke={item.score >= 80 ? "#5B9A6B" : item.score >= 60 ? "#D4A44E" : "#D4644E"} strokeWidth="2.5" strokeDasharray={`${item.score * 0.88} 100`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute text-[9px] font-bold text-foreground">{item.score}</span>
                  </div>

                  <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    <span className="truncate text-xs font-medium text-foreground">{item.title}</span>
                    <span className="truncate text-[10px] text-muted-foreground">{item.url}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-medium text-foreground">{item.citations}</span>
                      <span className="text-[10px] text-muted-foreground">citations</span>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", statusConfig[item.status].color)}>
                      {statusConfig[item.status].label}
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground">
                      <ArrowRight size={12} strokeWidth={1.5} />
                    </span>
                  </div>
                </button>

                {expandedItemId === item.id ? (
                  <div className="px-5 pb-4">
                    <div className="rounded-lg border border-border bg-secondary/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground">Content Preview (Markdown)</span>
                        <button
                          onClick={() => setEditingItemId((prev) => (prev === item.id ? null : item.id))}
                          className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-secondary"
                        >
                          {editingItemId === item.id ? "Done" : "Edit"}
                        </button>
                      </div>

                      {editingItemId === item.id ? (
                        <textarea
                          value={markdownById[item.id] ?? item.markdown}
                          onChange={(e) =>
                            setMarkdownById((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          className="min-h-[180px] w-full rounded-md border border-border bg-card p-3 text-xs text-foreground outline-none focus:border-primary/40"
                        />
                      ) : (
                        <div
                          className="prose prose-sm max-w-none rounded-md border border-border bg-card p-3 text-xs text-foreground"
                          dangerouslySetInnerHTML={{ __html: markdownToHtml(markdownById[item.id] ?? item.markdown) }}
                        />
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card-hover rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-card-foreground">Suggested Topics</h3>
              <p className="text-xs text-muted-foreground">
                {summaryLoading ? "Loading dynamic suggestions..." : "Topic ideas optimized for AI citations"}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {filteredSuggestedTopics.map((t) => (
                <button
                  key={t.name}
                  onClick={() => { setActiveTopic(t.name); setStudioOpen(true); }}
                  className="group flex items-start gap-3 rounded-lg border border-transparent p-3 text-left transition-all hover:border-border hover:bg-secondary/30"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/30 text-foreground">
                    {t.icon}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-foreground">{t.name}</span>
                    <span className="text-[11px] leading-relaxed text-muted-foreground">{t.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={14} strokeWidth={1.5} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">AI Content Studio</span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Generate AI-optimized content with our intelligent assistant. It analyzes top-performing prompts and creates content structures that maximize AI citations.
            </p>
            <button
              onClick={() => { setActiveTopic(""); setStudioOpen(true); }}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80"
            >
              Launch Studio
              <ArrowRight size={12} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
