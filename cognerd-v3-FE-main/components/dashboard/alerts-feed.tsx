"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, Zap, MessageSquare } from "lucide-react";

interface Alert {
  id: string;
  type: "visibility_drop" | "visibility_spike" | "new_mention" | "competitor" | "sentiment";
  title: string;
  description: string;
  time: string;
  read: boolean;
}

const alerts: Alert[] = [
  {
    id: "1",
    type: "visibility_spike",
    title: "Visibility spike on ChatGPT",
    description: "Your brand visibility increased 23% in the last 24h for product-related queries.",
    time: "12m ago",
    read: false,
  },
  {
    id: "2",
    type: "competitor",
    title: "Competitor A gaining in Gemini",
    description: "Competitor A overtook your position in 8 prompts related to 'best analytics tools'.",
    time: "1h ago",
    read: false,
  },
  {
    id: "3",
    type: "visibility_drop",
    title: "Drop detected in AI Overviews",
    description: "Citations from your blog dropped 15% in Google AI Overviews this week.",
    time: "3h ago",
    read: false,
  },
  {
    id: "4",
    type: "new_mention",
    title: "New brand mention in Perplexity",
    description: "Your brand was cited in a comparison query about SEO monitoring tools.",
    time: "5h ago",
    read: true,
  },
  {
    id: "5",
    type: "sentiment",
    title: "Sentiment shift detected",
    description: "Positive sentiment ratio improved from 62% to 78% across all platforms.",
    time: "8h ago",
    read: true,
  },
];

const alertIcons = {
  visibility_drop: <TrendingDown size={14} strokeWidth={1.5} />,
  visibility_spike: <TrendingUp size={14} strokeWidth={1.5} />,
  new_mention: <MessageSquare size={14} strokeWidth={1.5} />,
  competitor: <Zap size={14} strokeWidth={1.5} />,
  sentiment: <AlertTriangle size={14} strokeWidth={1.5} />,
};

const alertColors = {
  visibility_drop: "bg-destructive/8 text-destructive",
  visibility_spike: "bg-success/8 text-success",
  new_mention: "bg-primary/8 text-primary",
  competitor: "bg-warning/8 text-warning",
  sentiment: "bg-primary/8 text-primary",
};

export function AlertsFeed({
  items = alerts,
}: {
  items?: Alert[];
}) {
  const unreadCount = items.filter((a) => !a.read).length;

  return (
    <div className="card-hover flex flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Recent Alerts</h3>
          <p className="text-xs text-muted-foreground">Monitoring notifications</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
            {unreadCount}
          </span>
          <button className="nav-item rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
            View All
          </button>
        </div>
      </div>

      <div className="flex flex-col">
        {items.map((alert, i) => (
          <div
            key={alert.id}
            className={cn(
              "flex gap-3 px-5 py-3.5 transition-colors hover:bg-secondary/30",
              i < items.length - 1 && "border-b border-border/50",
              !alert.read && "bg-primary/[0.02]"
            )}
          >
            <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", alertColors[alert.type])}>
              {alertIcons[alert.type]}
            </div>
            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-medium text-foreground", !alert.read && "font-semibold")}>
                  {alert.title}
                </span>
                {!alert.read && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                )}
              </div>
              <p className="truncate text-[11px] leading-relaxed text-muted-foreground">
                {alert.description}
              </p>
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground/60">{alert.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
