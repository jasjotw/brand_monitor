"use client";

import { cn } from "@/lib/utils";
import { Eye, Globe, TrendingUp, TrendingDown, Search, ExternalLink, Filter, ArrowUpRight } from "lucide-react";
import { useAnalyticsSection } from "@/lib/services/dashboard-analytics";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
      <p className="mb-1.5 text-xs font-medium text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

const typeColors: Record<string, string> = {
  Explicit: "bg-primary/10 text-primary",
  Citation: "bg-success/10 text-success",
  Implicit: "bg-warning/10 text-warning",
};

export function VisibilityPage() {
  const { data, loading, error, refresh } = useAnalyticsSection<any>("visibility");
  const summary = data?.summary || {};
  const dailySeries = Array.isArray(data?.dailyTrend) ? data.dailyTrend : [];
  const platformSeries = Array.isArray(data?.mentionsByProvider) ? data.mentionsByProvider : [];
  const recentSeries = Array.isArray(data?.recentMentions) ? data.recentMentions : [];
  const regionsSeries = Array.isArray(data?.regionalVisibility) && data.regionalVisibility.length > 0
    ? data.regionalVisibility
    : [];

  const prevPoint = dailySeries.length > 1 ? dailySeries[dailySeries.length - 2] : null;
  const lastPoint = dailySeries.length > 0 ? dailySeries[dailySeries.length - 1] : null;
  const pct = (curr?: number, prev?: number) => {
    if (!Number.isFinite(curr) || !Number.isFinite(prev) || !prev) return 0;
    return Math.round(((Number(curr) - Number(prev)) / Number(prev)) * 100);
  };

  const statCards = [
    {
      label: "Visibility Score",
      value: String(summary.visibilityScore ?? lastPoint?.score ?? 0),
      change: pct(summary.visibilityScore ?? lastPoint?.score, prevPoint?.score),
      icon: <Eye size={16} strokeWidth={1.5} />,
    },
    {
      label: "Total Mentions",
      value: String(summary.totalMentions ?? lastPoint?.mentions ?? 0),
      change: pct(summary.totalMentions ?? lastPoint?.mentions, prevPoint?.mentions),
      icon: <Globe size={16} strokeWidth={1.5} />,
    },
    {
      label: "Citations",
      value: String(summary.citations ?? lastPoint?.citations ?? 0),
      change: pct(summary.citations ?? lastPoint?.citations, prevPoint?.citations),
      icon: <ExternalLink size={16} strokeWidth={1.5} />,
    },
    {
      label: "Avg. Position",
      value: `#${summary.averagePosition ?? "-"}`,
      change: 0,
      icon: <TrendingUp size={16} strokeWidth={1.5} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={refresh} className="underline underline-offset-2">Retry</button>
        </div>
      )}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">Loading visibility analytics...</div>
      ) : null}
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="card-hover flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8 text-primary">
                {stat.icon}
              </div>
              <span className={cn("text-xs font-medium", Number(stat.change) >= 0 ? "text-success" : "text-destructive")}>
                {Number(stat.change) >= 0 ? "+" : ""}{stat.change}%
              </span>
            </div>
            <div>
              <span className="text-xl font-semibold text-foreground">{stat.value}</span>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Visibility trend - full width */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Daily Visibility Trend</h3>
            <p className="text-xs text-muted-foreground">Score, mentions, and citations over time</p>
          </div>
          <div className="flex items-center gap-4">
            {[
              { key: "score", label: "Score", color: "#9F9ADE" },
              { key: "mentions", label: "Mentions", color: "#B199AF" },
              { key: "citations", label: "Citations", color: "#D4A373" },
            ].map((l) => (
              <div key={l.key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-[11px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-[280px] w-full">
          {dailySeries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No visibility trend data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySeries} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4E0" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#000000" }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#000000" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="score" name="Score" stroke="#9F9ADE" strokeWidth={2} fill="none" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#FFFFFF" }} />
                <Area type="monotone" dataKey="mentions" name="Mentions" stroke="#B199AF" strokeWidth={2} fill="none" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#FFFFFF" }} />
                <Area type="monotone" dataKey="citations" name="Citations" stroke="#D4A373" strokeWidth={1.5} fill="none" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#FFFFFF" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Mentions by platform */}
        <div className="col-span-2 card-hover rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-card-foreground">Mentions by Platform</h3>
            <p className="text-xs text-muted-foreground">Explicit vs implicit mentions</p>
          </div>
          <div className="h-[240px] w-full">
            {platformSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No platform mention data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformSeries} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E4E0" strokeOpacity={0.5} horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#000000" }} />
                  <YAxis dataKey="platform" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#2D2A26" }} width={85} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="explicit" name="Explicit" fill="#ECA17A" radius={[0, 4, 4, 0]} barSize={10} />
                  <Bar dataKey="implicit" name="Implicit" fill="#FFD5B5" radius={[0, 4, 4, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent mentions */}
        <div className="col-span-3 card-hover rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Recent Mentions</h3>
              <p className="text-xs text-muted-foreground">Latest AI responses mentioning your brand</p>
            </div>
            <button className="nav-item flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Filter size={11} strokeWidth={1.5} />
              Filter
            </button>
          </div>
          <div className="flex flex-col">
            {recentSeries.length === 0 ? (
              <div className="px-5 py-4 text-xs text-muted-foreground">No recent mentions found.</div>
            ) : recentSeries.map((mention: any, i: number) => (
              <div key={i} className={cn("flex items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/30", i < recentSeries.length - 1 && "border-b border-border/50")}>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Search size={12} strokeWidth={1.5} className="text-muted-foreground" />
                </div>
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  <span className="truncate text-xs font-medium text-foreground">{mention.prompt}</span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{mention.platform}</span>
                    <span className="text-border">|</span>
                    <span>Pos #{mention.position}</span>
                    <span className="text-border">|</span>
                    <span>{mention.time}</span>
                  </div>
                </div>
                <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium", typeColors[mention.type])}>
                  {mention.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {regionsSeries.length > 0 && (
        <div className="card-hover rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-card-foreground">Regional Visibility</h3>
            <p className="text-xs text-muted-foreground">Geographic segmentation of AI visibility data</p>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {regionsSeries.map((r: any) => (
              <div key={r.region} className="flex flex-col gap-2 rounded-lg border border-border p-3.5 transition-colors hover:bg-secondary/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{r.region}</span>
                  <span className={cn("text-[11px] font-medium", r.change >= 0 ? "text-success" : "text-destructive")}>
                    {r.change >= 0 ? "+" : ""}{r.change}%
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-semibold text-foreground">{r.score}</span>
                  <span className="mb-0.5 text-[11px] text-muted-foreground">/100</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${r.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
