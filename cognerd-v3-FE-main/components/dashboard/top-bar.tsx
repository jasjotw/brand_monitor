"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Coins,
  Filter,
  Plus,
  Search,
  Download,
} from "lucide-react";
import { getAuthToken } from "@/lib/auth";
import { AnimatedHamburger } from "./animated-hamburger";

function AddBrandButton() {
  const router = useRouter();
  const label = "Run Analysis";
  const [displayText, setDisplayText] = useState(label);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";

  const scramble = () => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(
        label
          .split("")
          .map((letter, index) => {
            if (letter === " ") return " ";
            if (index < iteration) return label[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );

      if (iteration >= label.length) clearInterval(interval);
      iteration += 1 / 2;
    }, 30);
  };

  return (
    <motion.button
      onClick={() => router.push("/dashboard/analyze")}
      onMouseEnter={scramble}
      onMouseLeave={() => setDisplayText(label)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.9, rotate: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
      className="nav-item group flex h-8 items-center justify-center rounded-lg bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 sm:px-3 overflow-hidden shadow-sm hover:shadow-md"
    >
      <motion.div
        animate={{ rotate: displayText !== label ? 90 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <Plus size={13} strokeWidth={2} />
      </motion.div>
      <span className="hidden sm:ml-1.5 sm:inline w-[88px] text-left tracking-tight font-semibold">
        {displayText}
      </span>
    </motion.button>
  );
}

interface TopBarProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  onSearchClick?: () => void;
  onFilterClick?: () => void;
  isMenuOpen?: boolean;
  showDownloadButton?: boolean;
  onDownloadClick?: () => void;
}

export function TopBar({
  title,
  subtitle,
  onMenuClick,
  onSearchClick,
  onFilterClick,
  isMenuOpen = false,
  showDownloadButton = false,
  onDownloadClick,
}: TopBarProps) {
  const NEURONS_PER_FULL_RUN = 50;
  const [neurons, setNeurons] = useState<number | null>(null);
  const [neuronsLoading, setNeuronsLoading] = useState(true);
  const [creditAnimKey, setCreditAnimKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchNeurons = async () => {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) {
          setNeurons(null);
          setNeuronsLoading(false);
        }
        return;
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
      const endpoints = [
        `${baseUrl}/api/brand-monitor/plans/current`,
        `${baseUrl}/api/brand-monitor/credits/balance`,
        `${baseUrl}/api/brand-monitor/credits`,
        `${baseUrl}/api/auth/me`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) continue;

          const payload = await response.json().catch(() => ({} as Record<string, unknown>));
          const candidates = [
            (payload as any)?.usage?.neuronsRemaining,
            (payload as any)?.usage?.remainingNeurons,
            (payload as any)?.remainingNeurons,
            (payload as any)?.remainingCredits,
            (payload as any)?.balance,
            (payload as any)?.neurons,
            (payload as any)?.credits,
            (payload as any)?.user?.remainingNeurons,
            (payload as any)?.user?.remainingCredits,
            (payload as any)?.user?.balance,
            (payload as any)?.user?.neurons,
            (payload as any)?.user?.credits,
          ];
          const firstValid = candidates.find((value) => Number.isFinite(Number(value)));
          if (firstValid !== undefined) {
            if (!cancelled) {
              setNeurons(Number(firstValid));
              setNeuronsLoading(false);
            }
            return;
          }
        } catch {
          // Try next endpoint
        }
      }

      if (!cancelled) {
        setNeurons(null);
        setNeuronsLoading(false);
      }
    };

    fetchNeurons();
    const interval = window.setInterval(fetchNeurons, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const creditLevel = useMemo(() => {
    if (neurons === null) return "unknown" as const;
    if (neurons <= 0) return "empty" as const;
    if (neurons <= 10) return "low" as const;
    if (neurons <= 30) return "medium" as const;
    if (neurons <= 70) return "high" as const;
    return "full" as const;
  }, [neurons]);

  const creditLevelStyle: Record<string, string> = {
    unknown: "border-border bg-secondary/40 text-foreground",
    empty: "border-destructive/40 bg-destructive/10 text-destructive",
    low: "border-orange-400/40 bg-orange-400/10 text-orange-700 dark:text-orange-300",
    medium: "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300",
    high: "border-emerald-400/40 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
    full: "border-primary/40 bg-primary/10 text-primary",
  };

  const runsLeftLabel = useMemo(() => {
    if (neuronsLoading) return "Calculating runs left...";
    if (neurons === null) return "Runs left unavailable";
    const runsLeft = Math.round((neurons / NEURONS_PER_FULL_RUN) * 10) / 10;
    return `${runsLeft} run${runsLeft === 1 ? "" : "s"} left`;
  }, [neurons, neuronsLoading]);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <AnimatedHamburger 
            isOpen={isMenuOpen} 
            onClick={onMenuClick} 
            className="lg:hidden"
          />
        )}
        <div className="flex flex-col">
          <h1 className="text-[16px] font-semibold tracking-tight text-foreground sm:text-lg">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden text-xs tracking-tight text-muted-foreground sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {/* Search Toggle */}
        <button
          onClick={onSearchClick}
          className="nav-item flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Toggle search"
        >
          <Search size={16} strokeWidth={1.5} />
        </button>

        {/* Filter Toggle */}
        <button
          onClick={onFilterClick ?? onSearchClick}
          className="nav-item flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Toggle filters"
        >
          <Filter size={16} strokeWidth={1.5} />
        </button>

        {showDownloadButton && (
          <button
            onClick={onDownloadClick}
            data-diagnostics-download-trigger="true"
            className="nav-item flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Download diagnostics"
            title="Download diagnostics"
          >
            <Download size={16} strokeWidth={1.5} />
          </button>
        )}

        <div className="hidden h-5 w-px bg-border sm:block" />

        <div className="group relative">
          <motion.button
            key={creditAnimKey}
            onClick={() => setCreditAnimKey((k) => k + 1)}
            whileTap={{ scale: 0.97 }}
            initial={{ scale: 1, y: 0 }}
            animate={{ scale: [1, 1.05, 1], y: [0, -1, 0] }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs ${creditLevelStyle[creditLevel]}`}
            aria-label="ɲ balance"
            title={`Available ɲ. ${runsLeftLabel}`}
          >
            <motion.span
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <Coins size={13} strokeWidth={1.7} />
            </motion.span>
            <span className="font-semibold tabular-nums tracking-tight">
              {neuronsLoading ? "..." : neurons !== null ? `${neurons.toFixed(1)}ɲ` : "--"}
            </span>
            <span className="hidden text-[10px] font-medium capitalize opacity-80 sm:inline">
              {creditLevel === "unknown" ? "ɲ" : creditLevel}
            </span>
          </motion.button>
          <div className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-foreground shadow-sm group-hover:block">
            {runsLeftLabel}
          </div>
        </div>

        <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />

        {/* Add brand - icon only on mobile */}
        <AddBrandButton />
      </div>
    </header>
  );
}
