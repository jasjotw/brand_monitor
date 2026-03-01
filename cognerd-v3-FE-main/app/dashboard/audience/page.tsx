"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthToken, getAuthToken } from "@/lib/auth";

type Persona = {
  id: string;
  role: string;
  description: string;
  painPoints: string[];
  goals: string[];
  avatar?: string;
};

type Icp = {
  summary: string;
  industries: string[];
  companySize: string;
  annualRevenueRange: string;
  geographies: string[];
  budgetRange: string;
  buyingCommittee: string[];
  painPoints: string[];
  successCriteria: string[];
  icp_summary?: string;
  firmographics?: Record<string, unknown>;
  buyer_committee?: Record<string, unknown>;
  pain_points?: string[];
  jtbd?: {
    functional: string[];
    emotional: string[];
    social: string[];
  };
  ai_search_behavior?: Record<string, unknown>;
  trigger_events?: string[];
  buying_criteria?: {
    must_have: string[];
    nice_to_have: string[];
    deal_breakers: string[];
  };
  objections?: string[];
  disqualification_criteria?: string[];
  intent_signals?: {
    content: string[];
    behavioral: string[];
    technographic: string[];
    geo_relevant: string[];
  };
  messaging_angles?: {
    value_props: string[];
    proof_points: string[];
  };
  priority_segments?: Array<Record<string, unknown> | string>;
};

const emptyIcp: Icp = {
  summary: "",
  industries: [],
  companySize: "",
  annualRevenueRange: "",
  geographies: [],
  budgetRange: "",
  buyingCommittee: [],
  painPoints: [],
  successCriteria: [],
  icp_summary: "",
  firmographics: {},
  buyer_committee: {},
  pain_points: [],
  jtbd: { functional: [], emotional: [], social: [] },
  ai_search_behavior: {},
  trigger_events: [],
  buying_criteria: { must_have: [], nice_to_have: [], deal_breakers: [] },
  objections: [],
  disqualification_criteria: [],
  intent_signals: { content: [], behavioral: [], technographic: [], geo_relevant: [] },
  messaging_angles: { value_props: [], proof_points: [] },
  priority_segments: [],
};

