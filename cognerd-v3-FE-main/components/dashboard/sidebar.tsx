"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Eye,
  Users,
  FileText,
  MessageSquare,
  Link2,
  Wrench,
  Bell,
  Settings,
  ChevronLeft,
  Sparkles,
  Network,
  Cloud
} from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  id: string;
  href: string;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Monitor",
    items: [
      { label: "Overview", icon: <LayoutDashboard size={18} strokeWidth={1.5} />, id: "overview", href: "/dashboard" },
      { label: "AI Visibility", icon: <Eye size={18} strokeWidth={1.5} />, id: "visibility", href: "/dashboard/visibility", badge: "Live" },
      { label: "Competitors", icon: <Users size={18} strokeWidth={1.5} />, id: "competitors", href: "/dashboard/competitors" },
      { label: "Personas & ICP", icon: <Users size={18} strokeWidth={1.5} />, id: "audience", href: "/dashboard/audience", badge: "New" },
      { label: "Prompt Analytics", icon: <MessageSquare size={18} strokeWidth={1.5} />, id: "prompts", href: "/dashboard/prompts" },
    ],
  },
  {
    title: "Optimize",
    items: [
      { label: "Content Studio", icon: <FileText size={18} strokeWidth={1.5} />, id: "content", href: "/dashboard/content" },
      { label: "AGXP Edge Delivery", icon: <Cloud size={18} strokeWidth={1.5} />, id: "agxp", href: "/dashboard/agxp", badge: "New" },
      { label: "Source Attribution", icon: <Link2 size={18} strokeWidth={1.5} />, id: "sources", href: "/dashboard/sources" },
      { label: "Diagnostics", icon: <Wrench size={18} strokeWidth={1.5} />, id: "diagnostics", href: "/dashboard/diagnostics" },
    ],
  },
  {
    title: "Search Engine Nexus",
    items: [
      {
        label: "Backlinks",
        icon: <Network size={18} strokeWidth={1.5} />,
        id: "backlinks",
        href: "/dashboard/backlinks",
      },
    ],
  },
  {
    title: "Manage",
    items: [
      { label: "Alerts", icon: <Bell size={18} strokeWidth={1.5} />, id: "alerts", href: "/dashboard/alerts", badge: "3" },
      { label: "Settings", icon: <Settings size={18} strokeWidth={1.5} />, id: "settings", href: "/dashboard/settings" },
    ],
  },
];

