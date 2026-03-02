"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus, Search, Target, Users, TrendingUp } from "lucide-react";
import { useAnalyticsSection } from "@/lib/services/dashboard-analytics";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Tooltip,
} from "recharts";

const competitorPalette = [
  "#92B6B1", "#E5C39E", "#B199AF", "#9F9ADE", "#D4A373", 
  "#A3C4BC", "#D8A7B1", "#B6AD90", "#A9BCD0", "#D9AE94", 
  "#BFCC94", "#97A7B3", "#CAB8FF", "#FFD8BE", "#D1E5F0", 
  "#F2C6DE", "#C7D3D1", "#D0B8A8", "#B5C9C3", "#E0C3FC"
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
      <p className="mb-1.5 text-xs font-medium text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            <span className="text-muted-foreground">{entry.name || entry.dataKey}</span>
          </div>
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function CompetitorsPage() {
  const { data, error, refresh } = useAnalyticsSection<any>("competitors");
  const searchParams = useSearchParams();
  const globalQuery = (searchParams.get("q") || "").trim().toLowerCase();
  const competitorsData = Array.isArray(data?.competitors) && data.competitors.length > 0
    ? data.competitors.map((c: any, index: number) => ({
        name: c.isOwn ? "Your Brand" : c.name,
        visibility: Number(c.visibility ?? 0),
        mentions: Number(c.mentions ?? 0),
        shareOfVoice: Number(c.shareOfVoice ?? 0),
        sentiment: Number(c.sentiment ?? 50),
        avgPos: Number(c.avgPos ?? 0),
        change: Number(c.change ?? 0),
        color: competitorPalette[index % competitorPalette.length],
        isOwn: Boolean(c.isOwn),
      }))
    : [];
  const filteredCompetitorsData = useMemo(
    () =>
      competitorsData.filter((c: any) => {
        const haystack = `${c.name} ${c.visibility} ${c.mentions} ${c.shareOfVoice}`.toLowerCase();
        return !globalQuery || haystack.includes(globalQuery);
      }),
    [competitorsData, globalQuery]
  );
  const own = filteredCompetitorsData.find((c: any) => c.isOwn);
  const top = filteredCompetitorsData.find((c: any) => !c.isOwn);
  const summary = data?.summary || {};

  const radarFromData = filteredCompetitorsData.slice(0, 4);
  const radarLabels = ["Visibility", "Mentions", "Sentiment", "Position", "Coverage"];
  const dynamicRadarData = radarLabels.map((metric) => {
    const row: any = { metric };
    radarFromData.forEach((c: any) => {
      if (metric === "Visibility") row[c.name] = c.visibility;
      if (metric === "Mentions") row[c.name] = Math.min(100, c.mentions);
      if (metric === "Sentiment") row[c.name] = c.sentiment;
      if (metric === "Position") row[c.name] = Math.max(0, 100 - c.avgPos * 10);
      if (metric === "Coverage") row[c.name] = c.shareOfVoice;
    });
    return row;
  });

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={refresh} className="underline underline-offset-2">Retry</button>
        </div>
      )}
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Tracked Competitors", value: String(summary.trackedCompetitors ?? Math.max(0, filteredCompetitorsData.length - 1)), icon: <Users size={16} strokeWidth={1.5} /> },
          { label: "Your Rank", value: summary.yourRank ? `#${summary.yourRank}` : "-", change: 0, icon: <TrendingUp size={16} strokeWidth={1.5} /> },
          { label: "Visibility Gap", value: `${Math.round(Number(summary.visibilityGap ?? (own && top ? own.visibility - top.visibility : 0)))}pts`, icon: <Target size={16} strokeWidth={1.5} /> },
          { label: "Compared Brands", value: String(filteredCompetitorsData.length), icon: <Search size={16} strokeWidth={1.5} /> },
        ].map((stat) => (
          <div key={stat.label} className="card-hover flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8 text-primary">
              {stat.icon}
            </div>
            <div>
              <span className="text-xl font-semibold text-foreground">{stat.value}</span>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Radar comparison */}
        <div className="col-span-2 card-hover rounded-xl border border-border bg-card p-5">
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-card-foreground">Competitive Radar</h3>
            <p className="text-xs text-muted-foreground">Multi-dimensional comparison</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            {radarFromData.slice(0, 4).map((c: any, i: number) => (
              <div key={c.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-[10px] text-muted-foreground">{c.name}</span>
              </div>
            ))}
          </div>
          <div className="h-[280px] w-full">
            {radarFromData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No competitor radar data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={dynamicRadarData}>
                  <PolarGrid stroke="#E8E4E0" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "#000000" }} />
                  {radarFromData[0] && <Radar name={radarFromData[0].name} dataKey={radarFromData[0].name} stroke={radarFromData[0].color} fill={radarFromData[0].color} fillOpacity={0.15} strokeWidth={2} />}
                  {radarFromData[1] && <Radar name={radarFromData[1].name} dataKey={radarFromData[1].name} stroke={radarFromData[1].color} fill={radarFromData[1].color} fillOpacity={0.08} strokeWidth={1.5} />}
                  {radarFromData[2] && <Radar name={radarFromData[2].name} dataKey={radarFromData[2].name} stroke={radarFromData[2].color} fill="none" strokeWidth={1.5} strokeDasharray="4 4" />}
                  {radarFromData[3] && <Radar name={radarFromData[3].name} dataKey={radarFromData[3].name} stroke={radarFromData[3].color} fill="none" strokeWidth={1} strokeDasharray="2 2" />}
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Competitor table */}
        <div className="col-span-3 card-hover rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Competitor Rankings</h3>
              <p className="text-xs text-muted-foreground">Detailed benchmarking</p>
            </div>
            <button className="nav-item rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              Add Competitor
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Brand", "Visibility", "Mentions", "Share of Voice", "Sentiment", "Avg Pos.", "7d Change"].map((h) => (
                    <th key={h} className="pb-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground first:pr-4 last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCompetitorsData.length === 0 ? (
                  <tr>
                    <td className="py-6 text-xs text-muted-foreground" colSpan={7}>No competitor data yet.</td>
                  </tr>
                ) : filteredCompetitorsData.map((c: any) => (
                  <tr key={c.name} className={cn("border-b border-border/50 last:border-0 hover:bg-secondary/30", c.name === "Your Brand" && "bg-primary/[0.03]")}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className={cn("text-xs font-medium", c.name === "Your Brand" ? "text-primary" : "text-foreground")}>{c.name}</span>
                        {c.name === "Your Brand" && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">You</span>}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-10 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${c.visibility}%` }} />
                        </div>
                        <span className="font-mono text-xs">{c.visibility}</span>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs">{c.mentions.toLocaleString()}</td>
                    <td className="py-3 font-mono text-xs">{`${Math.round(c.shareOfVoice)}%`}</td>
                    <td className="py-3">
                      <span className={cn("text-xs font-medium", c.sentiment >= 70 ? "text-success" : "text-warning")}>{c.sentiment}%</span>
                    </td>
                    <td className="py-3 font-mono text-xs">#{c.avgPos}</td>
                    <td className="py-3 text-right">
                      <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", c.change > 0 ? "text-success" : c.change < 0 ? "text-destructive" : "text-muted-foreground")}>
                        {c.change > 0 ? <ArrowUpRight size={12} /> : c.change < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}
                        {Math.abs(c.change)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
