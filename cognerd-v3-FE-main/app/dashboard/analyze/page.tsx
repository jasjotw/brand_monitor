"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthToken, getAuthToken } from "@/lib/auth";

type Competitor = {
  name: string;
  url?: string;
};

type BrandRecord = {
  id: string;
  name: string;
  url: string;
  industry?: string | null;
  location?: string | null;
  description?: string | null;
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

function dedupeCompetitors(entries: Competitor[]): Competitor[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deriveNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    const base = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return url;
  }
}

function extractAddedCompetitors(value: unknown): Competitor[] {
  if (!Array.isArray(value)) return [];

  const parsed = value
    .map((entry): Competitor | null => {
      if (typeof entry === "string") {
        return {
          name: deriveNameFromUrl(entry),
          url: entry,
        };
      }
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as { name?: unknown; url?: unknown };
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
      if (!name) return null;
      return { name, url: url || undefined };
    })
    .filter((entry): entry is Competitor => Boolean(entry));

  return dedupeCompetitors(parsed);
}

function extractDiscoveredCompetitors(company: any): Competitor[] {
  const details = Array.isArray(company?.scrapedData?.competitorDetails)
    ? company.scrapedData.competitorDetails
    : [];
  if (details.length > 0) {
    return dedupeCompetitors(
      details
        .map((entry: any) => {
          const name = typeof entry?.name === "string" ? entry.name.trim() : "";
          const url = typeof entry?.url === "string" ? entry.url.trim() : "";
          if (!name) return null;
          return { name, url: url || undefined };
        })
        .filter((entry: Competitor | null): entry is Competitor => Boolean(entry)),
    );
  }

  const names = Array.isArray(company?.scrapedData?.competitors)
    ? company.scrapedData.competitors
    : [];

  return dedupeCompetitors(
    names
      .map((name: unknown) =>
        typeof name === "string" && name.trim() ? { name: name.trim() } : null,
      )
      .filter((entry: Competitor | null): entry is Competitor => Boolean(entry)),
  );
}

function prettyList(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((item) => item.trim()).filter(Boolean);
}

