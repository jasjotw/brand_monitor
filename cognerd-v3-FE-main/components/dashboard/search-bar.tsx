"use client";

import { Search, X, Calendar, Globe, ChevronDown, Check } from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  selectedDateValue: string;
  onDateChange: (value: string) => void;
  selectedPlatformValue: string;
  onPlatformChange: (value: string) => void;
}

const dateOptions = [
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Year to date", value: "ytd" },
  { label: "Custom Range", value: "custom" },
];

const platformOptions = [
  { label: "All Platforms", value: "all", color: "#000000" },
  { label: "ChatGPT", value: "chatgpt", color: "#10A37F" },
  { label: "Gemini", value: "gemini", color: "#1A73E8" },
  { label: "Perplexity", value: "perplexity", color: "#20C2D5" },
  { label: "Claude", value: "claude", color: "#D97757" },
  { label: "AI Overviews", value: "ai-overviews", color: "#F9AB00" },
];

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

export function SearchBar({
  isOpen,
  onClose,
  query,
  onQueryChange,
  selectedDateValue,
  onDateChange,
  selectedPlatformValue,
  onPlatformChange,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<"date" | "platform" | null>(null);
  const selectedDateLabel =
    dateOptions.find((opt) => opt.value === selectedDateValue)?.label || "Last 7 days";
  const selectedPlatformLabel =
    platformOptions.find((opt) => opt.value === selectedPlatformValue)?.label || "All Platforms";

  // Generate random shuffle offsets for the platform items
  const shuffleOffsets = useMemo(() => 
    platformOptions.map(() => ({
      x: (Math.random() - 0.5) * 40,
      y: (Math.random() - 0.5) * 20,
    })), []);

  // Handle ESC key and Auto-focus
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeDropdown) {
          setActiveDropdown(null);
        } else if (isOpen) {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeDropdown, onClose]);

  // Reset dropdown when search bar closes
  useEffect(() => {
    if (!isOpen) setActiveDropdown(null);
  }, [isOpen]);

  const dropdownContainerVariants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] }
    },
    exit: { 
      opacity: 0, 
      y: -5, 
      scale: 0.98,
      transition: { duration: 0.15 }
    }
  };

  return (
    <div
      className={cn(
        "relative z-30 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
        isOpen 
          ? "max-h-20 opacity-100 translate-y-0 visible py-2" 
          : "max-h-0 opacity-0 -translate-y-4 invisible py-0"
      )}
    >
      <div className="px-4 sm:px-6">
        <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 shadow-sm transition-all hover:border-primary/40">
          <div className="flex flex-1 items-center">
            <Search className="mr-3 text-muted-foreground" size={16} strokeWidth={2} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search dashboard..."
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/60"
            />
          </div>

          <div className="hidden h-5 w-px bg-border md:block" />

          {/* Quick Filters inside Search Bar */}
          <div className="hidden items-center gap-2 md:flex">
            {/* Date Filter */}
            <div className="relative">
              <button 
                onClick={() => setActiveDropdown(activeDropdown === "date" ? null : "date")}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11px] font-medium transition-colors hover:bg-secondary",
                  activeDropdown === "date" ? "bg-secondary text-primary border-primary/30" : "bg-card text-foreground"
                )}
              >
                <Calendar size={12} strokeWidth={1.5} className={cn(activeDropdown === "date" ? "text-primary" : "text-muted-foreground")} />
                <span>{selectedDateLabel}</span>
                <ChevronDown size={10} strokeWidth={1.5} className={cn("transition-transform", activeDropdown === "date" && "rotate-180")} />
              </button>

              <AnimatePresence>
                {activeDropdown === "date" && (
                  <motion.div
                    variants={dropdownContainerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute right-0 top-9 z-50 w-44 rounded-xl border border-border bg-card p-1 shadow-xl"
                  >
                    <motion.div variants={listVariants} initial="hidden" animate="visible">
                      {dateOptions.map((opt) => (
                        <motion.button
                          key={opt.value}
                          variants={{
                            hidden: { opacity: 0, x: -10 },
                            visible: { opacity: 1, x: 0 }
                          }}
                          onClick={() => {
                            onDateChange(opt.value);
                            setActiveDropdown(null);
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        >
                          {opt.label}
                          {selectedDateValue === opt.value && <Check size={12} className="text-primary" />}
                        </motion.button>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Platform Filter */}
            <div className="relative">
              <button 
                onClick={() => setActiveDropdown(activeDropdown === "platform" ? null : "platform")}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11px] font-medium transition-colors hover:bg-secondary",
                  activeDropdown === "platform" ? "bg-secondary text-primary border-primary/30" : "bg-card text-foreground"
                )}
              >
                <Globe size={12} strokeWidth={1.5} className={cn(activeDropdown === "platform" ? "text-primary" : "text-muted-foreground")} />
                <span>{selectedPlatformLabel}</span>
                <ChevronDown size={10} strokeWidth={1.5} className={cn("transition-transform", activeDropdown === "platform" && "rotate-180")} />
              </button>

              <AnimatePresence>
                {activeDropdown === "platform" && (
                  <motion.div
                    variants={dropdownContainerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute right-0 top-9 z-50 w-44 rounded-xl border border-border bg-card p-1 shadow-xl"
                  >
                    <motion.div variants={listVariants} initial="hidden" animate="visible">
                      {platformOptions.map((opt, i) => (
                        <motion.button
                          key={opt.value}
                          variants={{
                            hidden: { 
                              opacity: 0, 
                              x: shuffleOffsets[i].x, 
                              y: shuffleOffsets[i].y,
                              scale: 0.8,
                              filter: "blur(4px)" 
                            },
                            visible: { 
                              opacity: 1, 
                              x: 0, 
                              y: 0,
                              scale: 1,
                              filter: "blur(0px)",
                              transition: { type: "spring", stiffness: 400, damping: 25 }
                            }
                          }}
                          onClick={() => {
                            onPlatformChange(opt.value);
                            setActiveDropdown(null);
                          }}
                          className="group/item flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium text-sidebar-muted transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        >
                          <span 
                            className="h-2 w-2 shrink-0 rounded-full transition-transform group-hover/item:scale-125" 
                            style={{ backgroundColor: opt.color }} 
                          />
                          <span className="flex-1" style={{ color: selectedPlatformValue === opt.value ? opt.color : undefined }}>
                            {opt.label}
                          </span>
                          {selectedPlatformValue === opt.value && <Check size={12} style={{ color: opt.color }} />}
                        </motion.button>
                      ))}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-2">
            <span className="hidden text-[10px] font-medium text-muted-foreground/50 sm:block">ESC</span>
            <button
              onClick={onClose}
              className="group/close flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted"
            >
              <X size={14} className="text-muted-foreground group-hover/close:text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
