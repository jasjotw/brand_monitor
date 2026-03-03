"use client";

import { Suspense, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/top-bar";
import { SearchBar } from "@/components/dashboard/search-bar";
import NoBrandHero from "@/components/dashboard/NoBrandHero";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { clearAuthToken, getAuthToken, scheduleTokenRefresh } from "@/lib/auth";
import { AnalysisProvider } from "@/lib/analysis-context";

const pageConfig: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Your AI visibility at a glance" },
  "/dashboard/visibility": { title: "AI Visibility", subtitle: "Track brand presence across AI platforms" },
  "/dashboard/competitors": { title: "Competitors", subtitle: "Benchmark against your competition" },
  "/dashboard/audience": { title: "Personas & ICP", subtitle: "Generate and manage your target audience profile" },
  "/dashboard/prompts": { title: "Prompt Analytics", subtitle: "Explore what audiences ask AI about you" },
  "/dashboard/content": { title: "Content Studio", subtitle: "Optimize and create AI-friendly content" },
  "/dashboard/sources": { title: "Source Attribution", subtitle: "Pages driving your AI visibility" },
  "/dashboard/diagnostics": { title: "Diagnostics", subtitle: "Technical health for AI discovery" },
  "/dashboard/backlinks": { title: "Backlink Analysis", subtitle: "Monitor and optimize your inbound link profile" },
  "/dashboard/alerts": { title: "Alerts", subtitle: "Monitoring notifications and updates" },
  "/dashboard/settings": { title: "Settings", subtitle: "Manage your account and preferences" },
  "/dashboard/agxp": { title: "AGXP", subtitle: "AI-Generated eXperience Platform" },
  "/dashboard/analyze": { title: "Run Analysis", subtitle: "Review scraped profile and competitors before analysis" },
  "/dashboard/analyze/personas": { title: "Analysis Personas", subtitle: "Review generated personas and ICP before analysis" },
  "/dashboard/analyze/prompts": { title: "Analysis Prompts", subtitle: "Review, edit, and run prompts on AI providers" },
};

