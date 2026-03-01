"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import {
  Users,
  Link as LinkIcon,
  Globe,
  ShieldAlert,
  Activity,
  Network,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Ban,
  Unlink,
  Target,
  X,
  Maximize2,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type MetricColor = "text-success" | "text-destructive" | undefined;

type BacklinkMetrics = {
  domainRating: number;
  targetSpamScore: number;
  totalBacklinks: number;
  referringDomains: number;
  mainDomains: number;
  referringIps: number;
  nofollowDomains: number;
  brokenBacklinks: number;
  detailedSpamScore: number;
  externalLinks: number;
};

type BacklinkOpportunityLink = {
  title: string;
  url: string;
  count: number;
  label: "Main" | "NoFollow" | "Image";
};

type BacklinkOpportunity = {
  domain: string;
  dr: number;
  links: BacklinkOpportunityLink[];
};

type BacklinkCompetitor = {
  id: string;
  name: string;
  url: string;
  color: string;
  isOwn: boolean;
};

type BacklinkDetail = {
  metrics: BacklinkMetrics;
  tlds: string[];
  opportunities: BacklinkOpportunity[];
};

type BacklinksApiResponse = {
  hasData: boolean;
  hasSnapshot: boolean;
  brandId: string | null;
  generatedAt: string;
  source: "db" | "fetched" | "none";
  summary: {
    competitors: number;
    totalBacklinks: number;
    avgRefDomains: number;
  };
  competitors: BacklinkCompetitor[];
  details: Record<string, BacklinkDetail>;
};

type DisplayMetric = {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: MetricColor;
};

