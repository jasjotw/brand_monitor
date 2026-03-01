"use client";

import { cn } from "@/lib/utils";

interface VisibilityScoreProps {
  score: number;
  change: number;
  label: string;
}

export function VisibilityScore({ score, change, label }: VisibilityScoreProps) {
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score / 100) * circumference;

  const getScoreColor = (s: number) => {
    if (s >= 70) return "#10B981"; // success
    if (s >= 50) return "#F59E0B"; // warning
    return "#EF4444"; // destructive
  };

  return (
    <div className="card-hover flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6">
      {/* Radial gauge */}
      <div className="relative flex h-[140px] w-[140px] items-center justify-center">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          {/* Background track */}
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="#F5F0EB"
            strokeWidth="8"
          />
          {/* Score arc */}
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke={getScoreColor(score)}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
          {/* Decorative inner ring */}
          <circle
            cx="60"
            cy="60"
            r="44"
            fill="none"
            stroke="#F5F0EB"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-bold tracking-tight text-foreground">{score}</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            / 100
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "text-xs font-medium",
              change >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {change >= 0 ? "+" : ""}{change}%
          </span>
          <span className="text-[12px] text-muted-foreground">vs last week</span>
        </div>
      </div>
    </div>
  );
}
