"use client";

import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface Source {
  url: string;
  page: string;
  mentions: number;
  citations: number;
  platforms: string[];
  trend: "up" | "down" | "stable";
}

const sources: Source[] = [
  {
    url: "acme.com/blog/ai-analytics-guide",
    page: "AI Analytics Guide",
    mentions: 89,
    citations: 67,
    platforms: ["ChatGPT", "Perplexity", "Claude"],
    trend: "up",
  },
  {
    url: "acme.com/products/monitoring",
    page: "Product - Monitoring",
    mentions: 72,
    citations: 58,
    platforms: ["ChatGPT", "Gemini"],
    trend: "up",
  },
  {
    url: "acme.com/blog/seo-vs-aeo",
    page: "SEO vs AEO Complete Guide",
    mentions: 54,
    citations: 41,
    platforms: ["Perplexity", "AI Overviews"],
    trend: "stable",
  },
  {
    url: "acme.com/case-studies/enterprise",
    page: "Enterprise Case Study",
    mentions: 38,
    citations: 22,
    platforms: ["ChatGPT"],
    trend: "down",
  },
  {
    url: "acme.com/docs/api-reference",
    page: "API Reference",
    mentions: 31,
    citations: 28,
    platforms: ["Perplexity", "Claude"],
    trend: "up",
  },
];

const trendIndicators = {
  up: { symbol: "\u2191", color: "text-success" },
  down: { symbol: "\u2193", color: "text-destructive" },
  stable: { symbol: "\u2192", color: "text-muted-foreground" },
};

export function SourceAttribution({
  items = sources,
}: {
  items?: Source[];
}) {
  return (
    <div className="card-hover flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Top Sources</h3>
          <p className="text-xs text-muted-foreground">Pages driving AI visibility</p>
        </div>
        <button className="nav-item rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
          All Sources
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {items.map((source, i) => (
          <div
            key={source.url}
            className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/30"
          >
            {/* Rank */}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold text-foreground">
              {i + 1}
            </span>

            {/* Info */}
            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium text-foreground">{source.page}</span>
                <ExternalLink size={10} strokeWidth={1.5} className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <span className="truncate text-[10px] text-muted-foreground">{source.url}</span>
            </div>

            {/* Stats */}
            <div className="flex shrink-0 items-center gap-4 text-[11px]">
              <div className="flex flex-col items-end">
                <span className="font-medium text-foreground">{source.mentions}</span>
                <span className="text-[10px] text-muted-foreground">mentions</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-medium text-foreground">{source.citations}</span>
                <span className="text-[10px] text-muted-foreground">citations</span>
              </div>
              <span className={cn("text-sm font-medium", trendIndicators[source.trend].color)}>
                {trendIndicators[source.trend].symbol}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
