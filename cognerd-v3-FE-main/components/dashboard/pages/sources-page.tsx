"use client";

import { cn } from "@/lib/utils";
import { ExternalLink, Link2, TrendingUp, Globe, FileText, BarChart3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";

const topSources = [
  { page: "AI Analytics Complete Guide", url: "/blog/ai-analytics-guide", mentions: 89, citations: 67, platforms: ["ChatGPT", "Perplexity", "Claude"], traffic: 2340, trend: 18 },
  { page: "Product - Monitoring", url: "/products/monitoring", mentions: 72, citations: 58, platforms: ["ChatGPT", "Gemini"], traffic: 1890, trend: 12 },
  { page: "SEO vs AEO Guide", url: "/blog/seo-vs-aeo", mentions: 54, citations: 41, platforms: ["Perplexity", "AI Overviews"], traffic: 1420, trend: -3 },
  { page: "Enterprise Case Study", url: "/case-studies/enterprise", mentions: 38, citations: 22, platforms: ["ChatGPT"], traffic: 780, trend: -8 },
  { page: "API Reference Docs", url: "/docs/api-reference", mentions: 31, citations: 28, platforms: ["Perplexity", "Claude"], traffic: 560, trend: 25 },
  { page: "Getting Started Tutorial", url: "/docs/getting-started", mentions: 28, citations: 19, platforms: ["ChatGPT", "Gemini"], traffic: 420, trend: 32 },
  { page: "Pricing Page", url: "/pricing", mentions: 22, citations: 15, platforms: ["ChatGPT"], traffic: 1100, trend: 5 },
  { page: "About Us", url: "/about", mentions: 15, citations: 8, platforms: ["Perplexity"], traffic: 320, trend: -2 },
];

const referralData = [
  { source: "ChatGPT", visits: 3420, color: "#10A37F" },
  { source: "Perplexity", visits: 2180, color: "#20C2D5" },
  { source: "Gemini", visits: 1540, color: "#1A73E8" },
  { source: "AI Overviews", visits: 980, color: "#F9AB00" },
  { source: "Claude", visits: 620, color: "#D97757" },
];

const trafficByDay = [
  { day: "Mon", chatgpt: 520, perplexity: 340, gemini: 220, other: 180 },
  { day: "Tue", chatgpt: 580, perplexity: 380, gemini: 250, other: 200 },
  { day: "Wed", chatgpt: 620, perplexity: 420, gemini: 280, other: 220 },
  { day: "Thu", chatgpt: 560, perplexity: 390, gemini: 240, other: 190 },
  { day: "Fri", chatgpt: 490, perplexity: 310, gemini: 200, other: 160 },
  { day: "Sat", chatgpt: 320, perplexity: 190, gemini: 140, other: 100 },
  { day: "Sun", chatgpt: 280, perplexity: 160, gemini: 120, other: 90 },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
      <p className="mb-1.5 text-xs font-medium text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.fill || entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function SourcesPage() {
  const totalTraffic = referralData.reduce((a, b) => a + b.visits, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Tracked Pages", value: topSources.length.toString(), icon: <FileText size={16} strokeWidth={1.5} /> },
          { label: "Total Citations", value: topSources.reduce((a, b) => a + b.citations, 0).toString(), icon: <Link2 size={16} strokeWidth={1.5} /> },
          { label: "AI Referral Traffic", value: `${(totalTraffic / 1000).toFixed(1)}k`, icon: <Globe size={16} strokeWidth={1.5} /> },
          { label: "Traffic Growth", value: "+18%", icon: <TrendingUp size={16} strokeWidth={1.5} /> },
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
        {/* Traffic by platform donut */}
        <div className="col-span-2 card-hover rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-card-foreground">AI Referral Sources</h3>
            <p className="text-xs text-muted-foreground">Traffic originating from AI platforms</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative h-[160px] w-[160px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={referralData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="visits" nameKey="source" strokeWidth={0}>
                    {referralData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-foreground">{(totalTraffic / 1000).toFixed(1)}k</span>
                <span className="text-[10px] text-muted-foreground">total visits</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {referralData.map((r) => (
                <div key={r.source} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="text-xs text-foreground">{r.source}</span>
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">{r.visits.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Daily traffic chart */}
        <div className="col-span-3 card-hover rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Daily AI Referral Traffic</h3>
              <p className="text-xs text-muted-foreground">Visits from AI platforms this week</p>
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trafficByDay} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E4E0" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#000000" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#000000" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="chatgpt" name="ChatGPT" stackId="a" fill="#10A37F" barSize={24} />
                <Bar dataKey="perplexity" name="Perplexity" stackId="a" fill="#20C2D5" />
                <Bar dataKey="gemini" name="Gemini" stackId="a" fill="#1A73E8" />
                <Bar dataKey="other" name="Other" stackId="a" fill="#6B7280" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* All sources table */}
      <div className="card-hover rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">All Source Pages</h3>
            <p className="text-xs text-muted-foreground">Pages driving AI mentions and traffic</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Page", "Mentions", "Citations", "Platforms", "AI Traffic", "Trend"].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topSources.map((s, i) => (
                <tr key={s.url} className="border-b border-border/50 last:border-0 hover:bg-secondary/30">
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">{s.page}</span>
                        <ExternalLink size={10} strokeWidth={1.5} className="text-muted-foreground" />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{s.url}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{s.mentions}</td>
                  <td className="px-5 py-3 font-mono text-xs">{s.citations}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.platforms.map((p) => (
                        <span key={p} className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-foreground">{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{s.traffic.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={cn("text-xs font-medium", s.trend >= 0 ? "text-success" : "text-destructive")}>
                      {s.trend >= 0 ? "+" : ""}{s.trend}%
                    </span>
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
