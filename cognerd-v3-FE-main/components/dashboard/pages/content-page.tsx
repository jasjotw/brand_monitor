"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { FileText, Sparkles, ListChecks, BarChart3, Wand2, Copy, ArrowRight, Star } from "lucide-react";
import { AEOStudio } from "../aeo-studio";

const contentScores = [
  { title: "AI Analytics Complete Guide", url: "/blog/ai-analytics-guide", score: 92, citations: 67, status: "optimized" as const },
  { title: "SEO vs AEO: What You Need to Know", url: "/blog/seo-vs-aeo", score: 78, citations: 41, status: "needs-update" as const },
  { title: "How to Track AI Visibility", url: "/blog/track-ai-visibility", score: 85, citations: 54, status: "optimized" as const },
  { title: "Brand Monitoring in 2026", url: "/blog/brand-monitoring", score: 65, citations: 22, status: "needs-update" as const },
  { title: "Enterprise Case Study", url: "/case-studies/enterprise", score: 58, citations: 18, status: "low" as const },
  { title: "Product Overview", url: "/products/overview", score: 72, citations: 35, status: "needs-update" as const },
  { title: "API Documentation", url: "/docs/api", score: 88, citations: 28, status: "optimized" as const },
  { title: "Competitor Analysis Template", url: "/resources/templates", score: 44, citations: 8, status: "low" as const },
];

const templates = [
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

export function ContentPage() {
  const [studioOpen, setStudioOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState("");
  const searchParams = useSearchParams();
  const globalQuery = (searchParams.get("q") || "").trim().toLowerCase();

  // Check for topic in URL (from Backlinks "Generate Blog" button)
  useEffect(() => {
    const topic = searchParams.get("topic");
    if (topic) {
      setActiveTopic(topic);
      setStudioOpen(true);
    }
  }, [searchParams]);

  const filteredContentScores = contentScores.filter((item) => {
    const haystack = `${item.title} ${item.url} ${item.status}`.toLowerCase();
    return !globalQuery || haystack.includes(globalQuery);
  });
  const filteredTemplates = templates.filter((t) => {
    const haystack = `${t.name} ${t.desc}`.toLowerCase();
    return !globalQuery || haystack.includes(globalQuery);
  });

  const avgScore = Math.round(
    (filteredContentScores.reduce((a, b) => a + b.score, 0) / Math.max(1, filteredContentScores.length))
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Full-screen Studio Component */}
      <AEOStudio 
        isOpen={studioOpen} 
        onClose={() => setStudioOpen(false)} 
        initialTopic={activeTopic}
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Content Pieces", value: filteredContentScores.length.toString(), icon: <FileText size={16} strokeWidth={1.5} /> },
          { label: "Avg. AI Score", value: `${avgScore}/100`, icon: <BarChart3 size={16} strokeWidth={1.5} /> },
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
        {/* Content scores table */}
        <div className="col-span-2 card-hover rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Content Scores</h3>
              <p className="text-xs text-muted-foreground">AI optimization score for your pages</p>
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
              <div key={item.url} className={cn("group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/30", i < filteredContentScores.length - 1 && "border-b border-border/50")}>
                {/* Score circle */}
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
                  <button 
                    onClick={() => { setActiveTopic(item.title); setStudioOpen(true); }}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-secondary"
                  >
                    <ArrowRight size={12} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Templates */}
        <div className="card-hover rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-card-foreground">Content Templates</h3>
            <p className="text-xs text-muted-foreground">AI-optimized content frameworks</p>
          </div>
          <div className="flex flex-col gap-2">
            {filteredTemplates.map((t) => (
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

          <div className="mt-4 rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-4">
            <div className="flex items-center gap-2 mb-2">
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
