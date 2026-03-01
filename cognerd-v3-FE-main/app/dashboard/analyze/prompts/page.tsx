"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthToken, getAuthToken } from "@/lib/auth";

type PromptCategory =
  | "organic_discovery"
  | "category_authority"
  | "competitive_evaluation"
  | "replacement_intent"
  | "conversational_recall"
  | "ranking"
  | "comparison"
  | "alternatives"
  | "recommendations";

type BrandPrompt = {
  id: string;
  prompt: string;
  category: PromptCategory;
  persona?: string;
  source?: string;
};

type Competitor = { name: string; url?: string };

type BrandRecord = {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  industry?: string | null;
  location?: string | null;
  logo?: string | null;
  competitors?: unknown;
  scrapedData?: {
    title?: string;
    description?: string;
    keywords?: string[];
    mainProducts?: string[];
    mainContent?: string;
    competitors?: string[];
    competitorDetails?: Array<{ name?: string; url?: string }>;
  } | null;
};

type AnalysisSSEEvent = {
  type?: string;
  stage?: string;
  data?: any;
  timestamp?: string;
};

const CATEGORY_OPTIONS: PromptCategory[] = [
  "organic_discovery",
  "category_authority",
  "competitive_evaluation",
  "replacement_intent",
  "conversational_recall",
  "ranking",
  "comparison",
  "alternatives",
  "recommendations",
];

function normalizePrompts(value: unknown): BrandPrompt[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: BrandPrompt[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const candidate = item as Partial<BrandPrompt>;
    const prompt = typeof candidate.prompt === "string" ? candidate.prompt.trim() : "";
    if (!prompt) return;
    const dedupeKey = prompt.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const rawCategory = typeof candidate.category === "string" ? candidate.category : "category_authority";
    const category = CATEGORY_OPTIONS.includes(rawCategory as PromptCategory)
      ? (rawCategory as PromptCategory)
      : "category_authority";
    out.push({
      id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : `prompt-${index + 1}`,
      prompt,
      category,
      persona: typeof candidate.persona === "string" ? candidate.persona : undefined,
      source: typeof candidate.source === "string" ? candidate.source : undefined,
    });
  });
  return out;
}

function parseCompetitors(value: unknown): Competitor[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: Competitor[] = [];
  value.forEach((entry) => {
    if (!entry) return;
    if (typeof entry === "string") {
      const name = entry.trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ name });
      return;
    }
    if (typeof entry === "object") {
      const obj = entry as { name?: unknown; url?: unknown };
      const name = typeof obj.name === "string" ? obj.name.trim() : "";
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        name,
        url: typeof obj.url === "string" && obj.url.trim() ? obj.url.trim() : undefined,
      });
    }
  });
  return out;
}

