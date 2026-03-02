"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, TrendingUp, Link2, Zap } from "lucide-react";
import { MetricCard } from "../metric-card";
import { VisibilityScore } from "../visibility-score";
import { VisibilityTrendChart } from "../visibility-trend-chart";
import { PlatformBreakdown } from "../platform-breakdown";
import { CompetitorTable } from "../competitor-table";
import { AlertsFeed } from "../alerts-feed";
import { SentimentWidget } from "../sentiment-widget";
import { SourceAttribution } from "../source-attribution";
import { PromptAnalyticsWidget } from "../prompt-analytics-widget";
import { useAnalyticsSection } from "@/lib/services/dashboard-analytics";

export function OverviewPage() {
  const { data, error, refresh } = useAnalyticsSection<any>("dashboard");
  const searchParams = useSearchParams();
  const globalQuery = (searchParams.get("q") || "").trim().toLowerCase();
  const globalPlatform = (searchParams.get("platform") || "all").toLowerCase();
  const globalRange = (searchParams.get("range") || "7d").toLowerCase();
  const overview = data?.overview || {};
  const visibility = data?.visibility || {};
  const competitors = data?.competitors || {};
  const alerts = Array.isArray(data?.alerts?.alerts)
    ? data.alerts.alerts.map((a: any, idx: number) => ({
        id: a.id || `alert-${idx + 1}`,
        type: ["visibility_drop", "visibility_spike", "new_mention", "competitor", "sentiment"].includes(a.type)
          ? a.type
          : "new_mention",
        title: a.title || "Alert",
        description: a.description || "",
        time: a.time || "just now",
        read: false,
      }))
    : [];
  const sources = Array.isArray(data?.sources?.sources) ? data.sources.sources : [];
  const prompts = Array.isArray(data?.prompts?.prompts) ? data.prompts.prompts : [];

  const trend = Array.isArray(visibility?.dailyTrend) ? filterByDateRange(visibility.dailyTrend, globalRange) : [];
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;
  const pct = (curr?: number, old?: number) => {
    if (!Number.isFinite(curr) || !Number.isFinite(old) || !old) return 0;
    return Math.round(((Number(curr) - Number(old)) / Number(old)) * 100);
  };

  const platformItemsRaw = Array.isArray(visibility?.platformBreakdown)
    ? visibility.platformBreakdown.map((p: any, i: number) => ({
        name: p.platform,
        score: Number(p.score ?? 0),
        mentions: Number(p.mentions ?? 0),
        citations: Number(p.citations ?? 0),
        sentiment: p.sentiment === "negative" || p.sentiment === "neutral" ? p.sentiment : "positive",
        change: Number(p.change ?? 0),
        color: ["#10A37F", "#1A73E8", "#20C2D5", "#F9AB00", "#D97757", "#9F9ADE"][i % 6],
      }))
    : [];
  const platformItems = useMemo(
    () =>
      platformItemsRaw.filter((p: any) => {
        const matchesQuery = !globalQuery || String(p.name || "").toLowerCase().includes(globalQuery);
        const matchesPlatform = matchesGlobalPlatformFilter(String(p.name || "").toLowerCase(), globalPlatform);
        return matchesQuery && matchesPlatform;
      }),
    [globalPlatform, globalQuery, platformItemsRaw]
  );
  const scopedMentions = useMemo(() => {
    if (globalPlatform === "all") return Number(overview?.mentions?.total ?? 0);
    return platformItems.reduce((sum: number, item: any) => sum + Number(item?.mentions ?? 0), 0);
  }, [globalPlatform, overview?.mentions?.total, platformItems]);
  const scopedCitations = useMemo(() => {
    if (globalPlatform === "all") return Number(overview?.citations?.total ?? 0);
    return platformItems.reduce((sum: number, item: any) => sum + Number(item?.citations ?? 0), 0);
  }, [globalPlatform, overview?.citations?.total, platformItems]);

  const sentimentItems = platformItems.map((p: any) => ({
    platform: p.name,
    positive: Math.max(0, Math.min(100, Number(p.positive ?? (p.sentiment === "positive" ? 70 : p.sentiment === "neutral" ? 45 : 25)))),
    neutral: Math.max(0, Math.min(100, Number(p.neutral ?? (p.sentiment === "neutral" ? 40 : 25)))),
    negative: Math.max(0, Math.min(100, Number(p.negative ?? (p.sentiment === "negative" ? 40 : 15)))),
  }));

  const competitorItemsRaw = Array.isArray(competitors?.competitors)
    ? competitors.competitors.slice(0, 8).map((c: any) => ({
        name: c.isOwn ? "Your Brand" : c.name,
        visibility: Number(c.visibility ?? 0),
        mentions: Number(c.mentions ?? 0),
        shareOfVoice: Number(c.shareOfVoice ?? 0),
        position: Number(c.avgPos ?? 0),
        change: Number(c.change ?? 0),
        isOwn: Boolean(c.isOwn),
      }))
    : [];
  const competitorItems = useMemo(
    () =>
      competitorItemsRaw.filter((c: any) => {
        const haystack = `${c.name} ${c.visibility} ${c.mentions}`.toLowerCase();
        return !globalQuery || haystack.includes(globalQuery);
      }),
    [competitorItemsRaw, globalQuery]
  );

  const sourceItemsRaw = sources.slice(0, 6).map((s: any) => ({
    page: s.domain,
    url: Array.isArray(s.urls) && s.urls[0] ? s.urls[0] : s.domain,
    mentions: Number(s.mentions ?? 0),
    citations: Number(s.citations ?? 0),
    platforms: [],
    trend: "stable" as const,
  }));
  const sourceItems = useMemo(
    () =>
      sourceItemsRaw.filter((s: any) => {
        const haystack = `${s.page} ${s.url}`.toLowerCase();
        return !globalQuery || haystack.includes(globalQuery);
      }),
    [globalQuery, sourceItemsRaw]
  );
  const mappedCitationCount = sources.reduce((sum, s: any) => sum + Number(s?.citations ?? 0), 0);
  const totalCitationCount = Number(overview?.citations?.total ?? 0);
  const unmappedCitationCount = Math.max(0, totalCitationCount - mappedCitationCount);

  const promptItemsRaw = prompts.slice(0, 6).map((p: any) => ({
    prompt: p.prompt,
    volume: "-",
    visibility: Math.round(Number(p.visibility ?? 0)),
    position: p.avgPosition ?? 0,
    trending: Boolean(p.trending),
  }));
  const promptItems = useMemo(
    () =>
      promptItemsRaw.filter((p: any) => !globalQuery || String(p.prompt || "").toLowerCase().includes(globalQuery)),
    [globalQuery, promptItemsRaw]
  );

  const filteredAlerts = useMemo(
    () =>
      alerts.filter((a: any) => {
        const haystack = `${a.title} ${a.description}`.toLowerCase();
        return !globalQuery || haystack.includes(globalQuery);
      }),
    [alerts, globalQuery]
  );

  const trendData = Array.isArray(visibility?.platformTrend) ? filterByDateRange(visibility.platformTrend, globalRange) : [];
  const trendSeriesRaw = Array.isArray(visibility?.platformTrendSeries) ? filterByDateRange(visibility.platformTrendSeries, globalRange) : [];
  const trendSeries = useMemo(
    () =>
      trendSeriesRaw.filter((series: any) =>
        matchesGlobalPlatformFilter(`${series?.key || ""} ${series?.label || ""}`.toLowerCase(), globalPlatform)
      ),
    [globalPlatform, trendSeriesRaw]
  );

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={refresh} className="underline underline-offset-2">Retry</button>
        </div>
      )}
      {/* Top metrics row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Large visibility score */}
        <div className="sm:col-span-2 lg:col-span-1">
          <VisibilityScore score={Math.round(Number(overview?.scores?.visibilityScore ?? 0))} change={pct(overview?.scores?.visibilityScore, prev?.score)} label="Overall Visibility" />
        </div>

        {/* Metric cards */}
        <MetricCard
          label="Brand Mentions"
          value={String(scopedMentions)}
          change={pct(scopedMentions, prev?.mentions)}
          changeLabel={`Explicit: ${Number(overview?.mentions?.explicit ?? 0)} | Implicit: ${Number(overview?.mentions?.implicit ?? 0)}`}
          icon={<MessageSquare size={18} strokeWidth={1.5} />}
          accent="primary"
        />
        <MetricCard
          label="Source Citations"
          value={String(scopedCitations)}
          change={pct(scopedCitations, prev?.citations)}
          changeLabel={`Mapped to sources: ${mappedCitationCount} | Unmapped: ${unmappedCitationCount}`}
          icon={<Link2 size={18} strokeWidth={1.5} />}
          accent="success"
        />
        <MetricCard
          label="Avg. Position"
          value={`#${overview?.scores?.averagePosition ?? "-"}`}
          change={0}
          changeLabel="Position in AI answers"
          icon={<TrendingUp size={18} strokeWidth={1.5} />}
          accent="warning"
        />
        <MetricCard
          label="Opportunities"
          value={String(overview?.opportunities ?? 0)}
          change={0}
          changeLabel="Gaps where competitors appear"
          icon={<Zap size={18} strokeWidth={1.5} />}
          accent="primary"
        />
      </div>

      {/* Trend chart + Platform breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <VisibilityTrendChart
            data={trendData}
            series={trendSeries}
            title="Visibility Trend"
            subtitle="Brand visibility across AI platforms"
          />
        </div>
        <div className="lg:col-span-2">
          <PlatformBreakdown items={platformItems} />
        </div>
      </div>

      {/* Competitors + Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CompetitorTable items={competitorItems} />
        </div>
        <div className="lg:col-span-2">
          <AlertsFeed items={filteredAlerts} />
        </div>
      </div>

      {/* Sentiment */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-1">
        <SentimentWidget items={sentimentItems} />
      </div>

      {/* Sources + Prompts */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
        <SourceAttribution items={sourceItems} />
        <PromptAnalyticsWidget items={promptItems} />
      </div>
    </div>
  );
}

function matchesGlobalPlatformFilter(value: string, selectedPlatform: string) {
  if (!selectedPlatform || selectedPlatform === "all") return true;
  const aliases: Record<string, string[]> = {
    chatgpt: ["chatgpt", "openai", "gpt"],
    gemini: ["gemini", "google"],
    perplexity: ["perplexity"],
    claude: ["claude", "anthropic"],
    "ai-overviews": ["ai overviews", "ai-overviews", "google"],
  };
  const expected = aliases[selectedPlatform] || [selectedPlatform];
  return expected.some((alias) => value.includes(alias));
}

function filterByDateRange<T extends { timestamp?: string; date?: string }>(items: T[], range: string) {
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
    const raw = item?.timestamp || item?.date;
    if (!raw) return true;
    const value = new Date(raw);
    if (Number.isNaN(value.getTime())) return true;
    return value >= start && value <= now;
  });
}
