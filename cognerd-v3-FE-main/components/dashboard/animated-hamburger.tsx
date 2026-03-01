"use client";

import { cn } from "@/lib/utils";

interface AnimatedHamburgerProps {
  isOpen: boolean;
  onClick: () => void;
  className?: string;
}

export function AnimatedHamburger({ isOpen, onClick, className }: AnimatedHamburgerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/50 transition-all duration-300 hover:bg-primary/10",
        isOpen && "bg-primary/10",
        className
      )}
      aria-label={isOpen ? "Close menu" : "Open menu"}
    >
      <div className="relative h-5 w-5">
        {/* Top Bar */}
        <span
          className={cn(
            "absolute left-0 top-0 h-0.5 w-5 rounded-full bg-foreground transition-all duration-500 ease-[cubic-bezier(0.68,-0.6,0.32,1.6)] group-hover:bg-primary",
            isOpen ? "top-[9px] rotate-[135deg]" : "group-hover:w-3"
          )}
        />
        
        {/* Middle Bar */}
        <span
          className={cn(
            "absolute left-0 top-[9px] h-0.5 w-5 rounded-full bg-foreground transition-all duration-300 group-hover:bg-primary",
            isOpen ? "scale-0 opacity-0" : "group-hover:w-5"
          )}
        />
        
        {/* Bottom Bar */}
        <span
          className={cn(
            "absolute left-0 top-[18px] h-0.5 w-5 rounded-full bg-foreground transition-all duration-500 ease-[cubic-bezier(0.68,-0.6,0.32,1.6)] group-hover:bg-primary",
            isOpen ? "top-[9px] -rotate-[135deg]" : "group-hover:w-4"
          )}
        />
      </div>

      {/* Pulsing ring effect on hover */}
      <span className="absolute inset-0 rounded-xl border border-primary/0 transition-all duration-300 group-hover:scale-110 group-hover:border-primary/20 group-active:scale-95" />
    </button>
  );
}