function compact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function withCommas(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function metricList(metrics: BacklinkMetrics): DisplayMetric[] {
  return [
    { label: "Domain Rating", value: String(metrics.domainRating), icon: <Activity size={14} /> },
    { label: "Target Spam Score", value: `${metrics.targetSpamScore}%`, icon: <ShieldAlert size={14} />, color: "text-success" },
    { label: "Total Backlinks", value: withCommas(metrics.totalBacklinks), icon: <LinkIcon size={14} /> },
    { label: "Referring Domains", value: withCommas(metrics.referringDomains), icon: <Globe size={14} /> },
    { label: "Main Domains", value: withCommas(metrics.mainDomains), icon: <Globe size={14} /> },
    { label: "Referring IPs", value: withCommas(metrics.referringIps), icon: <Network size={14} /> },
    { label: "Nofollow Domains", value: withCommas(metrics.nofollowDomains), icon: <Ban size={14} /> },
    { label: "Broken Backlinks", value: withCommas(metrics.brokenBacklinks), icon: <Unlink size={14} />, color: "text-destructive" },
    { label: "Detailed Spam Score", value: `${metrics.detailedSpamScore}%`, icon: <ShieldAlert size={14} /> },
    { label: "External Links", value: compact(metrics.externalLinks), icon: <ExternalLink size={14} /> },
  ];
}

function LinkPreviewPanel({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [loadingState, setLoadingState] = useState<"loading" | "loaded" | "error">("loading");
  const router = useRouter();

  const getTopicFromUrl = (rawUrl: string) => {
    try {
      const pathname = new URL(rawUrl).pathname;
      const segment = pathname.split('/').filter(Boolean).pop() || "";
      const topic = segment.replace(/\.(html|php|aspx)$/, '').replace(/[-_]/g, ' ');
      return topic.replace(/\b\w/g, l => l.toUpperCase()) || "New Topic";
    } catch {
      return "New Topic";
    }
  };

  const handleGenerateClick = () => {
    if (!url) return;
    const topic = getTopicFromUrl(url);
    router.push(`/dashboard/content?topic=${encodeURIComponent(topic)}&source=${encodeURIComponent(url)}`);
  };

  React.useEffect(() => {
    if (url) {
      setLoadingState("loading");
      const timer = setTimeout(() => {
        setLoadingState((prev) => prev === "loading" ? "error" : prev);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [url]);

  return (
    <AnimatePresence>
      {url && (
        <React.Fragment key="preview-panel">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-background/40 backdrop-blur-[4px]"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-[101] flex w-full flex-col border-l border-border bg-white shadow-2xl md:w-3/5 lg:w-1/2"
          >
            <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className="text-sm font-semibold text-foreground">Live Source Preview</span>
                <span className="truncate text-xs text-sidebar-muted">{url}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateClick}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-bold text-primary-foreground shadow-sm transition-all hover:scale-105 active:scale-95"
                >
                  <Sparkles size={14} fill="currentColor" />
                  <span>Generate Blog</span>
                </button>
                <div className="h-4 w-px bg-border" />
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/50 text-sidebar-muted hover:bg-primary/10 hover:text-primary transition-all"
                  title="Open in new tab"
                >
                  <Maximize2 size={18} />
                </a>
                <button
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/50 text-sidebar-muted hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="relative flex-1 bg-[#FDFCFB] overflow-hidden">
              {loadingState === "loading" && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-card">
                  <div className="relative mb-8 h-16 w-16">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/20 duration-1000" />
                    <span className="absolute inset-2 animate-pulse rounded-full bg-primary/40 duration-700" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Network className="animate-spin text-primary duration-[3s]" size={24} />
                    </div>
                  </div>
                  <h3 className="animate-pulse text-sm font-semibold text-foreground">Establishing Secure Link...</h3>
                  <p className="mt-2 text-xs text-sidebar-muted">Bypassing security headers</p>
                </div>
              )}

              {loadingState === "error" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-12 text-center bg-card animate-in fade-in duration-500">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-sidebar-muted">
                    <ShieldAlert size={32} className="opacity-20" />
                  </div>
                  <h3 className="mb-2 font-semibold text-foreground">Preview Unavailable</h3>
                  <p className="mb-6 max-w-xs text-xs text-sidebar-muted">
                    This source prevents internal previews. Use the button below to view the live content.
                  </p>
                  <a
                    href={url || ""}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:scale-105 active:scale-95"
                  >
                    <Maximize2 size={16} />
                    View Live Website
                  </a>
                </div>
              )}

              <iframe
                src={`/api/proxy?url=${encodeURIComponent(url)}`}
                className={cn(
                  "relative z-0 h-full w-full border-none bg-white transition-opacity duration-700",
                  loadingState === "loaded" ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setLoadingState("loaded")}
                onError={() => setLoadingState("error")}
                title="Link Preview"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}

function MetricCard({ item }: { item: DisplayMetric }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
      }}
      className="card-hover flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between text-sidebar-muted">
        <span className="text-[12px] font-medium">{item.label}</span>
        {item.icon}
      </div>
      <div className="flex items-end gap-2">
        <span className={cn("text-xl font-bold tracking-tight text-foreground", item.color)}>
          {item.value}
        </span>
      </div>
    </motion.div>
  );
}

function OpportunityGroup({ item, onLinkClick }: { item: BacklinkOpportunity; onLinkClick: (url: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between bg-card px-4 py-3 hover:bg-secondary/50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-sidebar-muted">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          <span className="text-[14px] font-semibold text-foreground">{item.domain}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            DR {item.dr}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="border-t border-border bg-secondary/10 px-4 py-3">
              <div className="flex flex-col gap-2">
                {item.links.map((link, idx) => (
                  <div key={idx} className="flex items-start justify-between rounded-lg border border-border/50 bg-background p-3 hover:border-primary/20">
                    <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                      <span className="truncate text-[12px] font-medium text-foreground">
                        {link.title}
                      </span>
                      <button
                        onClick={() => onLinkClick(link.url)}
                        className="flex w-fit items-center gap-1 truncate text-[11px] text-sidebar-muted hover:text-primary hover:underline text-left"
                      >
                        {link.url}
                        <ExternalLink size={8} />
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] font-medium text-sidebar-muted">
                        {link.count} links
                      </span>
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        link.label === "Main" ? "bg-success/10 text-success" :
                        link.label === "NoFollow" ? "bg-warning/10 text-warning" :
                        "bg-secondary text-sidebar-muted"
                      )}>
                        {link.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BacklinksPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeCompId, setActiveCompId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingNow, setFetchingNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<BacklinksApiResponse | null>(null);

  const loadCurrentBacklinks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAuthToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const baseUrl = process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
      const response = await fetch(`${baseUrl}/api/brand-monitor/backlinks/current`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await response.json().catch(() => ({}))) as Partial<BacklinksApiResponse> & { error?: { message?: string } | string };
      if (response.status === 401) {
        clearAuthToken();
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new Error("Session expired");
      }
      if (!response.ok) {
        const message = typeof data.error === "string" ? data.error : data.error?.message;
        throw new Error(message || "Failed to load backlink analytics");
      }

      const normalized = data as BacklinksApiResponse;
      setPayload(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load backlink analytics";
      setError(message);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBacklinks = useCallback(async () => {
    try {
      setFetchingNow(true);
      setError(null);

      const token = getAuthToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const baseUrl = process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
      const response = await fetch(`${baseUrl}/api/brand-monitor/backlinks/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await response.json().catch(() => ({}))) as Partial<BacklinksApiResponse> & { error?: { message?: string } | string };
      if (response.status === 401) {
        clearAuthToken();
        if (typeof window !== "undefined") window.location.href = "/login";
        throw new Error("Session expired");
      }
      if (!response.ok) {
        const message = typeof data.error === "string" ? data.error : data.error?.message;
        throw new Error(message || "Failed to fetch backlinks");
      }

      setPayload(data as BacklinksApiResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch backlinks";
      setError(message);
    } finally {
      setFetchingNow(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentBacklinks();
  }, [loadCurrentBacklinks]);

  useEffect(() => {
    if (!payload || payload.competitors.length === 0) {
      setActiveCompId(null);
      return;
    }
    if (!activeCompId || !payload.competitors.some((c) => c.id === activeCompId)) {
      setActiveCompId(payload.competitors[0].id);
    }
  }, [payload, activeCompId]);

  const summaryMetrics = useMemo(() => ([
    { label: "Competitors", value: String(payload?.summary.competitors ?? 0), icon: <Users size={16} /> },
    { label: "Total Backlinks", value: compact(payload?.summary.totalBacklinks ?? 0), icon: <LinkIcon size={16} /> },
    { label: "Avg. Ref. Domains", value: withCommas(payload?.summary.avgRefDomains ?? 0), icon: <Network size={16} /> },
  ]), [payload]);

  const activeComp = useMemo(() => {
    if (!payload) return null;
    return payload.competitors.find((c) => c.id === activeCompId) || payload.competitors[0] || null;
  }, [payload, activeCompId]);

  const activeDetail = activeComp ? payload?.details?.[activeComp.id] : undefined;
  const displayMetrics = activeDetail ? metricList(activeDetail.metrics) : [];

  return (
    <div className="relative">
      <LinkPreviewPanel url={previewUrl} onClose={() => setPreviewUrl(null)} />

      <div className="flex flex-col gap-6">
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadCurrentBacklinks} className="underline underline-offset-2">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">Loading backlink analytics...</div>
        ) : null}

        {!loading && payload && payload.competitors.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            No backlink data available yet. Add a brand and competitors to generate backlink insights.
          </div>
        ) : null}

        {!loading && payload && payload.competitors.length > 0 ? (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground">
              {payload.hasSnapshot ? "Backlinks loaded from saved analysis." : "Competitors are preloaded. Click Fetch Backlinks to run DataForSEO now."}
            </div>
            <button
              onClick={fetchBacklinks}
              disabled={fetchingNow}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {fetchingNow ? "Fetching..." : "Fetch Backlinks"}
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {summaryMetrics.map((stat, i) => (
            <div key={i} className="card-hover flex items-center gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {stat.icon}
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</span>
                <span className="text-[12px] font-medium text-sidebar-muted">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Analysis Target</h3>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-sidebar-muted">
              <Target size={12} />
              <span>Select a competitor to view detailed profile</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(payload?.competitors || []).map((comp) => (
              <button
                key={comp.id}
                onClick={() => setActiveCompId(comp.id)}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-xl border px-4 py-2.5 transition-all duration-300",
                  activeComp?.id === comp.id
                    ? "border-primary/30 bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/20 hover:bg-secondary/30"
                )}
              >
                <span
                  className="h-2 w-2 rounded-full transition-transform group-hover:scale-125"
                  style={{ backgroundColor: comp.color }}
                />
                <span className={cn(
                  "text-[13px] font-semibold",
                  activeComp?.id === comp.id ? "text-foreground" : "text-sidebar-muted"
                )}>
                  {comp.name}
                </span>
                {activeComp?.id === comp.id && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 rounded-xl ring-2 ring-primary/20 pointer-events-none"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {activeComp && activeDetail ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeComp.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col gap-6"
            >
              <div className="flex flex-col">
                <h2 className="text-2xl font-bold text-foreground">{activeComp.name} Profile</h2>
                <p className="text-[13px] font-medium text-primary">{activeComp.url}</p>
              </div>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.03 } }
                }}
                className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5"
              >
                {displayMetrics.map((item, i) => (
                  <MetricCard key={i} item={item} />
                ))}
              </motion.div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="card-hover flex flex-col gap-3 rounded-xl border border-border bg-card p-5 lg:col-span-1">
                  <h3 className="text-sm font-semibold text-foreground">TLD Distribution</h3>
                  <div className="flex flex-wrap gap-2">
                    {activeDetail.tlds.map((tld) => (
                      <span
                        key={tld}
                        className="cursor-default rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      >
                        {tld}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4 lg:col-span-2">
                  <h3 className="text-sm font-semibold text-foreground">Link Opportunities</h3>
                  <div className="flex flex-col gap-3">
                    {activeDetail.opportunities.map((item, i) => (
                      <OpportunityGroup key={i} item={item} onLinkClick={setPreviewUrl} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : !loading && payload?.competitors.length ? (
          <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            No fetched backlink metrics yet. Click <span className="font-semibold text-foreground">Fetch Backlinks</span> to load and display details.
          </div>
        ) : null}
      </div>
    </div>
  );
}
