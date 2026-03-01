"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { VISIBILITY_TREND_DATA, PLATFORMS_CONFIG } from "@/lib/data/visibility-data";

type TrendSeries = { key: string; label: string; color: string };

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
      <p className="mb-1.5 text-xs font-medium text-foreground">{label}</p>
      {payload.map((entry: any) => (
        <div
          key={entry.dataKey}
          className="flex items-center justify-between gap-4 text-xs"
        >
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-medium text-foreground">{entry.value}%</span>
        </div>
      ))}
    </div>
  );
}

export function VisibilityTrendChart({
  data = VISIBILITY_TREND_DATA,
  series = PLATFORMS_CONFIG.map((p) => ({ key: p.key, label: p.label, color: p.color })),
  title = "Visibility Trend",
  subtitle = "Brand visibility score across AI platforms",
}: {
  data?: Record<string, any>[];
  series?: TrendSeries[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {series.map((p) => (
            <div key={p.key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-[11px] text-muted-foreground">
                {p.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#E8E4E0"
              strokeOpacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#000000" }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#000000" }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            {series.map((p) => (
              <Area
                key={p.key}
                type="monotone"
                dataKey={p.key}
                name={p.label}
                stroke={p.color}
                strokeWidth={2}
                fill="none"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: "#FFFFFF" }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
