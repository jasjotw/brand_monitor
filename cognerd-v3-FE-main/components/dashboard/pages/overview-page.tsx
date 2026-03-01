"use client";

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

  const trend = Array.isArray(visibility?.dailyTrend) ? visibility.dailyTrend : [];
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;
  const pct = (curr?: number, old?: number) => {
    if (!Number.isFinite(curr) || !Number.isFinite(old) || !old) return 0;
    return Math.round(((Number(curr) - Number(old)) / Number(old)) * 100);
  };

  const platformItems = Array.isArray(visibility?.platformBreakdown)
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

  const sentimentItems = platformItems.map((p: any) => ({
    platform: p.name,
    positive: Math.max(0, Math.min(100, Number(p.positive ?? (p.sentiment === "positive" ? 70 : p.sentiment === "neutral" ? 45 : 25)))),
    neutral: Math.max(0, Math.min(100, Number(p.neutral ?? (p.sentiment === "neutral" ? 40 : 25)))),
    negative: Math.max(0, Math.min(100, Number(p.negative ?? (p.sentiment === "negative" ? 40 : 15)))),
  }));

  const competitorItems = Array.isArray(competitors?.competitors)
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

  const sourceItems = sources.slice(0, 6).map((s: any) => ({
    page: s.domain,
    url: Array.isArray(s.urls) && s.urls[0] ? s.urls[0] : s.domain,
    mentions: Number(s.mentions ?? 0),
    citations: Number(s.citations ?? 0),
    platforms: [],
    trend: "stable" as const,
  }));

  const promptItems = prompts.slice(0, 6).map((p: any) => ({
    prompt: p.prompt,
    volume: "-",
    visibility: Math.round(Number(p.visibility ?? 0)),
    position: p.avgPosition ?? 0,
    trending: Boolean(p.trending),
  }));

  const trendData = Array.isArray(visibility?.platformTrend) ? visibility.platformTrend : [];
  const trendSeries = Array.isArray(visibility?.platformTrendSeries) ? visibility.platformTrendSeries : [];

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
          value={String(overview?.mentions?.total ?? 0)}
          change={pct(overview?.mentions?.total, prev?.mentions)}
          changeLabel="Brand mentions across AI platforms"
          icon={<MessageSquare size={18} strokeWidth={1.5} />}
          accent="primary"
        />
        <MetricCard
          label="Source Citations"
          value={String(overview?.citations?.total ?? 0)}
          change={pct(overview?.citations?.total, prev?.citations)}
          changeLabel="Brand citations in AI responses"
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
          <AlertsFeed items={alerts} />
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