export default function AnalyzePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [searchingCompetitors, setSearchingCompetitors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandRecord | null>(null);
  const [addedCompetitors, setAddedCompetitors] = useState<Competitor[]>([]);
  const [discoveredCompetitors, setDiscoveredCompetitors] = useState<Competitor[]>([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [personasError, setPersonasError] = useState<string | null>(null);

  async function fetchMoreCompetitors(
    profileUrl: string,
    added: Competitor[],
    token: string,
  ) {
    const baseUrl = process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
    setSearchingCompetitors(true);
    setSearchError(null);
    try {
      const scrapeResponse = await fetch(`${baseUrl}/api/brand-monitor/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: profileUrl }),
      });
      const scrapeData = await scrapeResponse.json().catch(() => ({}));

      if (scrapeResponse.status === 401) {
        clearAuthToken();
        router.replace("/login");
        return;
      }

      if (!scrapeResponse.ok) {
        console.error("[AnalyzePage] Competitor search failed", {
          status: scrapeResponse.status,
          body: scrapeData,
        });
        throw new Error(
          scrapeData?.error?.message || scrapeData?.error || "Failed to search competitors.",
        );
      }

      const discovered = extractDiscoveredCompetitors(scrapeData?.company);
      const addedSet = new Set(added.map((entry) => entry.name.toLowerCase()));
      const filteredDiscovered = discovered.filter(
        (entry) => !addedSet.has(entry.name.toLowerCase()),
      );
      setDiscoveredCompetitors(filteredDiscovered);
    } catch (searchErr) {
      console.error("[AnalyzePage] Competitor search exception", searchErr);
      const message =
        searchErr instanceof Error ? searchErr.message : "Failed to search more competitors.";
      setSearchError(message);
    } finally {
      setSearchingCompetitors(false);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      const token = getAuthToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const baseUrl = process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";

        const profileResponse = await fetch(`${baseUrl}/api/brand-monitor/brand-profile/current`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const profileData = await profileResponse.json().catch(() => ({}));

        if (profileResponse.status === 401) {
          clearAuthToken();
          router.replace("/login");
          return;
        }
        if (!profileResponse.ok) {
          console.error("[AnalyzePage] Brand profile fetch failed", {
            status: profileResponse.status,
            body: profileData,
          });
          throw new Error(
            profileData?.error?.message || profileData?.error || "Failed to fetch brand profile.",
          );
        }

        const profileBrand: BrandRecord | null = profileData?.brand ?? null;
        if (isCancelled) return;
        setBrand(profileBrand);
        const added = extractAddedCompetitors(profileBrand?.competitors);
        setAddedCompetitors(added);

        if (!profileBrand?.url) return;
        const existingDiscovered = extractDiscoveredCompetitors(profileBrand);
        const addedSet = new Set(added.map((entry) => entry.name.toLowerCase()));
        const filteredExistingDiscovered = existingDiscovered.filter(
          (entry) => !addedSet.has(entry.name.toLowerCase()),
        );
        setDiscoveredCompetitors(filteredExistingDiscovered);

        const hasCompetitorsInDb =
          added.length > 0 || filteredExistingDiscovered.length > 0;

        if (!hasCompetitorsInDb) {
          await fetchMoreCompetitors(profileBrand.url, added, token);
        }
      } catch (err) {
        console.error("[AnalyzePage] Page load exception", err);
        const message = err instanceof Error ? err.message : "Failed to load analyze screen.";
        if (!isCancelled) setError(message);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [router]);

  const keywords = useMemo(() => prettyList(brand?.scrapedData?.keywords), [brand]);
  const products = useMemo(() => prettyList(brand?.scrapedData?.mainProducts), [brand]);

  async function handleGetPersonas() {
    const token = getAuthToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
    setPersonasLoading(true);
    setPersonasError(null);

    try {
      const currentRes = await fetch(`${baseUrl}/api/brand-monitor/audience/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const currentData = await currentRes.json().catch(() => ({}));

      if (currentRes.status === 401) {
        clearAuthToken();
        router.replace("/login");
        return;
      }
      if (!currentRes.ok) {
        console.error("[AnalyzePage] audience current failed", {
          status: currentRes.status,
          body: currentData,
        });
        throw new Error(
          currentData?.error?.message ||
            currentData?.error ||
            "Failed to fetch audience profile.",
        );
      }

      const existingPersonas = Array.isArray(currentData?.personas) ? currentData.personas : [];
      const hasIcp =
        currentData?.icp &&
        typeof currentData.icp === "object" &&
        Object.keys(currentData.icp).length > 0;
      const hasBaseQuery = typeof currentData?.baseQuery === "string" && currentData.baseQuery.trim().length > 0;

      if (existingPersonas.length === 0) {
        const personaRes = await fetch(`${baseUrl}/api/brand-monitor/audience/generate-personas`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const personaData = await personaRes.json().catch(() => ({}));

        if (personaRes.status === 401) {
          clearAuthToken();
          router.replace("/login");
          return;
        }
        if (!personaRes.ok) {
          console.error("[AnalyzePage] generate-personas failed", {
            status: personaRes.status,
            body: personaData,
          });
          throw new Error(
            personaData?.error?.message ||
              personaData?.error ||
              "Failed to generate personas.",
          );
        }

      }

      if (!hasIcp) {
        const icpRes = await fetch(`${baseUrl}/api/brand-monitor/audience/generate-icp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ additionalInputs: {} }),
        });
        const icpData = await icpRes.json().catch(() => ({}));

        if (icpRes.status === 401) {
          clearAuthToken();
          router.replace("/login");
          return;
        }
        if (!icpRes.ok) {
          console.error("[AnalyzePage] generate-icp failed", {
            status: icpRes.status,
            body: icpData,
          });
          throw new Error(icpData?.error?.message || icpData?.error || "Failed to generate ICP.");
        }
      }

      if (!hasBaseQuery) {
        const queryRes = await fetch(`${baseUrl}/api/brand-monitor/audience/generate-base-query`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const queryData = await queryRes.json().catch(() => ({}));

        if (queryRes.status === 401) {
          clearAuthToken();
          router.replace("/login");
          return;
        }
        if (!queryRes.ok) {
          console.error("[AnalyzePage] generate-base-query failed", {
            status: queryRes.status,
            body: queryData,
          });
          throw new Error(
            queryData?.error?.message || queryData?.error || "Failed to generate base query.",
          );
        }
      }

      router.push("/dashboard/analyze/personas");
    } catch (err) {
      console.error("[AnalyzePage] personas exception", err);
      const message =
        err instanceof Error ? err.message : "Failed to prepare personas and ICP.";
      setPersonasError(message);
    } finally {
      setPersonasLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Fetching brand profile...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No brand profile found. Please add a brand first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="card-hover rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Scraped Brand Profile</h2>
            <p className="text-xs text-muted-foreground">
              Pulled from your saved brand profile before analysis.
            </p>
          </div>
          {brand.logo && (
            <img
              src={brand.logo}
              alt={`${brand.name} logo`}
              className="h-12 w-12 rounded-md border border-border bg-background object-contain p-1"
            />
          )}
        </div>

        <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-background p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Brand</p>
            <p className="mt-1 font-semibold text-foreground">{brand.name}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Website</p>
            <a href={brand.url} target="_blank" rel="noreferrer" className="mt-1 block font-semibold text-primary">
              {brand.url}
            </a>
          </div>
          <div className="rounded-xl border border-border/70 bg-background p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Industry</p>
            <p className="mt-1 font-semibold text-foreground">{brand.industry || "Not set"}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Location</p>
            <p className="mt-1 font-semibold text-foreground">{brand.location || "Not set"}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-[11px] font-semibold text-foreground">Description</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {brand.description ||
                brand.scrapedData?.description ||
                "No description was found in scraped data."}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background p-4">
            <p className="text-[11px] font-semibold text-foreground">Page Metadata</p>
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Title:</span>{" "}
              {brand.scrapedData?.title || "N/A"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Meta Description:</span>{" "}
              {brand.scrapedData?.description || "N/A"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border/70 bg-background p-4">
          <p className="text-[11px] font-semibold text-foreground">Keywords</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {keywords.length > 0 ? (
              keywords.map((keyword) => (
                <span key={keyword} className="rounded-full border border-border px-2 py-1 text-[11px] text-foreground">
                  {keyword}
                </span>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No keywords found.</p>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border/70 bg-background p-4">
          <p className="text-[11px] font-semibold text-foreground">Main Products / Services</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {products.length > 0 ? (
              products.map((product) => (
                <span key={product} className="rounded-full border border-border px-2 py-1 text-[11px] text-foreground">
                  {product}
                </span>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No products found.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card-hover rounded-2xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground">Competitors You Added</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          These are your saved competitors from the brand profile form.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {addedCompetitors.length > 0 ? (
            addedCompetitors.map((competitor) => (
              <div key={competitor.name} className="rounded-xl border border-border/70 bg-background p-3">
                <p className="text-sm font-semibold text-foreground">{competitor.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{competitor.url || "URL not provided"}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No competitors were added to this brand profile.</p>
          )}
        </div>
      </section>

      <section className="card-hover rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">More Competitors Found</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              We fetch new competitors only when you ask.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const token = getAuthToken();
              if (!token) {
                router.replace("/login");
                return;
              }
              if (!brand?.url) return;
              fetchMoreCompetitors(brand.url, addedCompetitors, token);
            }}
            disabled={searchingCompetitors || !brand?.url}
            className="h-8 rounded border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
          >
            {searchingCompetitors ? "Fetching..." : "Fetch More Competitors"}
          </button>
        </div>
        {searchingCompetitors && (
          <p className="mt-3 text-xs text-muted-foreground">Searching more competitors...</p>
        )}
        {searchError && (
          <p className="mt-3 text-xs text-destructive">{searchError}</p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {discoveredCompetitors.length > 0 ? (
            discoveredCompetitors.map((competitor) => (
              <div key={competitor.name} className="rounded-xl border border-border/70 bg-background p-3">
                <p className="text-sm font-semibold text-foreground">{competitor.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{competitor.url || "URL not resolved"}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              No additional competitors were found beyond your saved list.
            </p>
          )}
        </div>
      </section>

      <section className="card-hover rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Personas</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Fetch personas; if missing, generate and save personas + ICP, then open the analysis persona editor.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGetPersonas}
            disabled={personasLoading}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {personasLoading ? "Preparing..." : "Get Personas"}
          </button>
        </div>

        {personasError && (
          <p className="mt-3 text-xs text-destructive">{personasError}</p>
        )}
      </section>
    </div>
  );
}
