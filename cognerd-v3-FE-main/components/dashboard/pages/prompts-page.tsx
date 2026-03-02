"use client";

import { Fragment, ReactNode, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search, TrendingUp, Eye, Users, MessageSquare, Filter, BarChart3 } from "lucide-react";
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
  const searchParams = useSearchParams();
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [trendingFilter, setTrendingFilter] = useState("all");
  const globalQuery = (searchParams.get("q") || "").trim().toLowerCase();
  const globalPlatform = (searchParams.get("platform") || "all").toLowerCase();
  const globalRange = (searchParams.get("range") || "7d").toLowerCase();
  const summary = data?.summary || {};
  const brandName = typeof data?.brandName === "string" ? data.brandName : "";

  const promptResponseMap = useMemo(() => {
    const map = new Map<string, Array<{ provider: string; response: string; prompt: string }>>();
    const rows = Array.isArray(data?.rawResponses) ? data.rawResponses : [];
    rows.forEach((row: any) => {
      const prompt = typeof row?.prompt === "string"
        ? row.prompt.trim()
        : (typeof row?.promptText === "string" ? row.promptText.trim() : "");
      const response = typeof row?.response === "string" ? row.response.trim() : "";
      if (!prompt || !response) return;
      const key = normalizePromptKey(prompt);
      const existing = map.get(key) || [];
      existing.push({
        provider: typeof row?.provider === "string" ? row.provider : "Unknown",
        response,
        prompt,
      });
      map.set(key, existing);
    });
    return map;
  }, [data?.rawResponses]);
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
        responses: getResponsesForPrompt(promptResponseMap, String(p.prompt || "")),
      }))
    : [];
  const platformOptions = useMemo(() => {
    const set = new Set<string>();
    promptRows.forEach((row: any) => {
      String(row.platform || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .forEach((v) => set.add(v));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [promptRows]);
  const filteredPromptRows = useMemo(() => {
    return promptRows.filter((row: any) => {
      const matchesSearch =
        !searchFilter.trim() ||
        String(row.prompt || "").toLowerCase().includes(searchFilter.trim().toLowerCase());
      const matchesGlobalSearch =
        !globalQuery || String(row.prompt || "").toLowerCase().includes(globalQuery);
      const rowPlatforms = String(row.platform || "")
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
      const matchesPlatform =
        platformFilter === "all" || rowPlatforms.includes(platformFilter.toLowerCase());
      const matchesGlobalPlatform = matchesGlobalPlatformFilter(rowPlatforms, globalPlatform);
      const matchesSentiment =
        sentimentFilter === "all" || String(row.sentiment || "") === sentimentFilter;
      const matchesTrending =
        trendingFilter === "all" ||
        (trendingFilter === "trending" ? Boolean(row.trending) : !Boolean(row.trending));
      return matchesSearch && matchesGlobalSearch && matchesPlatform && matchesGlobalPlatform && matchesSentiment && matchesTrending;
    });
  }, [globalPlatform, globalQuery, promptRows, platformFilter, searchFilter, sentimentFilter, trendingFilter]);
  const trendSeries = Array.isArray(data?.promptPerformanceTrend) && data.promptPerformanceTrend.length > 0
    ? filterByDateRange(data.promptPerformanceTrend, globalRange).map((item: any, idx: number) => ({
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
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className="nav-item flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Filter size={11} strokeWidth={1.5} />
              Filter
            </button>
            <button className="nav-item rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              Export
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="border-b border-border px-5 py-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
              <input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search prompt..."
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none ring-0 focus:border-primary"
              />
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none ring-0 focus:border-primary"
              >
                <option value="all">All platforms</option>
                {platformOptions.map((platform) => (
                  <option key={platform} value={platform}>{platform}</option>
                ))}
              </select>
              <select
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none ring-0 focus:border-primary"
              >
                <option value="all">All sentiments</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
              <select
                value={trendingFilter}
                onChange={(e) => setTrendingFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none ring-0 focus:border-primary"
              >
                <option value="all">Trending + non-trending</option>
                <option value="trending">Only trending</option>
                <option value="not_trending">Only non-trending</option>
              </select>
              <button
                onClick={() => {
                  setSearchFilter("");
                  setPlatformFilter("all");
                  setSentimentFilter("all");
                  setTrendingFilter("all");
                }}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Clear filters
              </button>
            </div>
          </div>
        )}
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
              {filteredPromptRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-xs text-muted-foreground" colSpan={6}>
                    {promptRows.length === 0 ? "No prompt analytics data yet." : "No rows match current filters."}
                  </td>
                </tr>
              ) : filteredPromptRows.map((p: any, i: number) => {
                const key = String(p.prompt || "");
                const isExpanded = expandedPrompt === key;
                return (
                  <Fragment key={key || i}>
                    <tr
                      className={cn(
                        "cursor-pointer border-b border-border/50 hover:bg-secondary/30",
                        isExpanded && "bg-secondary/20"
                      )}
                      onClick={() => setExpandedPrompt((prev) => (prev === key ? null : key))}
                    >
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
                    {isExpanded && (
                      <tr className="border-b border-border/50 bg-secondary/10">
                        <td className="px-5 py-3" colSpan={6}>
                          <div className="rounded-lg border border-border bg-card p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Prompt Responses
                            </p>
                            {Array.isArray(p.responses) && p.responses.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {p.responses.map((response: any, idx: number) => (
                                  <div key={`${response.provider}-${idx}`} className="rounded-md border border-border/70 bg-background p-2.5">
                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      {response.provider}
                                    </p>
                                    <div className="text-xs leading-5 text-foreground">
                                      {renderMarkdownWithHighlights(response.response, brandName, response.provider)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-muted-foreground">
                                No stored responses found for this prompt yet.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function normalizePromptKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getResponsesForPrompt(
  promptResponseMap: Map<string, Array<{ provider: string; response: string; prompt: string }>>,
  prompt: string
) {
  const key = normalizePromptKey(prompt);
  const direct = promptResponseMap.get(key);
  if (direct && direct.length > 0) return direct;

  // Fallback for tiny formatting differences between saved prompt and analytics prompt text.
  for (const [existingKey, responses] of promptResponseMap.entries()) {
    if (existingKey.includes(key) || key.includes(existingKey)) return responses;
  }
  return [];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightBrandMentions(text: string, name: string, provider?: string) {
  const safe = (name || "").trim();
  if (!safe) return text;
  const providerColor = getProviderHighlightColor(provider);
  const regex = new RegExp(`(${escapeRegExp(safe)})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    if (part.toLowerCase() === safe.toLowerCase()) {
      return (
        <mark
          key={`${part}-${idx}`}
          className="rounded px-0.5 text-foreground"
          style={{ backgroundColor: providerColor }}
        >
          {part}
        </mark>
      );
    }
    return <Fragment key={`${part}-${idx}`}>{part}</Fragment>;
  });
}

function renderTextWithHighlight(text: string, name: string, keyBase: string, provider?: string) {
  const highlighted = highlightBrandMentions(text, name, provider);
  if (typeof highlighted === "string") {
    return <Fragment key={keyBase}>{highlighted}</Fragment>;
  }
  return highlighted.map((node, idx) => (
    <Fragment key={`${keyBase}-${idx}`}>{node}</Fragment>
  ));
}

function renderInlineMarkdown(text: string, brandName: string, keyBase: string, provider?: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    const token = match[0];
    const start = match.index;
    if (start > lastIndex) {
      parts.push(renderTextWithHighlight(text.slice(lastIndex, start), brandName, `${keyBase}-t-${idx}`, provider));
      idx += 1;
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      const content = token.slice(2, -2);
      parts.push(
          <strong key={`${keyBase}-b-${idx}`} className="font-semibold">
          {renderTextWithHighlight(content, brandName, `${keyBase}-btxt-${idx}`, provider)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      const content = token.slice(1, -1);
      parts.push(
          <em key={`${keyBase}-i-${idx}`} className="italic">
          {renderTextWithHighlight(content, brandName, `${keyBase}-itxt-${idx}`, provider)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      const content = token.slice(1, -1);
      parts.push(
          <code key={`${keyBase}-c-${idx}`} className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">
          {renderTextWithHighlight(content, brandName, `${keyBase}-ctxt-${idx}`, provider)}
        </code>
      );
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const split = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (split) {
        const label = split[1];
        const href = split[2];
        parts.push(
          <a
            key={`${keyBase}-a-${idx}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-primary/50 underline-offset-2 hover:text-primary"
          >
            {renderTextWithHighlight(label, brandName, `${keyBase}-atxt-${idx}`, provider)}
          </a>
        );
      } else {
        parts.push(renderTextWithHighlight(token, brandName, `${keyBase}-raw-${idx}`, provider));
      }
    } else {
      parts.push(renderTextWithHighlight(token, brandName, `${keyBase}-raw-${idx}`, provider));
    }

    idx += 1;
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(renderTextWithHighlight(text.slice(lastIndex), brandName, `${keyBase}-tail`, provider));
  }

  return parts;
}

function renderMarkdownWithHighlights(markdown: string, brandName: string, provider?: string): ReactNode {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && lines[i].trim().startsWith("```")) i += 1;
      blocks.push(
        <pre key={`md-${blockKey}`} className="my-2 overflow-x-auto rounded-md bg-secondary p-2.5 text-[11px] leading-5 text-foreground">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      blockKey += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const content = heading[2];
      const cls = level === 1 ? "text-sm font-semibold" : level === 2 ? "text-[13px] font-semibold" : "text-xs font-semibold";
      blocks.push(
        <p key={`md-${blockKey}`} className={cn("mt-2 text-foreground", cls)}>
          {renderInlineMarkdown(content, brandName, `md-h-${blockKey}`, provider)}
        </p>
      );
      i += 1;
      blockKey += 1;
      continue;
    }

    if (/^(\-|\*|\d+\.)\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^(\-|\*|\d+\.)\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^(\-|\*|\d+\.)\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`md-${blockKey}`} className="my-1 list-disc space-y-1 pl-5">
          {items.map((item, idx) => (
            <li key={`md-${blockKey}-li-${idx}`} className="text-xs text-foreground">
              {renderInlineMarkdown(item, brandName, `md-li-${blockKey}-${idx}`, provider)}
            </li>
          ))}
        </ul>
      );
      blockKey += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("```") && !/^(#{1,3})\s+/.test(lines[i]) && !/^(\-|\*|\d+\.)\s+/.test(lines[i].trim())) {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`md-${blockKey}`} className="my-1 text-xs leading-5 text-foreground">
        {paragraphLines.map((paragraphLine, idx) => (
          <Fragment key={`md-${blockKey}-p-${idx}`}>
            {renderInlineMarkdown(paragraphLine, brandName, `md-p-${blockKey}-${idx}`, provider)}
            {idx < paragraphLines.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </p>
    );
    blockKey += 1;
  }

  return <div className="space-y-1">{blocks}</div>;
}

function getProviderHighlightColor(provider?: string) {
  const value = (provider || "").toLowerCase();
  if (value.includes("chatgpt") || value.includes("openai") || value.includes("gpt")) return "rgba(16, 163, 127, 0.22)";
  if (value.includes("gemini")) return "rgba(26, 115, 232, 0.22)";
  if (value.includes("perplexity")) return "rgba(32, 194, 213, 0.22)";
  if (value.includes("claude") || value.includes("anthropic")) return "rgba(217, 119, 87, 0.22)";
  return "rgba(236, 161, 122, 0.24)";
}

function matchesGlobalPlatformFilter(rowPlatforms: string[], selectedPlatform: string) {
  if (!selectedPlatform || selectedPlatform === "all") return true;
  const aliases: Record<string, string[]> = {
    chatgpt: ["chatgpt", "openai", "gpt"],
    gemini: ["gemini", "google"],
    perplexity: ["perplexity"],
    claude: ["claude", "anthropic"],
    "ai-overviews": ["ai overviews", "ai-overviews", "google"],
  };
  const expected = aliases[selectedPlatform] || [selectedPlatform];
  return rowPlatforms.some((platform) => expected.some((alias) => platform.includes(alias)));
}

function filterByDateRange<T extends { timestamp?: string }>(items: T[], range: string) {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (!range || range === "all" || range === "custom") return items;
  const now = new Date();
  const start = new Date(now);
  if (range === "24h") start.setDate(now.getDate() - 1);
  else if (range === "7d") start.setDate(now.getDate() - 7);
  else if (range === "30d") start.setDate(now.getDate() - 30);
  else if (range === "ytd") start.setMonth(0, 1);
  else return items;
  return items.filter((item) => {
    const raw = item?.timestamp;
    if (!raw) return true;
    const value = new Date(raw);
    if (Number.isNaN(value.getTime())) return true;
    return value >= start && value <= now;
  });
}
