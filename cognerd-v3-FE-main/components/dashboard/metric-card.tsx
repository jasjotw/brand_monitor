"use client";

import React from "react"

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAnalysisVisibility } from "@/lib/analysis-context";

interface MetricCardProps {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  accent?: "primary" | "success" | "warning" | "muted";
}

export function MetricCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  accent = "primary",
}: MetricCardProps) {
  const { showValues } = useAnalysisVisibility();
  const accentColors = {
    primary: "bg-primary/8",
    success: "bg-success/8",
    warning: "bg-warning/8",
    muted: "bg-muted",
  };

  const iconColors = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    muted: "text-muted-foreground",
  };

  return (
    <div className="card-hover flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            accentColors[accent]
          )}
        >
          <span className={iconColors[accent]}>{icon}</span>
        </div>
        {change !== undefined && (
          <div
            className={cn(
              "flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium",
              change > 0
                ? "bg-success/8 text-success"
                : change < 0
                  ? "bg-destructive/8 text-destructive"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {change > 0 ? (
              <TrendingUp size={12} strokeWidth={2} />
            ) : change < 0 ? (
              <TrendingDown size={12} strokeWidth={2} />
            ) : (
              <Minus size={12} strokeWidth={2} />
            )}
            <span>
              {change > 0 ? "+" : ""}
              {change}%
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className={cn("text-2xl font-semibold tracking-tight", showValues ? "text-card-foreground" : "text-muted-foreground/60")}>
          {showValues ? value : "—"}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      {changeLabel && (
        <p className="text-[12px] text-muted-foreground">{changeLabel}</p>
      )}
    </div>
  );
}
