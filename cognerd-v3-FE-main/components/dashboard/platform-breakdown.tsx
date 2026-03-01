"use client";

import { cn } from "@/lib/utils";

interface PlatformData {
  name: string;
  score: number;
  mentions: number;
  citations: number;
  sentiment: "positive" | "neutral" | "negative";
  change: number;
  color: string;
}

const platforms: PlatformData[] = [
  {
    name: "ChatGPT",
    score: 68,
    mentions: 142,
    citations: 87,
    sentiment: "positive",
    change: 12,
    color: "#10A37F",
  },
  {
    name: "Gemini",
    score: 48,
    mentions: 89,
    citations: 54,
    sentiment: "neutral",
    change: 8,
    color: "#1A73E8",
  },
  {
    name: "Perplexity",
    score: 58,
    mentions: 116,
    citations: 92,
    sentiment: "positive",
    change: -3,
    color: "#20C2D5",
  },
  {
    name: "AI Overviews",
    score: 42,
    mentions: 67,
    citations: 41,
    sentiment: "neutral",
    change: 15,
    color: "#F9AB00",
  },
  {
    name: "Claude",
    score: 35,
    mentions: 52,
    citations: 28,
    sentiment: "positive",
    change: 22,
    color: "#D97757",
  },
];

const sentimentColors = {
  positive: "text-success",
  neutral: "text-warning",
  negative: "text-destructive",
};

const sentimentDots = {
  positive: "bg-success",
  neutral: "bg-warning",
  negative: "bg-destructive",
};

export function PlatformBreakdown({
  items = platforms,
}: {
  items?: PlatformData[];
}) {
  return (
    <div className="card-hover flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h3 className="text-sm font-semibold text-card-foreground">
          Platform Breakdown
        </h3>
        <p className="text-xs text-muted-foreground">
          Visibility across AI engines
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((platform) => (
          <div
            key={platform.name}
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/50"
          >
            {/* Score indicator */}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#F5F0EB"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke={platform.color}
                  strokeWidth="3"
                  strokeDasharray={`${platform.score * 0.942} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[11px] font-semibold text-foreground">
                {platform.score}
              </span>
            </div>

            {/* Info */}
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {platform.name}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    platform.change >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {platform.change >= 0 ? "+" : ""}
                  {platform.change}%
                </span>
              </div>
              <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                <span>{platform.mentions} mentions</span>
                <span className="text-border">|</span>
                <span>{platform.citations} citations</span>
                <span className="text-border">|</span>
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      sentimentDots[platform.sentiment]
                    )}
                  />
                  <span className={sentimentColors[platform.sentiment]}>
                    {platform.sentiment}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
