"use client";

import React from "react";

import { cn } from "@/lib/utils";
import { Check, X, AlertTriangle, Wrench, Globe, FileCode, Zap, RefreshCw, ArrowRight } from "lucide-react";
import { useAnalyticsSection } from "@/lib/services/dashboard-analytics";

interface DiagnosticCheck {
  label: string;
  status: "pass" | "fail" | "warning";
  detail: string;
  fix?: string;
}

interface DiagnosticGroup {
  category: string;
  checks: DiagnosticCheck[];
}

interface DiagnosticsData {
  hasData: boolean;
  clientName: string | null;
  generationDate: string | null;
  summary: {
    structuredCoverage: number | null;
    unstructuredCoverage: number | null;
    optimizationOpportunities: number | null;
    overallAEOReadiness: number | null;
    schemaCounts: { valid: number; incorrect: number; missing: number; other: number };
    totalSchemas: number;
    optimizationCount: number;
    caseMetricsFound: string[];
  };
  executiveSummary: {
    surface: string;
    deeper: string;
    rootCauses: string;
  };
  groups: DiagnosticGroup[];
  health: {
    score: number;
    passed: number;
    warnings: number;
    failed: number;
    total: number;
  };
  error?: string;
}

const statusConfig = {
  pass: { icon: <Check size={13} strokeWidth={2.5} />, bg: "bg-success/10 text-success", badge: "bg-success/10 text-success" },
  fail: { icon: <X size={13} strokeWidth={2.5} />, bg: "bg-destructive/10 text-destructive", badge: "bg-destructive/10 text-destructive" },
  warning: { icon: <AlertTriangle size={13} strokeWidth={2} />, bg: "bg-warning/10 text-warning", badge: "bg-warning/10 text-warning" },
};

const categoryIcons: Record<string, React.ReactNode> = {
  "AI Crawlability": <Globe size={16} strokeWidth={1.5} />,
  "Structured Data": <FileCode size={16} strokeWidth={1.5} />,
  "Content Structure": <Wrench size={16} strokeWidth={1.5} />,
  "Performance": <Zap size={16} strokeWidth={1.5} />,
};

export function DiagnosticsPage() {
  const { data, loading, error, refresh } = useAnalyticsSection<DiagnosticsData>("diagnostics");

  const groups = Array.isArray(data?.groups) ? data.groups : [];
  const allChecks = groups.flatMap((g) => g.checks);
  const passed = data?.health?.passed ?? allChecks.filter((c) => c.status === "pass").length;
  const warnings = data?.health?.warnings ?? allChecks.filter((c) => c.status === "warning").length;
  const failed = data?.health?.failed ?? allChecks.filter((c) => c.status === "fail").length;
  const total = data?.health?.total ?? allChecks.length;
  const score = data?.health?.score ?? (total > 0 ? Math.round((passed / total) * 100) : 0);

  const summary = data?.summary;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={refresh} className="underline underline-offset-2">Retry</button>
        </div>
      )}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">Loading diagnostics...</div>
      ) : null}
      {data?.error ? (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-warning">
          {data.error}
        </div>
      ) : null}

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-1 card-hover flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-5">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#F5F0EB" strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke={score >= 70 ? "#5B9A6B" : score >= 50 ? "#D4A44E" : "#D4644E"} strokeWidth="3" strokeDasharray={`${score * 0.942} 100`} strokeLinecap="round" />
            </svg>
            <span className="absolute text-lg font-bold text-foreground">{score}</span>
          </div>
          <span className="text-xs font-semibold text-foreground">Health Score</span>
          <span className="text-[10px] text-muted-foreground">{passed}/{Math.max(1, total)} passing</span>
        </div>

        {[
          { label: "Passed", value: String(passed), color: "text-success", icon: <Check size={16} strokeWidth={2} /> },
          { label: "Warnings", value: String(warnings), color: "text-warning", icon: <AlertTriangle size={16} strokeWidth={1.5} /> },
          { label: "Failed", value: String(failed), color: "text-destructive", icon: <X size={16} strokeWidth={2} /> },
          { label: "Last Scan", value: data?.generationDate || "-", color: "text-foreground", icon: <RefreshCw size={16} strokeWidth={1.5} /> },
        ].map((stat) => (
          <div key={stat.label} className="card-hover flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-secondary", stat.color)}>{stat.icon}</div>
            <div>
              <span className={cn("text-xl font-semibold", stat.color)}>{stat.value}</span>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] text-muted-foreground">Client</p>
          <p className="text-sm font-semibold text-foreground">{data?.clientName || "-"}</p>
          <p className="mt-3 text-[11px] text-muted-foreground">Overall AEO Readiness</p>
          <p className="text-lg font-bold text-foreground">{summary?.overallAEOReadiness ?? 0}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] text-muted-foreground">Schema Audit</p>
          <p className="text-sm font-semibold text-foreground">
            {summary?.totalSchemas ?? 0} total | {summary?.schemaCounts?.valid ?? 0} valid | {summary?.schemaCounts?.incorrect ?? 0} incorrect | {summary?.schemaCounts?.missing ?? 0} missing
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground">Optimization Count</p>
          <p className="text-lg font-bold text-foreground">{summary?.optimizationCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] text-muted-foreground">Executive Summary</p>
          <p className="text-xs text-foreground">{data?.executiveSummary?.surface || "-"}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">Root Causes</p>
          <p className="text-xs text-foreground">{data?.executiveSummary?.rootCauses || "-"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {groups.map((group) => {
          const gPassed = group.checks.filter((c) => c.status === "pass").length;
          return (
            <div key={group.category} className="card-hover rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8 text-primary">
                    {categoryIcons[group.category] || <Wrench size={16} strokeWidth={1.5} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-card-foreground">{group.category}</h3>
                    <p className="text-[11px] text-muted-foreground">{gPassed}/{group.checks.length} passing</p>
                  </div>
                </div>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${group.checks.length ? (gPassed / group.checks.length) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="flex flex-col">
                {group.checks.map((check, i) => (
                  <div key={check.label} className={cn("flex items-start gap-3 px-5 py-3", i < group.checks.length - 1 && "border-b border-border/50")}>
                    <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", statusConfig[check.status].bg)}>
                      {statusConfig[check.status].icon}
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground">{check.label}</span>
                      <span className="text-[11px] leading-relaxed text-muted-foreground">{check.detail}</span>
                      {check.fix && (
                        <button className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80">
                          Fix: {check.fix}
                          <ArrowRight size={10} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
