"use client";

import { cn } from "@/lib/utils";
import { Search, TrendingUp, TrendingDown, Eye, Users, MessageSquare, Filter, BarChart3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useAnalyticsSection } from "@/lib/services/dashboard-analytics";

const sentimentColors = { positive: "text-success", neutral: "text-warning", negative: "text-destructive" };

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
      <p className="mb-1.5 text-xs font-medium text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.fill }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function PromptsPage() {
  const { data, error, refresh } = useAnalyticsSection<any>("prompts");
  const summary = data?.summary || {};
  const categories = Array.isArray(data?.categories) && data.categories.length > 0
    ? data.categories.map((c: any) => ({
        category: String(c.category),
        count: Number(c.count ?? 0),
        visibility: Number(c.avgVisibility ?? 0),
        trend: 0,
      }))
    : [];
  const promptRows = Array.isArray(data?.prompts) && data.prompts.length > 0
    ? data.prompts.map((p: any) => ({
        prompt: p.prompt,
        volume: "-",
        platform: Array.isArray(p.providers) ? p.providers.join(", ") : "-",
        visibility: Math.round(Number(p.visibility ?? 0)),
        position: p.avgPosition ?? "-",
        sentiment: p.sentiment === "negative" || p.sentiment === "neutral" ? p.sentiment : "positive",
        trending: Boolean(p.trending),
      }))
    : [];
  const trendSeries = Array.isArray(data?.promptPerformanceTrend) && data.promptPerformanceTrend.length > 0
    ? data.promptPerformanceTrend.map((item: any, idx: number) => ({
        day: new Date(item.timestamp || Date.now()).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        volume: Number(item.totalPrompts ?? 0),
        visible: Number(item.visiblePrompts ?? 0),
        _i: idx,
      }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={refresh} className="underline underline-offset-2">Retry</button>
        </div>
      )}
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Tracked Prompts", value: String(summary.trackedPrompts ?? promptRows.length), icon: <MessageSquare size={16} strokeWidth={1.5} /> },
          { label: "Avg. Visibility", value: `${Math.round(Number(summary.avgVisibility ?? 0))}%`, icon: <Eye size={16} strokeWidth={1.5} /> },
          { label: "Run Prompt Volume", value: String(trendSeries[trendSeries.length - 1]?.volume ?? 0), icon: <BarChart3 size={16} strokeWidth={1.5} /> },
          { label: "Audience Segments", value: String(summary.audienceSegments ?? categories.length), icon: <Users size={16} strokeWidth={1.5} /> },
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

      <div className="grid grid-cols-5 gap-6">
        {/* Volume chart */}
        <div className="col-span-3 card-hover rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Prompt Volume</h3>
              <p className="text-xs text-muted-foreground">Total prompts vs visible prompts this week</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#ECA17A" }} /><span className="text-[11px] text-muted-foreground">Total</span></div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#FFD5B5" }} /><span className="text-[11px] text-muted-foreground">Visible</span></div>
            </div>
          </div>
          <div className="h-[240px] w-full">
            {trendSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No prompt trend data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendSeries} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E4E0" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#000000" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#000000" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="volume" name="Total Volume" fill="#ECA17A" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="visible" name="Visible" fill="#FFD5B5" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="col-span-2 card-hover rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-card-foreground">Prompt Categories</h3>
            <p className="text-xs text-muted-foreground">Audience intent breakdown</p>
          </div>
          <div className="flex flex-col gap-2">
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground">No prompt category data yet.</p>
            ) : categories.map((cat: any) => (
              <div key={cat.category} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/30">
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{cat.category}</span>
                    <span className={cn("text-[11px] font-medium", cat.trend >= 0 ? "text-success" : "text-destructive")}>
                      {cat.trend >= 0 ? "+" : ""}{cat.trend}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{cat.count} prompts</span>
                    <span className="text-border">|</span>
                    <span>{cat.visibility}% visibility</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${cat.visibility}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full prompt table */}
      <div className="card-hover rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">All Tracked Prompts</h3>
            <p className="text-xs text-muted-foreground">Prompt-level analytics from analysis runs (search volume hidden)</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="nav-item flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Filter size={11} strokeWidth={1.5} />
              Filter
            </button>
            <button className="nav-item rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              Export
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
              {["Prompt", "Platform", "Visibility", "Position", "Sentiment", "Trending"].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {promptRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-xs text-muted-foreground" colSpan={6}>No prompt analytics data yet.</td>
                </tr>
              ) : promptRows.map((p: any, i: number) => (
                <tr key={i} className={cn("border-b border-border/50 last:border-0 hover:bg-secondary/30")}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Search size={12} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">{p.prompt}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-foreground">{p.platform}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${p.visibility}%` }} />
                      </div>
                      <span className="font-mono text-xs">{p.visibility}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{p.position === "-" ? "-" : `#${p.position}`}</td>
                  <td className="px-5 py-3">
                    <span className={cn("text-xs font-medium capitalize", sentimentColors[(p.sentiment as "positive" | "neutral" | "negative") || "neutral"])}>{p.sentiment}</span>
                  </td>
                  <td className="px-5 py-3">
                    {p.trending ? <TrendingUp size={14} strokeWidth={1.5} className="text-success" /> : <span className="text-[11px] text-muted-foreground">--</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
