"use client";

import React from "react"

import { cn } from "@/lib/utils";
import { Bell, TrendingUp, TrendingDown, Zap, MessageSquare, AlertTriangle, Check, Filter, Settings } from "lucide-react";
import { useAnalyticsSection } from "@/lib/services/dashboard-analytics";

interface AlertItem {
  id: string;
  type: "visibility_drop" | "visibility_spike" | "new_mention" | "competitor" | "sentiment" | "diagnostic";
  title: string;
  description: string;
  time: string;
  read: boolean;
  severity: "info" | "warning" | "critical";
}

function normalizeAlertType(type: string): AlertItem["type"] {
  switch (type) {
    case "visibility_drop":
    case "visibility_spike":
    case "new_mention":
    case "diagnostic":
      return type;
    case "competitor_overtake":
      return "competitor";
    case "sentiment_shift":
      return "sentiment";
    case "citation_drop":
      return "diagnostic";
    default:
      return "new_mention";
  }
}

function mapAlerts(data: any): AlertItem[] {
  const raw = Array.isArray(data?.alerts) ? data.alerts : [];
  return raw.map((a: any, idx: number) => ({
    id: a.id || `alert-${idx + 1}`,
    type: normalizeAlertType(a.type || "new_mention"),
    title: a.title || "Alert",
    description: a.description || "",
    time: a.time || "just now",
    read: false,
    severity: a.severity === "critical" || a.severity === "warning" ? a.severity : "info",
  }));
}

const alertIcons: Record<string, React.ReactNode> = {
  visibility_drop: <TrendingDown size={14} strokeWidth={1.5} />,
  visibility_spike: <TrendingUp size={14} strokeWidth={1.5} />,
  new_mention: <MessageSquare size={14} strokeWidth={1.5} />,
  competitor: <Zap size={14} strokeWidth={1.5} />,
  sentiment: <AlertTriangle size={14} strokeWidth={1.5} />,
  diagnostic: <Settings size={14} strokeWidth={1.5} />,
};

const alertColors: Record<string, string> = {
  visibility_drop: "bg-destructive/8 text-destructive",
  visibility_spike: "bg-success/8 text-success",
  new_mention: "bg-primary/8 text-primary",
  competitor: "bg-warning/8 text-warning",
  sentiment: "bg-primary/8 text-primary",
  diagnostic: "bg-warning/8 text-warning",
};

const severityBadge: Record<string, string> = {
  info: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
};

export function AlertsPage() {
  const { data, loading, error, refresh } = useAnalyticsSection<any>("alerts");
  const allAlerts = mapAlerts(data);
  const unread = allAlerts.filter((a) => !a.read).length;
  const criticalCount = allAlerts.filter((a) => a.severity === "critical").length;
  const warningCount = allAlerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={refresh} className="underline underline-offset-2">Retry</button>
        </div>
      )}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">Loading alerts...</div>
      ) : null}
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Alerts", value: allAlerts.length.toString(), icon: <Bell size={16} strokeWidth={1.5} /> },
          { label: "Unread", value: unread.toString(), icon: <MessageSquare size={16} strokeWidth={1.5} /> },
          { label: "Critical", value: criticalCount.toString(), icon: <AlertTriangle size={16} strokeWidth={1.5} /> },
          { label: "Warnings", value: warningCount.toString(), icon: <TrendingUp size={16} strokeWidth={1.5} /> },
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

      {/* Alerts list */}
      <div className="card-hover rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-card-foreground">All Alerts</h3>
            {unread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{unread}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="nav-item flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Filter size={11} strokeWidth={1.5} />
              Filter
            </button>
            <button className="nav-item flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Check size={11} strokeWidth={2} />
              Mark all read
            </button>
          </div>
        </div>
        <div className="flex flex-col">
          {allAlerts.length === 0 && !loading ? (
            <div className="px-5 py-4 text-xs text-muted-foreground">No alerts yet.</div>
          ) : allAlerts.map((alert, i) => (
            <div
              key={alert.id}
              className={cn(
                "flex gap-3 px-5 py-4 transition-colors hover:bg-secondary/30",
                i < allAlerts.length - 1 && "border-b border-border/50",
                !alert.read && "bg-primary/[0.02]"
              )}
            >
              <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", alertColors[alert.type])}>
                {alertIcons[alert.type]}
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-medium text-foreground", !alert.read && "font-semibold")}>{alert.title}</span>
                  {!alert.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className={cn("ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", severityBadge[alert.severity])}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{alert.description}</p>
                <span className="text-[10px] text-muted-foreground/60">{alert.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
