"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bell,
  Calendar,
  ChevronDown,
  Download,
  Filter,
  Globe,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
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
      <span className="hidden sm:ml-1.5 sm:inline font-mono w-[88px] text-left">
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
  isMenuOpen?: boolean;
}

export function TopBar({ title, subtitle, onMenuClick, onSearchClick, isMenuOpen = false }: TopBarProps) {
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
            <p className="hidden text-xs text-muted-foreground sm:block">{subtitle}</p>
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
          onClick={onSearchClick}
          className="nav-item flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Toggle filters"
        >
          <Filter size={16} strokeWidth={1.5} />
        </button>

        <div className="hidden h-5 w-px bg-border sm:block" />

        {/* Refresh */}
        <button
          className="nav-item hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground sm:flex"
          aria-label="Refresh data"
        >
          <RefreshCw size={14} strokeWidth={1.5} />
        </button>

        {/* Export - icon only */}
        <button
          className="nav-item flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Export data"
        >
          <Download size={14} strokeWidth={1.5} />
        </button>

        <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />

        {/* Add brand - icon only on mobile */}
        <AddBrandButton />
      </div>
    </header>
  );
}
