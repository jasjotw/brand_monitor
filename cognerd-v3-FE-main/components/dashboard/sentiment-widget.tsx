"use client";

import { cn } from "@/lib/utils";

interface SentimentData {
  platform: string;
  positive: number;
  neutral: number;
  negative: number;
}

const sentimentData: SentimentData[] = [
  { platform: "ChatGPT", positive: 72, neutral: 20, negative: 8 },
  { platform: "Gemini", positive: 58, neutral: 30, negative: 12 },
  { platform: "Perplexity", positive: 80, neutral: 15, negative: 5 },
  { platform: "AI Overviews", positive: 45, neutral: 40, negative: 15 },
  { platform: "Claude", positive: 68, neutral: 25, negative: 7 },
];

export function SentimentWidget({
  items = sentimentData,
}: {
  items?: SentimentData[];
}) {
  const avgPositive = items.length > 0
    ? Math.round(items.reduce((a, b) => a + b.positive, 0) / items.length)
    : 0;

  return (
    <div className="card-hover flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Sentiment Analysis</h3>
          <p className="text-xs text-muted-foreground">Brand perception across AI responses</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-success/8 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-[12px] font-medium text-success">{avgPositive}% positive</span>
        </div>
      </div>

      {/* Sentiment legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-[12px] text-muted-foreground">Positive</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-warning" />
          <span className="text-[12px] text-muted-foreground">Neutral</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          <span className="text-[12px] text-muted-foreground">Negative</span>
        </div>
      </div>

      {/* Stacked bars */}
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.platform} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{item.platform}</span>
              <span className="text-[12px] text-muted-foreground">
                {item.positive}% / {item.neutral}% / {item.negative}%
              </span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-l-full bg-success transition-all duration-500"
                style={{ width: `${item.positive}%` }}
              />
              <div
                className="h-full bg-warning transition-all duration-500"
                style={{ width: `${item.neutral}%` }}
              />
              <div
                className="h-full rounded-r-full bg-destructive transition-all duration-500"
                style={{ width: `${item.negative}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