function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalPlatform, setGlobalPlatform] = useState("all");
  const [globalDateRange, setGlobalDateRange] = useState("7d");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [hasBrand, setHasBrand] = useState<boolean | null>(null);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [currentBrandName, setCurrentBrandName] = useState<string>("Your Brand");
  const [currentPlanName, setCurrentPlanName] = useState<string>("Plan not set");
  const [competitors, setCompetitors] = useState([{ name: "", url: "" }]);
  const [brandProfileId, setBrandProfileId] = useState<string | null>(null);
  const [hasAnalyses, setHasAnalyses] = useState<boolean | null>(null);
  const [uspInput, setUspInput] = useState("");
  const [audienceText, setAudienceText] = useState("");
  const [marketPositioning, setMarketPositioning] = useState<"budget" | "premium" | "luxury">("budget");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const normalizePlanName = (plan: string) => {
    const value = plan.trim().toLowerCase();
    if (!value) return "Plan not set";
    if (value === "business") return "Business";
    if (value === "pro") return "Pro";
    if (value === "basic") return "Basic";
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  // Handle global "/" shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open search on "/" if not typing in an input
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setAuthToken(token);
    scheduleTokenRefresh(token);
    loadUserPlan(token);
    checkBrand(token);
  }, [router]);

  useEffect(() => {
    const nextQuery = searchParams.get("q") || "";
    const nextPlatform = searchParams.get("platform") || "all";
    const nextDateRange = searchParams.get("range") || "7d";
    setGlobalQuery(nextQuery);
    setGlobalPlatform(nextPlatform);
    setGlobalDateRange(nextDateRange);
  }, [searchParams]);

  const updateGlobalFiltersInUrl = (updates: {
    q?: string;
    platform?: string;
    range?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextQ = updates.q ?? globalQuery;
    const nextPlatform = updates.platform ?? globalPlatform;
    const nextRange = updates.range ?? globalDateRange;

    if (nextQ.trim()) params.set("q", nextQ.trim());
    else params.delete("q");

    if (nextPlatform && nextPlatform !== "all") params.set("platform", nextPlatform);
    else params.delete("platform");

    if (nextRange && nextRange !== "7d") params.set("range", nextRange);
    else params.delete("range");

    const nextQueryString = params.toString();
    const nextUrl = nextQueryString ? `${pathname}?${nextQueryString}` : pathname;
    router.replace(nextUrl, { scroll: false });
  };

  useEffect(() => {
    const handler = () => {
      const fromStorage =
        typeof window !== "undefined" ? window.localStorage.getItem("selected_plan_name") : null;
      if (fromStorage && fromStorage.trim()) {
        setCurrentPlanName(normalizePlanName(fromStorage));
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("plan-changed", handler as EventListener);
      window.addEventListener("storage", handler);
      return () => {
        window.removeEventListener("plan-changed", handler as EventListener);
        window.removeEventListener("storage", handler);
      };
    }
    return;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUnauthorized(): void {
    clearAuthToken();
    router.replace("/login");
  }

  // Close mobile menu on navigation
  const handleNavigate = () => {
    setMobileMenuOpen(false);
  };

  // Determine current page config based on the pathname
  const currentKey = Object.keys(pageConfig).find(key => pathname === key) || "/dashboard";
  const currentPage = pageConfig[currentKey] || pageConfig["/dashboard"];

  // Helper to map pathname to the simple IDs the sidebar expects
  const getActiveItem = () => {
    if (pathname === "/dashboard") return "overview";
    return pathname.split("/").pop() || "overview";
  };

  const shouldLock = Boolean(authToken) && hasBrand !== true;
  const showFirstAnalysisPrompt = Boolean(
    brandProfileId && hasAnalyses !== true && !shouldLock
  );

  async function checkBrand(token: string) {
    try {
      setBrandLoading(true);
      setBrandError(null);
      const baseUrl =
        process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
      const response = await fetch(
        `${baseUrl}/api/brand-monitor/brand-profile/exists`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(data?.error?.message || data?.error || "Failed to load brand status.");
      }
      const hasBrandResult = Boolean(data?.hasBrand);
      setHasBrand(hasBrandResult);
      setCurrentBrandName(
        hasBrandResult && typeof data?.brand?.name === "string" && data.brand.name.trim().length > 0
          ? data.brand.name
          : "Your Brand"
      );
      if (!hasBrandResult) {
        setBrandProfileId(null);
        setHasAnalyses(null);
        return;
      }
      const brandId = data?.brand?.id ?? null;
      setBrandProfileId(brandId);
      if (token) {
        setHasAnalyses(null);
        await loadAnalyses(token, brandId ?? undefined);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load brand status.";
      setBrandError(message);
    } finally {
      setBrandLoading(false);
    }
  }

  async function loadUserPlan(token: string) {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
      const response = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) return;
      const data = await response.json().catch(() => ({}));
      const candidates = [
        data?.user?.plan,
        data?.user?.planName,
        data?.user?.subscriptionPlan,
        data?.user?.subscription?.plan,
        data?.user?.config?.plan,
      ];
      const plan = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
      if (plan) {
        const normalized = String(plan).trim();
        const normalizedName = normalizePlanName(normalized);
        const override =
          typeof window !== "undefined" ? window.localStorage.getItem("selected_plan_name") : null;
        setCurrentPlanName(override && override.trim() ? normalizePlanName(override) : normalizedName);
      } else {
        setCurrentPlanName("Plan not set");
      }
    } catch (err) {
      console.warn("[Dashboard] Failed to load user plan:", err);
    }
  }

  async function loadAnalyses(token: string, brandId?: string) {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
      const response = await fetch(`${baseUrl}/api/brand-monitor/analyses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok || !Array.isArray(data)) {
        setHasAnalyses(null);
        return;
      }
      const filtered = brandId
        ? (data as any[]).filter((analysis) => analysis?.brandId === brandId)
        : (data as any[]);
      setHasAnalyses(filtered.length > 0 ? true : brandId ? false : null);
    } catch (err) {
      console.error('[Dashboard] Failed to load analyses status:', err);
      setHasAnalyses(null);
    }
  }

  function ensureHttps(rawUrl: string) {
    let normalized = rawUrl.trim();
    if (!normalized) return normalized;
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = `https://${normalized}`;
    }
    return normalized;
  }

  const addCompetitorRow = () => {
    setCompetitors((prev) => [...prev, { name: "", url: "" }]);
  };

  const updateCompetitor = (index: number, key: "name" | "url", value: string) => {
    setCompetitors((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const removeCompetitorRow = (index: number) => {
    setCompetitors((prev) => prev.filter((_, idx) => idx !== index));
  };

  async function handleCreateBrand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authToken) return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("brandName") || "");
    const url = ensureHttps(String(formData.get("brandUrl") || ""));
    const industry = String(formData.get("industry") || "");
    const location = String(formData.get("location") || "");
    const uspArray = uspInput
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setBrandLoading(true);
      setBrandError(null);
      const baseUrl =
        process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
      const response = await fetch(`${baseUrl}/api/brand-monitor/brand-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name,
          url,
          industry,
          location: location || undefined,
          competitors: competitors
            .map((c) => ({
              name: c.name.trim(),
              url: ensureHttps(c.url),
            }))
            .filter((c) => c.name && c.url),
          usp: uspArray.length > 0 ? uspArray : undefined,
          audience: audienceText || undefined,
          marketPositioning,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(data?.error?.message || data?.error || "Failed to create brand.");
      }
      const brandId = data?.brand?.id ?? null;
      setBrandProfileId(brandId);
      setHasBrand(true);
      setHasAnalyses(false);
      if (authToken) {
        loadAnalyses(authToken, brandId ?? undefined);
      }
      router.push("/dashboard/analyze");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create brand.";
      setBrandError(message);
    } finally {
      setBrandLoading(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar with mobile visibility classes */}
      <div className={cn(
        "z-50 transition-all duration-300 ease-in-out lg:relative",
        mobileMenuOpen 
          ? "fixed inset-y-0 left-0 flex translate-x-0" 
          : "fixed inset-y-0 left-0 flex -translate-x-full lg:relative lg:translate-x-0"
      )}>
        <Sidebar
          activeItem={getActiveItem()}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          locked={shouldLock}
          brandName={currentBrandName}
          planName={currentPlanName}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar 
          title={currentPage.title} 
          subtitle={currentPage.subtitle} 
          onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          isMenuOpen={mobileMenuOpen}
          onSearchClick={() => setSearchOpen(!searchOpen)}
          onFilterClick={() => setSearchOpen(true)}
        />
        
        {/* Search Hover Trigger Zone */}
        <div 
          className="group relative flex flex-col"
          onMouseEnter={() => !searchOpen && setSearchOpen(false)} // Just a placeholder for hover logic
        >
          {/* The "Pull Handle" - subtle line at the top that glows on hover */}
          {!searchOpen && (
            <div 
              className="absolute inset-x-0 top-0 z-40 flex h-2 cursor-pointer items-start justify-center"
              onClick={() => setSearchOpen(true)}
              onMouseEnter={() => {
                // Optional: add a slight delay or just trigger on click
              }}
            >
              <div className="h-1 w-12 rounded-full bg-border transition-all group-hover:h-1.5 group-hover:bg-primary/40 group-hover:w-16" />
            </div>
          )}

          <SearchBar 
            isOpen={searchOpen} 
            onClose={() => setSearchOpen(false)}
            query={globalQuery}
            onQueryChange={(value) => {
              setGlobalQuery(value);
              updateGlobalFiltersInUrl({ q: value });
            }}
            selectedDateValue={globalDateRange}
            onDateChange={(value) => {
              setGlobalDateRange(value);
              updateGlobalFiltersInUrl({ range: value });
            }}
            selectedPlatformValue={globalPlatform}
            onPlatformChange={(value) => {
              setGlobalPlatform(value);
              updateGlobalFiltersInUrl({ platform: value });
            }}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex h-full gap-6 px-4 py-4 sm:px-6 sm:py-6">
            <AnalysisProvider showValues={hasAnalyses === true}>
              <main className="min-w-0 flex-1">
              {showFirstAnalysisPrompt && (
                <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-border bg-card/70 p-3 text-xs text-muted-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Brand profile saved. Ready for your first analysis?
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/dashboard/analyze"
                      className="rounded-full border border-primary px-3 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/10"
                    >
                      Run analysis
                    </Link>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:underline"
                      onClick={() => setHasAnalyses(null)}
                    >
                      Maybe later
                    </button>
                  </div>
                </div>
              )}
                {shouldLock ? (
                <div className="flex flex-col gap-6 pb-6">
                  <NoBrandHero />
                  <div className="rounded-2xl border border-border bg-card/70 p-4 text-sm text-muted-foreground">
                    Your dashboard will unlock once you add a brand profile. Use the form on the right to kick off scraping and analysis.
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {Object.entries(pageConfig).map(([path, info]) => (
                      <div
                        key={path}
                        className="rounded-2xl border border-border/70 bg-card/50 p-4 text-xs text-muted-foreground shadow-sm"
                      >
                        <p className="text-[11px] font-semibold text-foreground">{info.title}</p>
                        <p className="mt-2 text-[10px] text-muted-foreground/80">
                          Waiting for your first analysis to populate {info.subtitle.toLowerCase()}.
                        </p>
                      </div>
                    ))}
                  </div>
                  </div>
                ) : (
                  children
                )}
              </main>
            </AnalysisProvider>
            {shouldLock && (
              <aside className="hidden w-[480px] shrink-0 xl:block">
                <div className="card-hover sticky top-6 rounded-2xl border border-border bg-card p-5">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Add your first brand</h3>
                  <p className="text-xs text-muted-foreground">
                    Create a brand profile to unlock the rest of the dashboard.
                  </p>
                </div>
                  <form className="flex flex-col gap-3" onSubmit={handleCreateBrand}>
                    <label className="flex flex-col gap-2 text-[11px] font-medium text-foreground">
                      Brand name
                      <input
                        name="brandName"
                        placeholder="Acme Corp"
                        className="h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[11px] font-medium text-foreground">
                      Website
                      <input
                        name="brandUrl"
                        placeholder="acme.com"
                        className="h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[11px] font-medium text-foreground">
                      Industry
                      <input
                        name="industry"
                        placeholder="Consumer goods"
                        className="h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[11px] font-medium text-foreground">
                      Location (optional)
                      <input
                        name="location"
                        placeholder="Global"
                        className="h-10 rounded-lg border border-border bg-background px-3 text-xs text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                    <div className="rounded-2xl border border-border bg-secondary/60 p-3 text-[11px]">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold text-foreground">Competitors</span>
                        <button
                          type="button"
                          onClick={addCompetitorRow}
                          className="text-[10px] font-semibold text-primary hover:text-primary/80"
                        >
                          + Add row
                        </button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {competitors.map((competitor, index) => (
                          <div key={`competitor-${index}`} className="flex flex-col gap-2">
                            <div className="flex items-center gap-1">
                              <label className="flex-1">
                                <span className="text-[10px] font-medium text-foreground">Name</span>
                                <input
                                  type="text"
                                  value={competitor.name}
                                  onChange={(event) =>
                                    updateCompetitor(index, "name", event.target.value)
                                  }
                                  placeholder="Competitor name"
                                  className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[10px] text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => removeCompetitorRow(index)}
                                className="text-[10px] font-semibold text-destructive hover:text-destructive/80"
                                disabled={competitors.length === 1}
                              >
                                Remove
                              </button>
                            </div>
                            <label>
                              <span className="text-[10px] font-medium text-foreground">URL</span>
                              <input
                                type="text"
                                value={competitor.url}
                                onChange={(event) =>
                                  updateCompetitor(index, "url", event.target.value)
                                }
                                placeholder="https://competitor.com"
                                className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[10px] text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-secondary/60 p-3 text-[11px]">
                      <div className="flex flex-col gap-3">
                        <label className="flex flex-col gap-2">
                          <span className="text-[11px] font-medium text-foreground">USPs (one per line)</span>
                          <textarea
                            className="min-h-[80px] resize-none rounded-lg border border-border bg-background p-2 text-[10px] text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                            value={uspInput}
                            onChange={(event) => setUspInput(event.target.value)}
                            placeholder="Highlight unique strengths..."
                          />
                        </label>
                        <label className="flex flex-col gap-2">
                          <span className="text-[11px] font-medium text-foreground">Target audience</span>
                          <textarea
                            className="min-h-[60px] resize-none rounded-lg border border-border bg-background p-2 text-[10px] text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                            value={audienceText}
                            onChange={(event) => setAudienceText(event.target.value)}
                            placeholder="Describe the buyer profile."
                          />
                        </label>
                        <label className="flex flex-col gap-2">
                          <span className="text-[11px] font-medium text-foreground">Market positioning</span>
                          <select
                            className="h-10 rounded-lg border border-border bg-background px-2 text-[10px] text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                            value={marketPositioning}
                            onChange={(event) => setMarketPositioning(event.target.value as typeof marketPositioning)}
                          >
                            <option value="budget">Budget</option>
                            <option value="premium">Premium</option>
                            <option value="luxury">Luxury</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={brandLoading}
                      className="mt-1 inline-flex h-10 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {brandLoading ? "Saving..." : "Run Analysis"}
                    </button>
                    {brandError && (
                      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                        {brandError}
                      </div>
                    )}
                  </form>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background text-xs text-muted-foreground">Loading dashboard...</div>}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}
