"use client";

import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface Competitor {
  name: string;
  visibility: number;
  mentions: number;
  shareOfVoice: number;
  position: number;
  change: number;
  isOwn?: boolean;
}

const competitors: Competitor[] = [
  {
    name: "Your Brand",
    visibility: 68,
    mentions: 466,
    shareOfVoice: 32,
    position: 1,
    change: 12,
    isOwn: true,
  },
  {
    name: "Competitor A",
    visibility: 72,
    mentions: 521,
    shareOfVoice: 35,
    position: 1,
    change: 5,
  },
  {
    name: "Competitor B",
    visibility: 54,
    mentions: 312,
    shareOfVoice: 18,
    position: 2,
    change: -8,
  },
  {
    name: "Competitor C",
    visibility: 41,
    mentions: 201,
    shareOfVoice: 10,
    position: 3,
    change: 2,
  },
  {
    name: "Competitor D",
    visibility: 38,
    mentions: 178,
    shareOfVoice: 5,
    position: 3,
    change: -1,
  },
];

export function CompetitorTable({
  items = competitors,
}: {
  items?: Competitor[];
}) {
  return (
    <div className="card-hover flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">
            Competitor Benchmarking
          </h3>
          <p className="text-xs text-muted-foreground">
            How you stack up against competitors
          </p>
        </div>
        <button className="nav-item rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
          View All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Brand
              </th>
              <th className="pb-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Visibility
              </th>
              <th className="pb-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Mentions
              </th>
              <th className="pb-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Share Of Voice
              </th>
              <th className="pb-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Avg Pos.
              </th>
              <th className="pb-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr
                key={c.name}
                className={cn(
                  "border-b border-border/50 transition-colors last:border-0 hover:bg-secondary/30",
                  c.isOwn && "bg-primary/4"
                )}
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        c.isOwn ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    />
                    <span
                      className={cn(
                        "font-medium",
                        c.isOwn ? "text-primary" : "text-foreground"
                      )}
                    >
                      {c.name}
                    </span>
                    {c.isOwn && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        You
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${c.visibility}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-foreground">
                      {c.visibility}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-right font-mono text-xs text-foreground">
                  {c.mentions.toLocaleString()}
                </td>
                <td className="py-3 text-right font-mono text-xs text-foreground">
                  {Math.round(c.shareOfVoice)}%
                </td>
                <td className="py-3 text-right font-mono text-xs text-foreground">
                  #{c.position}
                </td>
                <td className="py-3 text-right">
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 text-xs font-medium",
                      c.change > 0
                        ? "text-success"
                        : c.change < 0
                          ? "text-destructive"
                          : "text-muted-foreground"
                    )}
                  >
                    {c.change > 0 ? (
                      <ArrowUpRight size={12} />
                    ) : c.change < 0 ? (
                      <ArrowDownRight size={12} />
                    ) : (
                      <Minus size={12} />
                    )}
                    {Math.abs(c.change)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