function avatarFromSeed(seed: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || "persona")}`;
}

function createEmptyPersona(index: number): Persona {
  const seed = `persona-${index}-${Date.now()}`;
  return {
    id: `manual-${Date.now()}-${index}`,
    role: "",
    description: "",
    painPoints: [],
    goals: [],
    avatar: avatarFromSeed(seed),
  };
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export default function AudiencePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [icpLoading, setIcpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [icp, setIcp] = useState<Icp>(emptyIcp);
  const [additionalInputs, setAdditionalInputs] = useState<Record<string, string>>({
    teamSize: "",
    budget: "",
    salesCycle: "",
    mustHaveTraits: "",
  });

  async function authedFetch(path: string, init?: RequestInit) {
    const token = getAuthToken();
    if (!token) {
      router.replace("/login");
      return null;
    }
    const baseUrl = process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
    if (res.status === 401) {
      clearAuthToken();
      router.replace("/login");
      return null;
    }
    return res;
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);
        const res = await authedFetch("/api/brand-monitor/audience/current", { method: "GET" });
        if (!res) return;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message || data?.error || "Failed to load audience profile.");

        setBrandName(data?.brand?.name || "");
        setPersonas(
          Array.isArray(data?.personas)
            ? data.personas.map((p: Persona, idx: number) => ({
                ...p,
                avatar: p.avatar || avatarFromSeed(p.role || `persona-${idx + 1}`),
              }))
            : [],
        );
        setIcp(data?.icp || emptyIcp);
        if (data?.additionalInputs && typeof data.additionalInputs === "object") {
          setAdditionalInputs((prev) => ({ ...prev, ...data.additionalInputs }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audience profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleGeneratePersonas() {
    try {
      setPersonasLoading(true);
      setError(null);
      setSuccess(null);
      const res = await authedFetch("/api/brand-monitor/audience/generate-personas", { method: "POST" });
      if (!res) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.error || "Failed to generate personas.");
      setPersonas(
        Array.isArray(data?.personas)
          ? data.personas.map((p: Persona, idx: number) => ({
              ...p,
              avatar: p.avatar || avatarFromSeed(p.role || `persona-${idx + 1}`),
            }))
          : [],
      );
      setSuccess("Personas generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate personas.");
    } finally {
      setPersonasLoading(false);
    }
  }

  async function handleGenerateIcp() {
    try {
      setIcpLoading(true);
      setError(null);
      setSuccess(null);
      const res = await authedFetch("/api/brand-monitor/audience/generate-icp", {
        method: "POST",
        body: JSON.stringify({ additionalInputs }),
      });
      if (!res) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.error || "Failed to generate ICP.");
      setIcp(data?.icp || emptyIcp);
      setSuccess("ICP generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate ICP.");
    } finally {
      setIcpLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await authedFetch("/api/brand-monitor/audience/current", {
        method: "PUT",
        body: JSON.stringify({ personas, icp, additionalInputs }),
      });
      if (!res) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.error || "Failed to save audience profile.");
      setSuccess("Audience profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save audience profile.");
    } finally {
      setSaving(false);
    }
  }

  function setPersonaCsvField(index: number, field: "painPoints" | "goals", value: string) {
    const parsed = value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    setPersonas((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: parsed } : p)));
  }

  if (loading) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading Personas & ICP...</div>;
  }

  const listOrFallback = (items?: string[]) =>
    Array.isArray(items) && items.length > 0 ? items : ["Not available"];
  const prioritySegments = Array.isArray(icp.priority_segments) ? icp.priority_segments : [];
  const intentSignals = icp.intent_signals || { content: [], behavioral: [], technographic: [], geo_relevant: [] };
  const buyingCriteria = icp.buying_criteria || { must_have: [], nice_to_have: [], deal_breakers: [] };
  const messagingAngles = icp.messaging_angles || { value_props: [], proof_points: [] };
  const jtbd = icp.jtbd || { functional: [], emotional: [], social: [] };

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700">{success}</div>
      )}

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Audience Builder</h2>
            <p className="text-xs text-muted-foreground">{brandName ? `Brand: ${brandName}` : "Generate Personas and ICP from your brand profile."}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleGeneratePersonas} disabled={personasLoading} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60">
              {personasLoading ? "Generating Personas..." : "Generate Personas"}
            </button>
            <button onClick={handleGenerateIcp} disabled={icpLoading} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60">
              {icpLoading ? "Generating ICP..." : "Generate ICP"}
            </button>
            <button onClick={handleSave} disabled={saving} className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground">Additional Inputs</h3>
        <p className="mt-1 text-xs text-muted-foreground">Add any business specifics to improve ICP quality.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {Object.entries(additionalInputs).map(([key, value]) => (
            <label key={key} className="flex flex-col gap-1 text-xs text-foreground">
              <span className="capitalize">{key}</span>
              <input
                value={value}
                onChange={(e) => setAdditionalInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Personas</h3>
          <button
            type="button"
            onClick={() => setPersonas((prev) => [...prev, createEmptyPersona(prev.length + 1)])}
            className="h-8 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            Add Persona
          </button>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {personas.length > 0 ? (
            personas.map((persona, index) => (
              <div key={persona.id || `persona-${index}`} className="rounded-xl border border-border/70 bg-background p-4">
                <div className="flex items-center gap-2">
                  <img
                    src={persona.avatar || avatarFromSeed(persona.role || `persona-${index + 1}`)}
                    alt={persona.role || `persona-${index + 1}`}
                    className="persona-avatar h-10 w-10 rounded-full border border-border bg-card object-cover"
                  />
                  <input
                    value={persona.role}
                    onChange={(e) =>
                      setPersonas((prev) =>
                        prev.map((p, i) =>
                          i === index
                            ? {
                                ...p,
                                role: e.target.value,
                                avatar: avatarFromSeed(e.target.value || p.id || `persona-${index + 1}`),
                              }
                            : p,
                        ),
                      )
                    }
                    placeholder={`Persona ${index + 1} role`}
                    className="h-8 w-full rounded border border-border bg-card px-2 text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPersonas((prev) =>
                        prev.map((p, i) =>
                          i === index
                            ? {
                                ...p,
                                avatar: avatarFromSeed(p.role || p.id || `persona-${index + 1}`),
                              }
                            : p,
                        ),
                      )
                    }
                    className="h-8 rounded border border-border px-2 text-[11px] font-semibold text-foreground hover:bg-secondary"
                  >
                    Refresh Pic
                  </button>
                  <button
                    type="button"
                    onClick={() => setPersonas((prev) => prev.filter((_, i) => i !== index))}
                    className="h-8 rounded border border-border px-2 text-[11px] font-semibold text-destructive hover:bg-destructive/10"
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  value={persona.description}
                  onChange={(e) =>
                    setPersonas((prev) =>
                      prev.map((p, i) => (i === index ? { ...p, description: e.target.value } : p)),
                    )
                  }
                  placeholder="Persona description"
                  className="mt-2 min-h-[72px] w-full rounded border border-border bg-card p-2 text-xs"
                />
                <label className="mt-2 flex flex-col gap-1 text-xs">
                  <span>Pain Points (comma separated)</span>
                  <input
                    value={persona.painPoints.join(", ")}
                    onChange={(e) => setPersonaCsvField(index, "painPoints", e.target.value)}
                    className="h-8 rounded border border-border bg-card px-2 text-xs"
                  />
                </label>
                <label className="mt-2 flex flex-col gap-1 text-xs">
                  <span>Goals (comma separated)</span>
                  <input
                    value={persona.goals.join(", ")}
                    onChange={(e) => setPersonaCsvField(index, "goals", e.target.value)}
                    className="h-8 rounded border border-border bg-card px-2 text-xs"
                  />
                </label>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No personas yet. Click "Generate Personas".</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">Executive ICP View</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Read-only summary of the full ICP output for quick scanning.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-background p-4 lg:col-span-2">
            <p className="text-[11px] font-semibold text-foreground">ICP Summary</p>
            <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
              {icp.icp_summary || icp.summary || "Not available"}
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-[11px] font-semibold text-foreground">Firmographics</p>
            <pre className="mt-2 max-h-56 overflow-auto rounded border border-border bg-card p-2 text-[11px] text-muted-foreground">
              {formatJson(icp.firmographics)}
            </pre>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-[11px] font-semibold text-foreground">Buyer Committee</p>
            <pre className="mt-2 max-h-56 overflow-auto rounded border border-border bg-card p-2 text-[11px] text-muted-foreground">
              {formatJson(icp.buyer_committee)}
            </pre>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-[11px] font-semibold text-foreground">Top Pain Points</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(icp.pain_points || icp.painPoints).map((item, idx) => (
                <li key={`pain-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-[11px] font-semibold text-foreground">Trigger Events</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(icp.trigger_events).map((item, idx) => (
                <li key={`trigger-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-[11px] font-semibold text-foreground">JTBD Functional</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(jtbd.functional).map((item, idx) => (
                <li key={`jtbd-f-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-[11px] font-semibold text-foreground">JTBD Emotional</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(jtbd.emotional).map((item, idx) => (
                <li key={`jtbd-e-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-[11px] font-semibold text-foreground">JTBD Social</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(jtbd.social).map((item, idx) => (
                <li key={`jtbd-s-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-[11px] font-semibold text-foreground">Buying Criteria</p>
            <p className="mt-2 text-[11px] font-medium text-foreground">Must Have</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(buyingCriteria.must_have).map((item, idx) => (
                <li key={`must-${idx}`}>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] font-medium text-foreground">Nice to Have</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(buyingCriteria.nice_to_have).map((item, idx) => (
                <li key={`nice-${idx}`}>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] font-medium text-foreground">Deal Breakers</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(buyingCriteria.deal_breakers).map((item, idx) => (
                <li key={`deal-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-[11px] font-semibold text-foreground">Intent Signals</p>
            <p className="mt-2 text-[11px] font-medium text-foreground">Content</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(intentSignals.content).map((item, idx) => (
                <li key={`intent-content-${idx}`}>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] font-medium text-foreground">Behavioral</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(intentSignals.behavioral).map((item, idx) => (
                <li key={`intent-behavioral-${idx}`}>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] font-medium text-foreground">Technographic</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(intentSignals.technographic).map((item, idx) => (
                <li key={`intent-tech-${idx}`}>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] font-medium text-foreground">GEO Relevant</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(intentSignals.geo_relevant).map((item, idx) => (
                <li key={`intent-geo-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-[11px] font-semibold text-foreground">Messaging Angles</p>
            <p className="mt-2 text-[11px] font-medium text-foreground">Value Propositions</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(messagingAngles.value_props).map((item, idx) => (
                <li key={`vp-${idx}`}>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] font-medium text-foreground">Proof Points</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {listOrFallback(messagingAngles.proof_points).map((item, idx) => (
                <li key={`proof-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4 lg:col-span-2">
            <p className="text-[11px] font-semibold text-foreground">Priority Segments</p>
            <pre className="mt-2 max-h-56 overflow-auto rounded border border-border bg-card p-2 text-[11px] text-muted-foreground">
              {formatJson(prioritySegments)}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