const textVariants = {
  expanded: { opacity: 1, x: 0, display: "block", transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
  collapsed: { opacity: 0, x: -12, transition: { duration: 0.3 }, transitionEnd: { display: "none" } },
};

function NavItemComponent({ 
  item, 
  activeItem, 
  collapsed, 
  onNavigate,
  onVisibilityClick
}: { 
  item: NavItem; 
  activeItem: string; 
  collapsed: boolean; 
  onNavigate?: (id: string) => void;
  onVisibilityClick?: () => void;
}) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const handlePointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setRipples((prev) => [...prev, { 
      id: Date.now(), 
      x: e.clientX - rect.left, 
      y: e.clientY - rect.top 
    }]);
    
    if (onNavigate) onNavigate(item.id);
  };

  const handleIconPointerDown = (e: React.PointerEvent) => {
    if (item.id === "visibility" && onVisibilityClick) {
      // We don't necessarily want to stop propagation here because 
      // the user might still want the link navigation to happen.
      // But we call the dimming specifically here.
      onVisibilityClick();
    }
  };

  useEffect(() => {
    if (ripples.length > 0) {
      const timer = setTimeout(() => setRipples((prev) => prev.slice(1)), 800);
      return () => clearTimeout(timer);
    }
  }, [ripples]);

  return (
    <motion.li
      layout
      variants={{
        expanded: { x: 0, opacity: 1 },
        collapsed: { x: [0, 25, 0], transition: { duration: 0.7, ease: [0.23, 1, 0.32, 1] } }
      }}
      className="relative z-10"
    >
      <Link
        href={item.href}
        onPointerDown={handlePointerDown}
        className={cn(
          "nav-item group/item relative flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[14px] font-medium transition-colors overflow-hidden",
          activeItem === item.id
            ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
            : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          collapsed && "justify-center px-0"
        )}
        title={collapsed ? item.label : undefined}
      >
        <AnimatePresence>
          {ripples.map((ripple) => (
            <motion.span
              key={ripple.id}
              initial={{ scale: 0, opacity: 0.5 }}
              animate={{ scale: 12, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute rounded-full bg-primary/30 pointer-events-none z-0"
              style={{
                left: ripple.x,
                top: ripple.y,
                width: 20,
                height: 20,
                marginLeft: -10,
                marginTop: -10,
              }}
            />
          ))}
        </AnimatePresence>

        <motion.span
          layout
          onPointerDown={handleIconPointerDown}
          className={cn(
            "relative z-20 shrink-0", 
            item.id === "alerts" ? "origin-top" : "origin-center",
            activeItem === item.id && "text-primary"
          )}
          whileHover={
            item.id === "alerts" 
              ? { rotate: [0, -20, 20, -10, 10, -5, 5, 0], transition: { duration: 0.5 } }
              : item.id === "settings"
              ? { rotate: 180, transition: { duration: 0.5, ease: "easeInOut" } }
              : {}
          }
        >
          {item.icon}
        </motion.span>
        
        <motion.div variants={textVariants} className="relative z-10 flex flex-1 items-center overflow-hidden">
          <span className="truncate">{item.label}</span>
          {item.badge && (
                                    <span
                                      className={cn(
                                        "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                                        item.badge === "Live"
                                          ? "bg-success/10 text-success"
                                          : "bg-primary/10 text-primary"
                                      )}
                                    >
              {item.badge}
            </span>
          )}
        </motion.div>
      </Link>
    </motion.li>
  );
}

function BrandSection({ collapsed, textVariants }: { collapsed: boolean; textVariants: any }) {
  const brandName = "Acme Corp";
  const brandUrl = "acme-corp.ai";
  const [displayBrand, setDisplayBrand] = useState(brandName);
  const [isHovered, setIsHovered] = useState(false);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";

  const scramble = () => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayBrand(
        brandName
          .split("")
          .map((letter, index) => {
            if (index < iteration) return brandName[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );

      if (iteration >= brandName.length) clearInterval(interval);
      iteration += 1 / 3;
    }, 30);
  };

  return (
    <div 
      className="border-t border-sidebar-border p-3 overflow-hidden"
      onMouseEnter={() => {
        setIsHovered(true);
        scramble();
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setDisplayBrand(brandName);
      }}
    >
      <div className={cn("group/brand flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent/50", collapsed && "justify-center px-0")}>
        <motion.div 
          layout
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground z-20 relative overflow-hidden"
        >
          <motion.span
            animate={isHovered ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            A
          </motion.span>
          <AnimatePresence>
            {isHovered && (
              <motion.span 
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1.5 }}
                exit={{ opacity: 0, scale: 0 }}
                className="absolute inset-0 bg-primary/10 rounded-full"
              />
            )}
          </AnimatePresence>
        </motion.div>
        
        <motion.div variants={textVariants} className="flex flex-col overflow-hidden whitespace-nowrap">
          <span className="truncate text-sm font-semibold text-sidebar-foreground font-mono">
            {displayBrand}
          </span>
          <div className="relative h-4">
            <AnimatePresence mode="wait">
              {!isHovered ? (
                <motion.span
                  key="plan"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute inset-0 truncate text-xs text-muted-foreground"
                >
                  Pro Plan
                </motion.span>
              ) : (
                <motion.span
                  key="url"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute inset-0 truncate text-xs font-medium text-primary"
                >
                  {brandUrl}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function Sidebar({
  activeItem,
  onNavigate,
  collapsed,
  onToggleCollapse,
  locked = false,
}: {
  activeItem: string;
  onNavigate?: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  locked?: boolean;
}) {
  const [isDimmed, setIsDimmed] = useState(false);

  const handleVisibilityClick = () => {
    setIsDimmed(true);
    setTimeout(() => setIsDimmed(false), 10000);
  };

  return (
    <motion.aside
      initial={false}
      animate={collapsed ? "collapsed" : "expanded"}
      variants={{
        expanded: { width: "260px", transition: { staggerChildren: 0.04, staggerDirection: -1, duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
        collapsed: { width: "68px", transition: { staggerChildren: 0.04, staggerDirection: 1, duration: 0.5, ease: [0.23, 1, 0.32, 1] } }
      }}
      className="flex h-screen flex-col border-r border-sidebar-border bg-sidebar relative"
    >
      {locked && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-sidebar/80 backdrop-blur-sm px-6 text-center">
          <div className="rounded-xl border border-sidebar-border bg-card px-4 py-3 text-xs font-medium text-foreground shadow-sm">
            Add your first brand to unlock the workspace.
          </div>
        </div>
      )}

      <motion.div
        animate={{ opacity: isDimmed ? 0.05 : locked ? 0.5 : 1 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="flex flex-1 flex-col overflow-hidden pointer-events-auto"
        style={{ pointerEvents: isDimmed || locked ? "none" : "auto" }}
      >
        <div className={cn("flex h-16 items-center border-b border-sidebar-border overflow-hidden transition-all", collapsed ? "px-1 justify-end gap-1" : "px-4 justify-between")}>
          <div className="flex items-center gap-2.5 min-w-0">
            <motion.div layout className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary z-20 relative">
              <Sparkles size={16} className="text-primary-foreground" strokeWidth={1.5} />
            </motion.div>
            <motion.span variants={textVariants} className="text-[15px] font-semibold tracking-tight text-sidebar-foreground whitespace-nowrap">CogNerd</motion.span>
          </div>
          <button onClick={onToggleCollapse} className={cn("group relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden transition-all z-20", collapsed ? "rounded-xl bg-primary/5 text-primary" : "rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground")}>
            <span className="absolute inset-0 scale-0 rounded-full bg-primary/10 transition-transform group-hover:scale-100 group-active:scale-90" />
            <div className={cn("relative flex items-center transition-transform duration-500 ease-[cubic-bezier(0.68,-0.6,0.32,1.6)]", collapsed && "rotate-180")}>
              <ChevronLeft size={18} strokeWidth={2} className="group-hover:-translate-x-0.5 transition-transform" />
              <ChevronLeft size={18} strokeWidth={2} className="absolute left-0 -translate-x-4 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-40" />
            </div>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-4">
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap">
                    {group.title}
                  </motion.p>
                )}
              </AnimatePresence>
              {collapsed && <div className="mb-1.5 h-px bg-sidebar-border mx-2" />}
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavItemComponent 
                    key={item.id} 
                    item={item} 
                    activeItem={activeItem} 
                    collapsed={collapsed} 
                    onNavigate={onNavigate} 
                    onVisibilityClick={handleVisibilityClick}
                  />
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <BrandSection collapsed={collapsed} textVariants={textVariants} />
      </motion.div>
    </motion.aside>
  );
}
