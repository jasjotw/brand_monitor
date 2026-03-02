"use client";

import React, { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { User, Building2, Key, Bell, Users, Database, Plug, Shield, CreditCard } from "lucide-react";
import { getAuthToken } from "@/lib/auth";

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const sections: SettingSection[] = [
  { id: "profile", title: "Profile", description: "Manage your personal account details", icon: <User size={18} strokeWidth={1.5} /> },
  { id: "organization", title: "Organization", description: "Company settings and branding", icon: <Building2 size={18} strokeWidth={1.5} /> },
  { id: "team", title: "Team Members", description: "Invite and manage team access", icon: <Users size={18} strokeWidth={1.5} /> },
  { id: "api", title: "API Access", description: "Manage API keys and webhooks", icon: <Key size={18} strokeWidth={1.5} /> },
  { id: "notifications", title: "Notifications", description: "Configure alert preferences", icon: <Bell size={18} strokeWidth={1.5} /> },
  { id: "integrations", title: "Integrations", description: "Connect CMS, analytics, and tools", icon: <Plug size={18} strokeWidth={1.5} /> },
  { id: "data", title: "Data & Export", description: "Export settings and BI connectors", icon: <Database size={18} strokeWidth={1.5} /> },
  { id: "billing", title: "Billing & Plans", description: "Manage subscription and usage", icon: <CreditCard size={18} strokeWidth={1.5} /> },
  { id: "security", title: "Security", description: "Password, 2FA, and sessions", icon: <Shield size={18} strokeWidth={1.5} /> },
];

const teamMembers = [
  { name: "Alex Chen", email: "alex@acme.com", role: "Owner", status: "active" },
  { name: "Sarah Kim", email: "sarah@acme.com", role: "Admin", status: "active" },
  { name: "James Wilson", email: "james@acme.com", role: "Editor", status: "active" },
  { name: "Priya Patel", email: "priya@acme.com", role: "Viewer", status: "invited" },
];

const integrations = [
  { name: "WordPress", category: "CMS", connected: true },
  { name: "Google Search Console", category: "SEO", connected: true },
  { name: "Looker Studio", category: "BI", connected: false },
  { name: "Slack", category: "Notifications", connected: true },
  { name: "Zapier", category: "Automation", connected: false },
  { name: "HubSpot", category: "CRM", connected: false },
];

const roleColors: Record<string, string> = {
  Owner: "bg-primary/10 text-primary",
  Admin: "bg-success/10 text-success",
  Editor: "bg-warning/10 text-warning",
  Viewer: "bg-secondary text-muted-foreground",
};

export function SettingsPage() {
  const searchParams = useSearchParams();
  const section = searchParams.get("section");
  const globalQuery = (searchParams.get("q") || "").trim().toLowerCase();
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro" | "business">("basic");
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planMetrics, setPlanMetrics] = useState<{
    neuronsRemaining: number;
    monthlyNeurons: number;
    analysesThisMonth: number;
    promptsRunThisMonth: number;
    brandsTracked: number;
    maxBrands: number | null;
  }>({
    neuronsRemaining: 0,
    monthlyNeurons: 0,
    analysesThisMonth: 0,
    promptsRunThisMonth: 0,
    brandsTracked: 0,
    maxBrands: null,
  });
  const [planCatalog, setPlanCatalog] = useState<
    Array<{
      code: "basic" | "pro" | "business";
      name: string;
      description: string;
      monthlyNeurons: number;
      features: Record<string, { enabled: boolean; limitValue: number | null }>;
    }>
  >([]);

  const baseUrl = process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setPlanLoading(false);
      return;
    }

    fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const plan = String(data?.user?.plan || "").toLowerCase();
        if (plan === "basic" || plan === "pro" || plan === "business") {
          setSelectedPlan(plan);
        }
      })
      .catch(() => null);

    fetch(`${baseUrl}/api/brand-monitor/plans/current`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error?.message || payload?.error || "Failed to load plan details");
        }
        return payload;
      })
      .then((payload) => {
        const code = String(payload?.plan?.code || "").toLowerCase();
        if (code === "basic" || code === "pro" || code === "business") {
          setSelectedPlan(code);
        }

        setPlanMetrics({
          neuronsRemaining: Number(payload?.usage?.neuronsRemaining ?? 0),
          monthlyNeurons: Number(payload?.plan?.monthlyNeurons ?? 0),
          analysesThisMonth: Number(payload?.usage?.analysesThisMonth ?? 0),
          promptsRunThisMonth: Number(payload?.usage?.promptsRunThisMonth ?? 0),
          brandsTracked: Number(payload?.usage?.brandsTracked ?? 0),
          maxBrands:
            payload?.limits?.maxBrands === null || payload?.limits?.maxBrands === undefined
              ? null
              : Number(payload.limits.maxBrands),
        });
      })
      .catch((error) => {
        setPlanError(error instanceof Error ? error.message : "Failed to load plan details");
      })
      .finally(() => setPlanLoading(false));

    fetch(`${baseUrl}/api/brand-monitor/plans/catalog`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return null;
        return payload;
      })
      .then((payload) => {
        if (!payload || !Array.isArray(payload.plans)) return;
        const normalized = payload.plans
          .map((p: any) => ({
            code: String(p?.code || "").toLowerCase(),
            name: String(p?.name || ""),
            description: String(p?.description || ""),
            monthlyNeurons: Number(p?.monthlyNeurons ?? 0),
            features:
              p?.features && typeof p.features === "object"
                ? p.features
                : {},
          }))
          .filter((p: any) => p.code === "basic" || p.code === "pro" || p.code === "business");
        setPlanCatalog(
          normalized as Array<{
            code: "basic" | "pro" | "business";
            name: string;
            description: string;
            monthlyNeurons: number;
            features: Record<string, { enabled: boolean; limitValue: number | null }>;
          }>
        );
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (section === "billing") {
      const target = document.getElementById("billing-section");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [section]);

  const planName = useMemo(() => {
    if (selectedPlan === "business") return "Business";
    if (selectedPlan === "pro") return "Pro";
    return "Basic";
  }, [selectedPlan]);

  const planCards = useMemo(() => {
    if (planCatalog.length > 0) {
      return planCatalog.map((plan) => {
        const maxBrands = plan.features?.["brands.max"]?.limitValue;
        const brandsText =
          maxBrands && Number.isFinite(Number(maxBrands))
            ? `${Number(maxBrands)} brand${Number(maxBrands) === 1 ? "" : "s"}`
            : "Custom brand limit";
        return {
          code: plan.code,
          label: plan.name || plan.code.charAt(0).toUpperCase() + plan.code.slice(1),
          neurons: plan.monthlyNeurons,
          detail: brandsText,
        };
      });
    }

    return [
      { code: "basic" as const, label: "Basic", neurons: 300, detail: "1 brand, core analytics" },
      { code: "pro" as const, label: "Pro", neurons: 1200, detail: "5 brands, advanced workflows" },
      { code: "business" as const, label: "Business", neurons: 5000, detail: "20 brands, scale + whitelabel" },
    ];
  }, [planCatalog]);

  const filteredSections = sections.filter((item) => {
    const haystack = `${item.title} ${item.description}`.toLowerCase();
    return !globalQuery || haystack.includes(globalQuery);
  });
  const filteredTeamMembers = teamMembers.filter((member) => {
    const haystack = `${member.name} ${member.email} ${member.role} ${member.status}`.toLowerCase();
    return !globalQuery || haystack.includes(globalQuery);
  });
  const filteredIntegrations = integrations.filter((integration) => {
    const haystack = `${integration.name} ${integration.category}`.toLowerCase();
    return !globalQuery || haystack.includes(globalQuery);
  });
  const filteredPlanCards = planCards.filter((plan) => {
    const haystack = `${plan.label} ${plan.detail} ${plan.neurons}`.toLowerCase();
    return !globalQuery || haystack.includes(globalQuery);
  });

  const selectPlan = (plan: "basic" | "pro" | "business") => {
    const token = getAuthToken();
    if (!token) return;
    setPlanError(null);
    setSelectedPlan(plan);
    fetch(`${baseUrl}/api/brand-monitor/plans/select`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ planCode: plan }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error?.message || payload?.error || "Failed to select plan");
        }
        return payload;
      })
      .then((payload) => {
        const selectedCode = String(payload?.plan?.code || plan).toLowerCase();
        if (selectedCode === "basic" || selectedCode === "pro" || selectedCode === "business") {
          setSelectedPlan(selectedCode);
        }
        setPlanMetrics({
          neuronsRemaining: Number(payload?.usage?.neuronsRemaining ?? 0),
          monthlyNeurons: Number(payload?.plan?.monthlyNeurons ?? 0),
          analysesThisMonth: Number(payload?.usage?.analysesThisMonth ?? 0),
          promptsRunThisMonth: Number(payload?.usage?.promptsRunThisMonth ?? 0),
          brandsTracked: Number(payload?.usage?.brandsTracked ?? 0),
          maxBrands:
            payload?.limits?.maxBrands === null || payload?.limits?.maxBrands === undefined
              ? null
              : Number(payload.limits.maxBrands),
        });

        if (typeof window !== "undefined") {
          const selectedName = String(payload?.plan?.name || selectedCode);
          window.localStorage.setItem("selected_plan_code", selectedCode);
          window.localStorage.setItem("selected_plan_name", selectedName);
          window.dispatchEvent(new Event("plan-changed"));
        }
      })
      .catch((error) => {
        setPlanError(error instanceof Error ? error.message : "Failed to select plan");
      });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation cards */}
      <div className="grid grid-cols-3 gap-3">
        {filteredSections.map((section) => (
          <button
            key={section.id}
            className="card-hover flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/20"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
              {section.icon}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{section.title}</span>
              <span className="text-[11px] text-muted-foreground">{section.description}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Team members */}
        <div className="card-hover rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Team Members</h3>
              <p className="text-xs text-muted-foreground">Manage who has access</p>
            </div>
            <button className="nav-item rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90">
              Invite
            </button>
          </div>
          <div className="flex flex-col">
            {filteredTeamMembers.map((member, i) => (
              <div key={member.email} className={cn("flex items-center gap-3 px-5 py-3", i < filteredTeamMembers.length - 1 && "border-b border-border/50")}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  {member.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex flex-1 flex-col gap-0">
                  <span className="text-xs font-medium text-foreground">{member.name}</span>
                  <span className="text-[10px] text-muted-foreground">{member.email}</span>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", roleColors[member.role])}>
                  {member.role}
                </span>
                {member.status === "invited" && (
                  <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[9px] font-medium text-warning">Pending</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <div className="card-hover rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Integrations</h3>
              <p className="text-xs text-muted-foreground">Connected services</p>
            </div>
          </div>
          <div className="flex flex-col">
            {filteredIntegrations.map((int, i) => (
              <div key={int.name} className={cn("flex items-center gap-3 px-5 py-3", i < filteredIntegrations.length - 1 && "border-b border-border/50")}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-foreground">
                  {int.name[0]}
                </div>
                <div className="flex flex-1 flex-col gap-0">
                  <span className="text-xs font-medium text-foreground">{int.name}</span>
                  <span className="text-[10px] text-muted-foreground">{int.category}</span>
                </div>
                {int.connected ? (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">Connected</span>
                ) : (
                  <button className="nav-item rounded-lg border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
                    Connect
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Usage & Plan */}
      <div id="billing-section" className="card-hover rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Current Plan: {planName}</h3>
            <p className="text-xs text-muted-foreground">Live usage for this billing month</p>
          </div>
          <span className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary">
            Plan Selection
          </span>
        </div>

        {planError && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {planError}
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {filteredPlanCards.map((plan) => {
            const isSelected = selectedPlan === plan.code;
            return (
              <button
                key={plan.code}
                type="button"
                onClick={() => selectPlan(plan.code)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{plan.label}</p>
                  {isSelected && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Selected
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{plan.neurons} neurons (ɲ) / month</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{plan.detail}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Neurons (ɲ) Remaining", used: planMetrics.neuronsRemaining, total: Math.max(planMetrics.monthlyNeurons, 1) },
            { label: "Analyses This Month", used: planMetrics.analysesThisMonth, total: 100 },
            { label: "Prompts Run This Month", used: planMetrics.promptsRunThisMonth, total: 500 },
            {
              label: "Brands Tracked",
              used: planMetrics.brandsTracked,
              total: planMetrics.maxBrands && planMetrics.maxBrands > 0 ? planMetrics.maxBrands : planMetrics.brandsTracked || 1,
            },
          ].map((usage) => (
            <div key={usage.label} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <span className="text-[11px] text-muted-foreground">{usage.label}</span>
              <div className="flex items-end gap-1">
                <span className="text-lg font-semibold text-foreground">
                  {planLoading ? "..." : Math.round(Number(usage.used)).toLocaleString()}
                </span>
                <span className="mb-0.5 text-[11px] text-muted-foreground">
                  / {Math.round(Number(usage.total)).toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    (Number(usage.used) / Math.max(Number(usage.total), 1)) > 0.8 ? "bg-warning" : "bg-primary"
                  )}
                  style={{ width: `${Math.min((Number(usage.used) / Math.max(Number(usage.total), 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
