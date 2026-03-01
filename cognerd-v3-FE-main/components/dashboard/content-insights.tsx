"use client";

import { cn } from "@/lib/utils";
import { FileText, Lightbulb, ArrowRight } from "lucide-react";

interface ContentItem {
  title: string;
  type: "opportunity" | "optimize" | "create";
  score: number;
  impact: "high" | "medium" | "low";
  description: string;
}

const contentItems: ContentItem[] = [
  {
    title: "Best analytics tools comparison",
    type: "create",
    score: 92,
    impact: "high",
    description: "High-volume prompt with no brand presence. Create a comparison guide.",
  },
  {
    title: "How to track AI visibility",
    type: "optimize",
    score: 78,
    impact: "high",
    description: "Existing content ranks #3. Optimize for better AI citations.",
  },
  {
    title: "SEO monitoring alternatives",
    type: "opportunity",
    score: 85,
    impact: "medium",
    description: "Competitors dominate this query. Gap analysis shows opportunity.",
  },
  {
    title: "AI search optimization guide",
    type: "optimize",
    score: 65,
    impact: "medium",
    description: "Content is cited but not in top positions. Needs structure update.",
  },
];

const typeLabels = {
  opportunity: { label: "Opportunity", color: "bg-primary/10 text-primary" },
  optimize: { label: "Optimize", color: "bg-warning/10 text-warning" },
  create: { label: "Create", color: "bg-success/10 text-success" },
};

const impactColors = {
  high: "text-success",
  medium: "text-warning",
  low: "text-muted-foreground",
};

export function ContentInsights() {
  return (
    <div className="card-hover flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Content Insights</h3>
          <p className="text-xs text-muted-foreground">Opportunities to improve AI visibility</p>
        </div>
        <button className="nav-item flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Lightbulb size={12} strokeWidth={1.5} />
          <span>4 insights</span>
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {contentItems.map((item) => (
          <div
            key={item.title}
            className="group flex items-start gap-3 rounded-lg border border-transparent p-3 transition-all hover:border-border hover:bg-secondary/30"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <FileText size={14} strokeWidth={1.5} className="text-foreground" />
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-medium text-foreground">{item.title}</span>
                <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium", typeLabels[item.type].color)}>
                  {typeLabels[item.type].label}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{item.description}</p>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-muted-foreground">
                  Score: <span className="font-medium text-foreground">{item.score}/100</span>
                </span>
                <span className="text-border">|</span>
                <span className={cn("font-medium capitalize", impactColors[item.impact])}>
                  {item.impact} impact
                </span>
              </div>
            </div>
            <button className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-secondary">
              <ArrowRight size={12} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
