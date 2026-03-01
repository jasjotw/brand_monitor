"use client";

import { cn } from "@/lib/utils";
import { Search, TrendingUp } from "lucide-react";

interface PromptItem {
  prompt: string;
  volume: string;
  visibility: number;
  position: number;
  trending: boolean;
}

const topPrompts: PromptItem[] = [
  {
    prompt: "best seo monitoring tools 2026",
    volume: "12.4k",
    visibility: 82,
    position: 1,
    trending: true,
  },
  {
    prompt: "how to track ai visibility",
    volume: "8.7k",
    visibility: 74,
    position: 2,
    trending: true,
  },
  {
    prompt: "ai search optimization platform",
    volume: "6.2k",
    visibility: 68,
    position: 1,
    trending: false,
  },
  {
    prompt: "chatgpt brand monitoring",
    volume: "5.8k",
    visibility: 55,
    position: 3,
    trending: true,
  },
  {
    prompt: "aeo vs seo differences",
    volume: "4.1k",
    visibility: 42,
    position: 4,
    trending: false,
  },
  {
    prompt: "perplexity analytics for brands",
    volume: "3.5k",
    visibility: 38,
    position: 2,
    trending: false,
  },
];

export function PromptAnalyticsWidget({
  items = topPrompts,
}: {
  items?: PromptItem[];
}) {
  return (
    <div className="card-hover flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Top Prompts</h3>
          <p className="text-xs text-muted-foreground">Queries where your brand appears</p>
        </div>
        <button className="nav-item rounded-lg border border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
          Explore
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <div
            key={item.prompt}
            className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/30"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Search size={12} strokeWidth={1.5} className="text-muted-foreground" />
            </div>

            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium text-foreground">
                  {item.prompt}
                </span>
                {item.trending && (
                  <TrendingUp size={10} strokeWidth={2} className="shrink-0 text-success" />
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{item.volume} vol.</span>
                <span className="text-border">|</span>
                <span>Pos #{item.position}</span>
              </div>
            </div>

            {/* Mini visibility bar */}
            <div className="flex shrink-0 items-center gap-2">
              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${item.visibility}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-[12px] font-medium text-foreground">
                {item.visibility}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
