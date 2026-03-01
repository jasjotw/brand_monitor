"use client";

import { cn } from "@/lib/utils";
import { Check, X, AlertTriangle } from "lucide-react";

interface DiagnosticItem {
  label: string;
  status: "pass" | "fail" | "warning";
  detail: string;
}

const diagnostics: DiagnosticItem[] = [
  { label: "AI Crawlability", status: "pass", detail: "All pages accessible to AI crawlers" },
  { label: "Structured Data", status: "pass", detail: "Schema markup validated on 94% of pages" },
  { label: "Content Freshness", status: "warning", detail: "12 pages not updated in 30+ days" },
  { label: "Citation Anchors", status: "pass", detail: "Proper citation-friendly formatting" },
  { label: "robots.txt AI Rules", status: "fail", detail: "Missing GPTBot and GoogleOther directives" },
  { label: "Page Load Speed", status: "pass", detail: "Average 1.2s load time" },
];

const statusConfig = {
  pass: {
    icon: <Check size={12} strokeWidth={2.5} />,
    iconBg: "bg-success/10 text-success",
    text: "text-success",
  },
  fail: {
    icon: <X size={12} strokeWidth={2.5} />,
    iconBg: "bg-destructive/10 text-destructive",
    text: "text-destructive",
  },
  warning: {
    icon: <AlertTriangle size={12} strokeWidth={2} />,
    iconBg: "bg-warning/10 text-warning",
    text: "text-warning",
  },
};

export function AIHealthScore() {
  const passed = diagnostics.filter((d) => d.status === "pass").length;
  const total = diagnostics.length;
  const score = Math.round((passed / total) * 100);

  return (
    <div className="card-hover flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">AI Health Check</h3>
          <p className="text-xs text-muted-foreground">Technical diagnostics for AI discovery</p>
        </div>
        {/* Circular score */}
        <div className="relative flex h-12 w-12 items-center justify-center">
          <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#F5F0EB" strokeWidth="2.5" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke={score >= 70 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444"}
              strokeWidth="2.5"
              strokeDasharray={`${score * 0.942} 100`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-xs font-bold text-foreground">{score}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {diagnostics.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/30"
          >
            <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", statusConfig[item.status].iconBg)}>
              {statusConfig[item.status].icon}
            </div>
            <div className="flex flex-1 flex-col gap-0">
              <span className="text-xs font-medium text-foreground">{item.label}</span>
              <span className="text-[10px] text-muted-foreground">{item.detail}</span>
            </div>
            <span className={cn("text-[10px] font-medium uppercase", statusConfig[item.status].text)}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
