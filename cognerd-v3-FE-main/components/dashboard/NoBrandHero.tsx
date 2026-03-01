"use client";

export default function NoBrandHero() {
  return (
    <div
      className="relative isolate overflow-hidden rounded-2xl border border-sidebar-border bg-gradient-to-br from-[#FFEDE0]/40 to-[#FFF6EA]/10 p-4 shadow-[0_10px_60px_rgba(0,0,0,0.08)]"
      style={{ minHeight: "320px" }}
    >
      <div className="absolute inset-0 border border-[#FF9C42]/20 blur-[1px]" />
      <div className="absolute inset-4 rounded-2xl bg-gradient-to-br from-[#ffffff]/10 to-[#FF751F]/10 opacity-70" />
      <img
        src="/images/no-ai-signals.png"
        alt="No AI signals detected"
        className="relative mx-auto h-[280px] w-full max-w-[360px] object-cover scale-[1.05]"
        style={{ transformOrigin: "center" }}
      />
    </div>
  );
}
