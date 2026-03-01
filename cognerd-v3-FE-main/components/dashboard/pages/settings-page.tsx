"use client";

import React from "react"

import { cn } from "@/lib/utils";
import { User, Building2, Key, Bell, Users, Database, Download, Plug, Shield, CreditCard } from "lucide-react";

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
  return (
    <div className="flex flex-col gap-6">
      {/* Navigation cards */}
      <div className="grid grid-cols-3 gap-3">
        {sections.map((section) => (
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
            {teamMembers.map((member, i) => (
              <div key={member.email} className={cn("flex items-center gap-3 px-5 py-3", i < teamMembers.length - 1 && "border-b border-border/50")}>
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
            {integrations.map((int, i) => (
              <div key={int.name} className={cn("flex items-center gap-3 px-5 py-3", i < integrations.length - 1 && "border-b border-border/50")}>
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
      <div className="card-hover rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Current Plan: Pro</h3>
            <p className="text-xs text-muted-foreground">Usage this billing cycle (resets Feb 15)</p>
          </div>
          <button className="nav-item rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90">
            Upgrade Plan
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "AI Responses Analyzed", used: 8420, total: 15000 },
            { label: "Tracked Brands", used: 3, total: 10 },
            { label: "Team Members", used: 4, total: 10 },
            { label: "API Calls", used: 12400, total: 50000 },
          ].map((usage) => (
            <div key={usage.label} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <span className="text-[11px] text-muted-foreground">{usage.label}</span>
              <div className="flex items-end gap-1">
                <span className="text-lg font-semibold text-foreground">{usage.used.toLocaleString()}</span>
                <span className="mb-0.5 text-[11px] text-muted-foreground">/ {usage.total.toLocaleString()}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    (usage.used / usage.total) > 0.8 ? "bg-warning" : "bg-primary"
                  )}
                  style={{ width: `${Math.min((usage.used / usage.total) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
