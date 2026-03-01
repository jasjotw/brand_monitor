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

function hasItems(values: string[]) {
  return Array.isArray(values) && values.length > 0;
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export default function AnalyzePersonasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseQuerySaving, setBaseQuerySaving] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [icp, setIcp] = useState<Icp>(emptyIcp);
  const [baseQuery, setBaseQuery] = useState<string | null>(null);
  const [baseQueryDeleted, setBaseQueryDeleted] = useState(false);

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

  async function loadAudience() {
    const res = await authedFetch("/api/brand-monitor/audience/current", { method: "GET" });
    if (!res) return;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || data?.error || "Failed to load personas.");

    setBrandName(data?.brand?.name || "");
    setPersonas(Array.isArray(data?.personas) ? data.personas : []);
    setIcp(data?.icp || emptyIcp);
    setBaseQuery(typeof data?.baseQuery === "string" ? data.baseQuery : null);
    setBaseQueryDeleted(Boolean(data?.baseQueryDeleted));
  }

  async function handleToggleBaseQuery(deleted: boolean) {
    try {
      setBaseQuerySaving(true);
      setError(null);
      const res = await authedFetch("/api/brand-monitor/audience/current", {
        method: "PUT",
        body: JSON.stringify({ baseQueryDeleted: deleted }),
      });
      if (!res) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.error || "Failed to update base query.");
      setBaseQueryDeleted(deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update base query.");
    } finally {
      setBaseQuerySaving(false);
    }
  }

  async function handleContinue() {
    try {
      setContinuing(true);
      setError(null);
      const res = await authedFetch("/api/brand-monitor/audience/generate-prompts", {
        method: "POST",
      });
      if (!res) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || "Failed to generate prompts.");
      }
      if (Array.isArray(data?.prompts)) {
        localStorage.setItem("brand_monitor_generated_prompts", JSON.stringify(data.prompts));
      }
      router.push("/dashboard/analyze/prompts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate prompts.");
    } finally {
      setContinuing(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await loadAudience();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load personas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading personas and ICP...
      </div>
    );
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

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Analysis Personas Review</h2>
            <p className="text-xs text-muted-foreground">
              {brandName ? `Brand: ${brandName}` : "Review generated personas and ICP before analysis."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Personas: {personas.length}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/audience")}
              className="h-9 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              Edit In Personas Page
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={continuing}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {continuing ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Generating Prompts...
                </>
              ) : (
                "Continue"
              )}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground">Base Query</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          This query is built from your industry, audience, USP, products, and location.
        </p>
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
          <p className="text-sm text-foreground">{baseQuery || "No base query generated yet."}</p>
          {baseQuery ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => handleToggleBaseQuery(!baseQueryDeleted)}
                disabled={baseQuerySaving}
                className="h-8 rounded border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
              >
                {baseQuerySaving
                  ? "Saving..."
                  : baseQueryDeleted
                    ? "Keep This Query In Prompts"
                    : "Delete This Query From Prompts"}
              </button>
            </div>
          ) : null}
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

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground">Personas (Read Only)</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {personas.length > 0 ? (
            personas.map((persona, index) => (
              <div key={persona.id || `persona-${index}`} className="rounded-xl border border-border/70 bg-background p-4">
                <div className="flex items-center gap-2">
                  {persona.avatar ? (
                    <img
                      src={persona.avatar}
                      alt={persona.role || "persona"}
                      className="h-10 w-10 rounded-full border border-border object-cover"
                    />
                  ) : null}
                  <p className="text-sm font-semibold text-foreground">{persona.role || `Persona ${index + 1}`}</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{persona.description || "N/A"}</p>
                <div className="mt-2">
                  <p className="text-xs font-semibold text-foreground">Pain Points</p>
                  {hasItems(persona.painPoints) ? (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {persona.painPoints.map((point) => (
                        <li key={`${persona.id}-pain-${point}`}>{point}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">N/A</p>
                  )}
                </div>
                <div className="mt-2">
                  <p className="text-xs font-semibold text-foreground">Goals</p>
                  {hasItems(persona.goals) ? (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {persona.goals.map((goal) => (
                        <li key={`${persona.id}-goal-${goal}`}>{goal}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">N/A</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No personas available.</p>
          )}
        </div>
      </section>
    </div>
  );
}