export default function AnalyzePromptsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandRecord | null>(null);
  const [prompts, setPrompts] = useState<BrandPrompt[]>([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string>("Ready to run prompts.");
  const [runStage, setRunStage] = useState<string>("idle");
  const [runProgress, setRunProgress] = useState<number>(0);
  const [runPromptOrder, setRunPromptOrder] = useState<string[]>([]);
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [providerCompletionByPrompt, setProviderCompletionByPrompt] = useState<Record<string, number>>({});
  const [transitionOutPrompt, setTransitionOutPrompt] = useState<string | null>(null);
  const [transitionInPrompt, setTransitionInPrompt] = useState<string | null>(null);
  const [editModeById, setEditModeById] = useState<Record<string, boolean>>({});
  const [showRunnerModal, setShowRunnerModal] = useState(false);

  const activePromptIndexRef = useRef(0);
  const isPromptTransitioningRef = useRef(false);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    prompts.forEach((p) => map.set(p.category, (map.get(p.category) || 0) + 1));
    return Array.from(map.entries()).map(([category, count]) => ({ category, count }));
  }, [prompts]);

  function updatePromptById(id: string, patch: Partial<BrandPrompt>) {
    setPrompts((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removePrompt(id: string) {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    setEditModeById((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function addPrompt() {
    const newPrompt: BrandPrompt = {
      id: `new-${Date.now()}`,
      prompt: "",
      category: "category_authority",
      source: "user",
    };
    setPrompts((prev) => [...prev, newPrompt]);
    setEditModeById((prev) => ({ ...prev, [newPrompt.id]: true }));
  }

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

  function persistPrompts(nextPrompts: BrandPrompt[]) {
    localStorage.setItem("brand_monitor_generated_prompts", JSON.stringify(nextPrompts));
  }

  function categoryLabel(value: string): string {
    return value
      .split("_")
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  }

  function categoryClass(value: string): string {
    switch (value) {
      case "organic_discovery":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
      case "category_authority":
        return "border-blue-500/30 bg-blue-500/10 text-blue-700";
      case "competitive_evaluation":
        return "border-amber-500/30 bg-amber-500/10 text-amber-700";
      case "replacement_intent":
        return "border-orange-500/30 bg-orange-500/10 text-orange-700";
      case "conversational_recall":
        return "border-violet-500/30 bg-violet-500/10 text-violet-700";
      default:
        return "border-border bg-secondary/60 text-foreground";
    }
  }

  function promptKey(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
  }

  function triggerPromptAdvance(completedPrompt: string) {
    if (!runPromptOrder.length || isPromptTransitioningRef.current) return;
    const currentPrompt = runPromptOrder[activePromptIndexRef.current];
    if (!currentPrompt || promptKey(currentPrompt) !== promptKey(completedPrompt)) return;

    const nextPrompt = runPromptOrder[activePromptIndexRef.current + 1] || null;
    isPromptTransitioningRef.current = true;
    setTransitionOutPrompt(currentPrompt);
    setTransitionInPrompt(nextPrompt);

    window.setTimeout(() => {
      const nextIndex = Math.min(activePromptIndexRef.current + 1, runPromptOrder.length);
      activePromptIndexRef.current = nextIndex;
      setActivePromptIndex(nextIndex);
      setTransitionOutPrompt(null);
      setTransitionInPrompt(null);
      isPromptTransitioningRef.current = false;
    }, 520);
  }

  useEffect(() => {
    if (loading) return;
    persistPrompts(prompts);
  }, [prompts, loading]);


  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const profileRes = await authedFetch("/api/brand-monitor/brand-profile/current", { method: "GET" });
        if (!profileRes) return;
        const profileData = await profileRes.json().catch(() => ({}));
        if (!profileRes.ok) {
          throw new Error(profileData?.error?.message || profileData?.error || "Failed to load brand profile.");
        }
        setBrand(profileData?.brand ?? null);

        const localRaw = localStorage.getItem("brand_monitor_generated_prompts");
        const localPrompts = normalizePrompts(localRaw ? JSON.parse(localRaw) : []);
        if (localPrompts.length > 0) {
          setPrompts(localPrompts);
          return;
        }

        const promptRes = await authedFetch("/api/brand-monitor/audience/generate-prompts", { method: "POST" });
        if (!promptRes) return;
        const promptData = await promptRes.json().catch(() => ({}));
        if (!promptRes.ok) {
          throw new Error(promptData?.error?.message || promptData?.error || "Failed to generate prompts.");
        }
        const nextPrompts = normalizePrompts(promptData?.prompts);
        setPrompts(nextPrompts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load prompts.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function runPromptsOnLlm() {
    try {
      setRunError(null);
      setRunning(true);
      setRunProgress(0);
      setRunStage("initializing");
      setRunMessage("Starting analysis...");
      setShowRunnerModal(true);
      setTransitionOutPrompt(null);
      setTransitionInPrompt(null);
      setProviderCompletionByPrompt({});

      const cleanedPrompts = prompts
        .map((p, idx) => ({
          id: p.id || `prompt-${idx + 1}`,
          prompt: p.prompt.trim(),
          category: p.category,
          persona: p.persona,
          source: p.source || "user",
        }))
        .filter((p) => p.prompt.length > 0);

      if (!brand?.name || !brand?.url) {
        throw new Error("Brand profile is missing. Please complete brand setup first.");
      }
      if (cleanedPrompts.length === 0) {
        throw new Error("Add at least one prompt before running analysis.");
      }

      persistPrompts(cleanedPrompts as BrandPrompt[]);
      const orderedPromptTexts = cleanedPrompts.map((p) => p.prompt);
      setRunPromptOrder(orderedPromptTexts);
      activePromptIndexRef.current = 0;
      setActivePromptIndex(0);
      isPromptTransitioningRef.current = false;

      const token = getAuthToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      const competitors = parseCompetitors(brand.competitors);
      const baseUrl = process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
      const response = await fetch(`${baseUrl}/api/brand-monitor/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          company: {
            id: brand.id,
            name: brand.name,
            url: brand.url,
            description: brand.description,
            industry: brand.industry,
            location: brand.location,
            logo: brand.logo,
            scrapedData: brand.scrapedData || undefined,
          },
          prompts: cleanedPrompts,
          competitors,
          useWebSearch: true,
        }),
      });

      if (response.status === 401) {
        clearAuthToken();
        router.replace("/login");
        return;
      }

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error?.message || data?.error || "Failed to run analysis.");
      }

      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = "";
      const takeNextEventBlock = (): string | null => {
        const match = buffer.match(/\r?\n\r?\n/);
        if (!match || typeof match.index !== "number") return null;
        const raw = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        return raw.trim();
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let rawEvent = takeNextEventBlock();
        while (rawEvent !== null) {
          if (!rawEvent) {
            rawEvent = takeNextEventBlock();
            continue;
          }

          const lines = rawEvent.replace(/\r\n/g, "\n").split("\n");
          let eventType = "";
          const dataLines: string[] = [];
          lines.forEach((line) => {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          });
          if (dataLines.length === 0) continue;

          let parsed: AnalysisSSEEvent | null = null;
          try {
            parsed = JSON.parse(dataLines.join("\n")) as AnalysisSSEEvent;
          } catch {
            parsed = null;
          }
          if (!parsed) continue;

          const type = parsed.type || eventType;
          const eventPrompt = typeof parsed.data?.prompt === "string" ? parsed.data.prompt.trim() : "";
          const eventPromptIndex = Number(parsed.data?.promptIndex || 0);
          const nextStage = parsed.stage || parsed.data?.stage;
          if (nextStage) setRunStage(nextStage);
          if (typeof parsed.data?.progress === "number") {
            setRunProgress(Math.max(0, Math.min(100, parsed.data.progress)));
          }
          if (typeof parsed.data?.message === "string" && parsed.data.message.trim()) {
            setRunMessage(parsed.data.message);
          }
          if (type === "analysis-start" && eventPrompt) {
            setRunMessage(`Examining prompt: ${eventPrompt}`);
            if (eventPromptIndex > 0) {
              const nextIdx = Math.max(0, eventPromptIndex - 1);
              if (nextIdx >= activePromptIndexRef.current && !isPromptTransitioningRef.current) {
                activePromptIndexRef.current = nextIdx;
                setActivePromptIndex(nextIdx);
              }
            }
          }
          if (type === "analysis-complete" && eventPrompt) {
            const totalProviders = Number(parsed.data?.totalProviders || 1);
            const status = String(parsed.data?.status || "");
            setProviderCompletionByPrompt((prev) => {
              const key = promptKey(eventPrompt);
              const nextCount = (prev[key] || 0) + 1;
              const next = { ...prev, [key]: nextCount };
              if (nextCount >= Math.max(1, totalProviders)) {
                triggerPromptAdvance(eventPrompt);
              }
              // Fallback: if provider counting is inconsistent, still advance when current prompt reports completion.
              if (
                status === "completed" &&
                promptKey(eventPrompt) === promptKey(runPromptOrder[activePromptIndexRef.current] || "")
              ) {
                window.setTimeout(() => triggerPromptAdvance(eventPrompt), 200);
              }
              return next;
            });
          }

          if (type === "error") {
            throw new Error(parsed.data?.message || "Analysis failed.");
          }

          if (type === "complete") {
            setRunProgress(100);
            setRunMessage("Analysis complete. Saved to database.");
            setTimeout(() => router.push("/dashboard"), 500);
          }
          rawEvent = takeNextEventBlock();
        }
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to run prompts.");
      setRunMessage("Run failed.");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading generated prompts...
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Prompt Editor</h2>
            <p className="text-xs text-muted-foreground">
              Categories are shown per prompt. Edit, delete, or add prompts before running.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addPrompt}
              className="h-9 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
            >
              Add Prompt
            </button>
            <button
              type="button"
              onClick={runPromptsOnLlm}
              disabled={running}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Running...
                </>
              ) : (
                "Run Prompts On LLM"
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {categoryCounts.map((item) => (
            <span
              key={item.category}
              className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${categoryClass(item.category)}`}
            >
              {categoryLabel(item.category)}: {item.count}
            </span>
          ))}
          {categoryCounts.length === 0 ? (
            <span className="text-xs text-muted-foreground">No prompts yet.</span>
          ) : null}
        </div>
      </section>

      {(runPromptOrder.length > 0 || running || runError) && (
        <section className="hidden rounded-2xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">LLM Prompt Runner</h3>
          <p className="mt-1 text-xs text-muted-foreground">{runMessage}</p>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr_1fr]">
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
              <div className="mt-3 flex min-h-[240px] flex-col gap-2">
                {runPromptOrder.slice(0, Math.min(activePromptIndex, runPromptOrder.length)).reverse().map((prompt, idx) => (
                  <div
                    key={`done-${prompt}-${idx}`}
                    className="rounded-lg border border-border/70 bg-card p-2 text-xs text-muted-foreground transition-all duration-500"
                    style={{ transform: `translateX(-${Math.min(idx * 8, 32)}px) translateY(${idx * 6}px)` }}
                  >
                    {prompt}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <div className="mx-auto flex w-full max-w-md flex-col items-center">
                <img
                  src="/images/running.gif"
                  alt="Running prompts"
                  className="h-28 w-28 rounded-xl border border-border bg-card object-contain p-1"
                />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Current Prompt Being Examined
                </p>
                <div className="relative mt-3 h-32 w-full overflow-hidden">
                  {transitionOutPrompt && (
                    <div className="run-card run-card-leave absolute inset-0 rounded-xl border border-border bg-card p-3 text-xs text-foreground">
                      {transitionOutPrompt}
                    </div>
                  )}
                  {transitionInPrompt && (
                    <div className="run-card run-card-enter absolute inset-0 rounded-xl border border-primary/40 bg-card p-3 text-xs text-foreground shadow-sm">
                      {transitionInPrompt}
                    </div>
                  )}
                  {!transitionOutPrompt && !transitionInPrompt && runPromptOrder[activePromptIndex] && (
                    <div className="absolute inset-0 rounded-xl border border-primary/40 bg-card p-3 text-xs text-foreground shadow-sm">
                      {runPromptOrder[activePromptIndex]}
                    </div>
                  )}
                  {!runPromptOrder[activePromptIndex] && !running && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                      Run complete.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pending</p>
              <div className="mt-3 flex min-h-[240px] flex-col gap-2">
                {(runPromptOrder[activePromptIndex]
                  ? runPromptOrder.slice(activePromptIndex + 1)
                  : []
                ).slice(0, 8).map((prompt, idx) => (
                  <div
                    key={`todo-${prompt}-${idx}`}
                    className="rounded-lg border border-border/70 bg-card p-2 text-xs text-foreground transition-all duration-500"
                    style={{ transform: `translateX(${Math.min(idx * 8, 32)}px) translateY(${idx * 6}px)` }}
                  >
                    {prompt}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${runProgress}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Stage: {runStage} | Progress: {Math.round(runProgress)}%
          </p>
          {runError ? (
            <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {runError}
            </p>
          ) : null}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Running this flow saves prompts first and then stores prompt responses in database through analysis pipeline callbacks.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="space-y-4">
          {prompts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No prompts available. Click "Add Prompt".</p>
          ) : (
            prompts.map((row, index) => (
              <div key={row.id} className="relative">
                <div className="pointer-events-none absolute inset-x-2 top-2 h-full rounded-xl border border-border/40 bg-secondary/40" />
                <div className="pointer-events-none absolute inset-x-1 top-1 h-full rounded-xl border border-border/60 bg-secondary/30" />
                <div className="relative rounded-xl border border-border bg-background p-4 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">Prompt {index + 1}</p>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${categoryClass(row.category)}`}>
                        {categoryLabel(row.category)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditModeById((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                        className="h-7 rounded border border-border px-2 text-[11px] font-semibold text-foreground hover:bg-secondary"
                      >
                        {editModeById[row.id] ? "Lock" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePrompt(row.id)}
                        className="h-7 rounded border border-destructive/40 px-2 text-[11px] font-semibold text-destructive hover:bg-destructive/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {editModeById[row.id] ? (
                    <>
                      <textarea
                        value={row.prompt}
                        onChange={(e) => updatePromptById(row.id, { prompt: e.target.value })}
                        rows={3}
                        className="mt-2 min-h-[72px] w-full rounded border border-border bg-card p-2 text-xs text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                        placeholder="Enter prompt text..."
                      />
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] font-medium text-foreground">
                          Category
                          <select
                            value={row.category}
                            onChange={(e) => updatePromptById(row.id, { category: e.target.value as PromptCategory })}
                            className="mt-1 h-8 w-full rounded border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                          >
                            {CATEGORY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {categoryLabel(option)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[11px] font-medium text-foreground">
                          Persona (optional)
                          <input
                            value={row.persona || ""}
                            onChange={(e) => updatePromptById(row.id, { persona: e.target.value })}
                            className="mt-1 h-8 w-full rounded border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                            placeholder="Persona name"
                          />
                        </label>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-sm leading-6 text-foreground">{row.prompt}</p>
                      {row.persona ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Persona: <span className="font-semibold text-foreground">{row.persona}</span>
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {showRunnerModal && (
        <div className="absolute inset-0 z-50 flex justify-center bg-background/70 p-3 pt-2 backdrop-blur-sm sm:p-4 sm:pt-3">
          <div className="w-full max-w-5xl rounded-2xl border border-border bg-card p-3 shadow-2xl sm:p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">LLM Prompt Runner</h3>
                <p className="mt-1 text-xs text-muted-foreground">{runMessage}</p>
              </div>
              <button
                type="button"
                disabled={running}
                onClick={() => setShowRunnerModal(false)}
                className="h-8 rounded border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
              >
                {running ? "Running..." : "Close"}
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-background p-3 sm:p-4">
              <div className="flex flex-col items-center">
                <img src="/images/running.gif" alt="Running prompts" className="h-28 w-28 object-contain sm:h-32 sm:w-32" />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Prompt Analysis In Progress
                </p>

                <div className="runner-stage mt-4 w-full max-w-5xl">
                  <div className="runner-slot runner-slot-left">
                    {activePromptIndex > 0 && (
                      <div className="credit-card credit-card-done">
                        <p className="credit-card-label">Latest Completed</p>
                        <p className="credit-card-text">
                          {runPromptOrder[activePromptIndex - 1]}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="runner-slot runner-slot-center">
                    <div className="credit-card credit-card-current">
                      <p className="credit-card-label">Currently Running</p>
                      {transitionOutPrompt && (
                        <div className="credit-layer credit-swipe-left">
                          <p className="credit-card-text">{transitionOutPrompt}</p>
                        </div>
                      )}
                      {transitionInPrompt && (
                        <div className="credit-layer credit-enter-center">
                          <p className="credit-card-text">{transitionInPrompt}</p>
                        </div>
                      )}
                      {!transitionOutPrompt && !transitionInPrompt && runPromptOrder[activePromptIndex] && (
                        <div className="credit-layer credit-static">
                          <p className="credit-card-text">{runPromptOrder[activePromptIndex]}</p>
                        </div>
                      )}
                      {!runPromptOrder[activePromptIndex] && !running && (
                        <div className="credit-layer credit-static">
                          <p className="credit-card-text text-muted-foreground">Run complete.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="runner-slot runner-slot-right">
                    {runPromptOrder[activePromptIndex + 1] && (
                      <div className="credit-card credit-card-next">
                        <p className="credit-card-label">Up Next</p>
                        <p className="credit-card-text">
                          {runPromptOrder[activePromptIndex + 1]}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${runProgress}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Stage: {runStage} | Progress: {Math.round(runProgress)}%
            </p>
            {runError ? (
              <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {runError}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <style jsx>{`
        .runner-stage {
          display: grid;
          grid-template-columns: 1fr 1.2fr 1fr;
          gap: 12px;
          align-items: center;
          min-height: 210px;
        }
        .runner-slot {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 170px;
        }
        .credit-card {
          width: 270px;
          height: 152px;
          border-radius: 18px;
          border: 1px solid hsl(var(--border));
          background: linear-gradient(
            140deg,
            hsl(var(--card)) 0%,
            color-mix(in oklab, hsl(var(--card)) 82%, hsl(var(--secondary)) 18%) 100%
          );
          box-shadow: 0 16px 38px rgba(0, 0, 0, 0.08);
          padding: 12px;
          position: relative;
          overflow: hidden;
        }
        .credit-card-current {
          width: 300px;
          height: 172px;
          border-color: color-mix(in oklab, hsl(var(--primary)) 34%, hsl(var(--border)) 66%);
        }
        .credit-card-done {
          opacity: 0.95;
        }
        .credit-card-next {
          opacity: 0.95;
        }
        .credit-card-label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 700;
          color: hsl(var(--muted-foreground));
          margin-bottom: 8px;
        }
        .credit-card-text {
          font-size: 11px;
          line-height: 1.4;
          color: hsl(var(--foreground));
          display: -webkit-box;
          -webkit-line-clamp: 5;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .credit-layer {
          position: absolute;
          inset: 30px 10px 10px 10px;
          border-radius: 12px;
          border: 1px solid color-mix(in oklab, hsl(var(--border)) 88%, hsl(var(--primary)) 12%);
          background: hsl(var(--card));
          padding: 10px;
        }
        .credit-static {
          transform: translateX(0);
          opacity: 1;
        }
        .credit-swipe-left {
          animation: credit-swipe-left 0.52s ease forwards;
        }
        .credit-enter-center {
          animation: credit-enter-center 0.52s ease forwards;
        }
        @media (max-width: 1280px) {
          .runner-stage {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .runner-slot {
            min-height: 150px;
          }
          .credit-card {
            width: 100%;
            max-width: 500px;
            height: 144px;
          }
          .credit-card-current {
            height: 162px;
          }
          .credit-card-text {
            -webkit-line-clamp: 4;
          }
        }
        @media (max-width: 640px) {
          .credit-card {
            height: 138px;
          }
          .credit-card-current {
            height: 152px;
          }
          .credit-layer {
            inset: 28px 8px 8px 8px;
          }
        }
        .run-card {
          transform: translateX(0);
          opacity: 1;
        }
        .run-card-enter {
          animation: run-card-enter 0.5s ease forwards;
        }
        .run-card-leave {
          animation: run-card-leave 0.5s ease forwards;
        }
        @keyframes run-card-enter {
          from {
            transform: translateX(110%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes run-card-leave {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-110%);
            opacity: 0;
          }
        }
        @keyframes credit-swipe-left {
          from {
            transform: translateX(0) rotate(0deg);
            opacity: 1;
          }
          to {
            transform: translateX(-140%) rotate(-9deg);
            opacity: 0;
          }
        }
        @keyframes credit-enter-center {
          from {
            transform: translateX(120%) rotate(8deg);
            opacity: 0;
          }
          to {
            transform: translateX(0) rotate(0deg);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
