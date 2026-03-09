"use client";

import React, { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Check, X, AlertTriangle, Wrench, Globe, FileCode, Zap, RefreshCw, ArrowRight } from "lucide-react";
import { getAuthToken } from "@/lib/auth";

interface DiagnosticCheck {
  label: string;
  status: "pass" | "fail" | "warning";
  detail: string;
  fix?: string;
}

interface DiagnosticGroup {
  category: string;
  checks: DiagnosticCheck[];
}

interface DiagnosticsData {
  hasData: boolean;
  clientName: string | null;
  generationDate: string | null;
  summary: {
    structuredCoverage: number | null;
    unstructuredCoverage: number | null;
    optimizationOpportunities: number | null;
    overallAEOReadiness: number | null;
    schemaCounts: { valid: number; incorrect: number; missing: number; other: number };
    totalSchemas: number;
    optimizationCount: number;
    caseMetricsFound: string[];
  };
  executiveSummary: {
    surface: string;
    deeper: string;
    rootCauses: string;
  };
  groups: DiagnosticGroup[];
  health: {
    score: number;
    passed: number;
    warnings: number;
    failed: number;
    total: number;
  };
  error?: string;
}

type NormalizedDiagnostics = DiagnosticsData;
type CheckStatus = "pass" | "fail" | "warning";

const statusConfig = {
  pass: { icon: <Check size={13} strokeWidth={2.5} />, bg: "bg-success/10 text-success", badge: "bg-success/10 text-success" },
  fail: { icon: <X size={13} strokeWidth={2.5} />, bg: "bg-destructive/10 text-destructive", badge: "bg-destructive/10 text-destructive" },
  warning: { icon: <AlertTriangle size={13} strokeWidth={2} />, bg: "bg-warning/10 text-warning", badge: "bg-warning/10 text-warning" },
};

const categoryIcons: Record<string, React.ReactNode> = {
  "AI Crawlability": <Globe size={16} strokeWidth={1.5} />,
  "Structured Data": <FileCode size={16} strokeWidth={1.5} />,
  "FAQ Schema Validation": <FileCode size={16} strokeWidth={1.5} />,
  "Content Structure": <Wrench size={16} strokeWidth={1.5} />,
  "Performance": <Zap size={16} strokeWidth={1.5} />,
};

function getReportUrl(payload: any, kind: "aeo" | "geo"): string | null {
  const direct = kind === "aeo"
    ? payload?.aeo_report || payload?.aeoReport
    : payload?.geo_report || payload?.geoReport;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const files = payload?.files || payload?.reports || payload?.artifacts || {};
  const fileEntry = kind === "aeo"
    ? files?.aeo_report || files?.aeoReport
    : files?.geo_report || files?.geoReport;

  if (typeof fileEntry === "string" && fileEntry.trim()) return fileEntry.trim();
  if (fileEntry && typeof fileEntry === "object") {
    const url = fileEntry?.url || fileEntry?.path || fileEntry?.download_url || fileEntry?.downloadUrl;
    if (typeof url === "string" && url.trim()) return url.trim();
  }
  return null;
}

function downloadFromUrl(url: string, filename?: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  if (filename) anchor.download = filename;
  anchor.target = "_blank";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function normalizeAeoPayloadToDiagnostics(candidate: any, fallback: DiagnosticsData | null): NormalizedDiagnostics | null {
  if (!candidate || typeof candidate !== "object") return fallback;

  const root = candidate?.data && typeof candidate.data === "object" ? candidate.data : candidate;
  const aeo = root?.aeo_data && typeof root.aeo_data === "object" ? root.aeo_data : root;
  const schema = root?.schema_data && typeof root.schema_data === "object" ? root.schema_data : null;
  const seo = root?.seo_data && typeof root.seo_data === "object" ? root.seo_data : null;

  const base: DiagnosticsData = fallback || {
    hasData: true,
    clientName: null,
    generationDate: null,
    summary: {
      structuredCoverage: null,
      unstructuredCoverage: null,
      optimizationOpportunities: null,
      overallAEOReadiness: null,
      schemaCounts: { valid: 0, incorrect: 0, missing: 0, other: 0 },
      totalSchemas: 0,
      optimizationCount: 0,
      caseMetricsFound: [],
    },
    executiveSummary: {
      surface: "",
      deeper: "",
      rootCauses: "",
    },
    groups: [],
    health: {
      score: 0,
      passed: 0,
      warnings: 0,
      failed: 0,
      total: 0,
    },
  };

  const schemaCounts = aeo?.summary?.schema_counts || aeo?.summary?.schemaCounts || base.summary.schemaCounts;
  const rawFindings = Array.isArray(aeo?.raw_findings) ? aeo.raw_findings : [];
  const statusMap = (value: unknown): CheckStatus => {
    const v = typeof value === "string" ? value.toLowerCase() : "";
    if (v === "valid" || v === "pass" || v === "ok") return "pass";
    if (v === "missing" || v === "fail" || v === "error" || v === "invalid") return "fail";
    return "warning";
  };
  const statusFromMetric = (value: unknown): CheckStatus => {
    const text = String(value || "").toLowerCase();
    if (text.includes("ok") || text.includes("green")) return "pass";
    if (text.includes("issue") || text.includes("red")) return "fail";
    return "warning";
  };

  const structuredChecks: DiagnosticCheck[] = rawFindings.map((item: any) => ({
    label: String(item?.schemaType || item?.schema_type || "Schema Finding"),
    status: statusMap(item?.status),
    detail: String(item?.issues || item?.summary || "No details available."),
    fix: item?.recommendedChanges ? String(item.recommendedChanges) : undefined,
  }));

  const sectionChecks = (schema?.sections && typeof schema.sections === "object") ? schema.sections : {};
  const toChecks = (arr: unknown, status: "pass" | "fail" | "warning"): DiagnosticCheck[] =>
    Array.isArray(arr)
      ? arr.map((entry: any) => ({
          label: String(entry?.key || "Diagnostic Item"),
          status,
          detail: String(entry?.description || "No details provided."),
        }))
      : [];

  const groupedFromSchema: DiagnosticGroup[] = [
    {
      category: "Schema Enhancements",
      checks: toChecks(sectionChecks.enhancements, "pass"),
    },
    {
      category: "Missing Signals",
      checks: toChecks(sectionChecks.missing, "fail"),
    },
    {
      category: "Outdated Signals",
      checks: toChecks(sectionChecks.outdated, "warning"),
    },
    {
      category: "Recommendations",
      checks: toChecks(sectionChecks.recommendations, "warning"),
    },
  ].filter((g) => g.checks.length > 0);

  const botMatrix = Array.isArray(seo?.diagnostics?.bot_access_matrix?.matrix)
    ? seo.diagnostics.bot_access_matrix.matrix
    : [];
  const crawlabilityChecks: DiagnosticCheck[] = botMatrix.map((entry: any) => {
    const robotsStatus = String(entry?.robots_status || "").toLowerCase();
    const llmsStatus = String(entry?.llms_status || "").toLowerCase();
    const botName = String(entry?.bot || entry?.user_agent || "Bot");
    const status: "pass" | "fail" | "warning" =
      robotsStatus === "allowed"
        ? (llmsStatus === "missing" ? "warning" : "pass")
        : "fail";
    return {
      label: `${botName} Access`,
      status,
      detail: `robots.txt: ${robotsStatus || "unknown"}${llmsStatus ? ` | llms.txt: ${llmsStatus}` : ""}`,
      fix: entry?.remedy ? String(entry.remedy) : undefined,
    };
  });

  const freshnessPages = Array.isArray(seo?.diagnostics?.content_freshness?.pages)
    ? seo.diagnostics.content_freshness.pages
    : [];
  const freshnessChecks: DiagnosticCheck[] = freshnessPages.map((entry: any) => {
    const rawStatus = String(entry?.status || "").toLowerCase();
    const mappedStatus: "pass" | "fail" | "warning" =
      rawStatus === "fresh"
        ? "pass"
        : rawStatus === "stale"
        ? "fail"
        : "warning";
    const ageDays = entry?.age_days;
    const detectedDate = entry?.detected_date;
    return {
      label: String(entry?.url || "Page Freshness"),
      status: mappedStatus,
      detail:
        `freshness: ${rawStatus || "unknown"}` +
        (Number.isFinite(Number(ageDays)) ? ` | age_days: ${Number(ageDays)}` : "") +
        (detectedDate ? ` | detected_date: ${String(detectedDate)}` : ""),
    };
  });

  const faqPages = Array.isArray(seo?.diagnostics?.faq_schema_validation?.pages)
    ? seo.diagnostics.faq_schema_validation.pages
    : [];
  const faqChecks: DiagnosticCheck[] = faqPages.map((entry: any) => {
    const errors = Array.isArray(entry?.errors) ? entry.errors : [];
    const warnings = Array.isArray(entry?.warnings) ? entry.warnings : [];
    const faqFound = Boolean(entry?.faq_found);
    const faqNodesCount = Number(entry?.faq_nodes_count ?? 0);
    const status: "pass" | "fail" | "warning" =
      errors.length > 0 ? "fail" : warnings.length > 0 || !faqFound ? "warning" : "pass";
    return {
      label: String(entry?.url || "FAQ Schema"),
      status,
      detail: `faq_found: ${faqFound} | faq_nodes_count: ${faqNodesCount} | errors: ${errors.length} | warnings: ${warnings.length}`,
      fix: warnings.length > 0 ? String(warnings[0]) : undefined,
    };
  });

  const performance = seo?.diagnostics?.performance && typeof seo.diagnostics.performance === "object"
    ? seo.diagnostics.performance
    : null;
  const performanceChecks: DiagnosticCheck[] = [];
  if (performance) {
    const desktop = performance?.cwv_desktop || {};
    const mobile = performance?.cwv_mobile || {};
    const ssl = performance?.ssl || {};

    performanceChecks.push({
      label: "CWV Desktop",
      status: desktop?.available ? "pass" : "warning",
      detail: desktop?.available ? "Core Web Vitals desktop data available." : String(desktop?.error || "CWV desktop data unavailable."),
    });
    performanceChecks.push({
      label: "CWV Mobile",
      status: mobile?.available ? "pass" : "warning",
      detail: mobile?.available ? "Core Web Vitals mobile data available." : String(mobile?.error || "CWV mobile data unavailable."),
    });
    performanceChecks.push({
      label: "SSL Certificate",
      status: ssl?.valid ? "pass" : "fail",
      detail: `valid: ${Boolean(ssl?.valid)}${ssl?.not_after ? ` | expires: ${String(ssl.not_after)}` : ""}${ssl?.days_to_expiry !== undefined ? ` | days_to_expiry: ${Number(ssl.days_to_expiry)}` : ""}`,
    });
  }

  const faqSummary = seo?.diagnostics?.faq_schema_validation?.summary && typeof seo.diagnostics.faq_schema_validation.summary === "object"
    ? seo.diagnostics.faq_schema_validation.summary
    : null;

  const keyRecommendations = Array.isArray(seo?.key_recommendations) ? seo.key_recommendations : [];
  const recommendationChecks: DiagnosticCheck[] = keyRecommendations.map((item: unknown, idx: number) => ({
    label: `Recommendation ${idx + 1}`,
    status: "warning",
    detail: String(item || "No recommendation details."),
  }));

  const seoSections = Array.isArray(seo?.sections) ? seo.sections : [];
  const sectionByTitle = new Map<string, any>();
  seoSections.forEach((section: any) => {
    const title = String(section?.title || "").trim().toLowerCase();
    if (title) sectionByTitle.set(title, section);
  });
  const sectionForMetric = (metricKey: string): any => {
    const key = metricKey.toLowerCase();
    const mapping: Record<string, string[]> = {
      "robots.txt": ["robots"],
      "llms.txt": ["llms"],
      "crawl data": ["status"],
      "rendering mode": ["rendering mode"],
      schema: ["schema check", "schema"],
      "meta data": ["meta"],
      "headings (h1)": ["headings"],
      canonicals: ["canonicals"],
      "sitemap & crawl": ["sitemap vs crawl"],
      redirects: ["redirects"],
      "url structure": ["url structure"],
      "internal links": ["internal links"],
    };
    const candidates = mapping[key] || [];
    for (const candidateTitle of candidates) {
      const section = sectionByTitle.get(candidateTitle);
      if (section) return section;
    }
    return null;
  };
  const topMetrics = (seo?.top_metrics && typeof seo.top_metrics === "object") ? seo.top_metrics : null;
  const metricCheck = (metricKey: string, label?: string): DiagnosticCheck | null => {
    if (!topMetrics || !(metricKey in topMetrics)) return null;
    const metricValue = (topMetrics as Record<string, unknown>)[metricKey];
    const section = sectionForMetric(metricKey);
    const summary = section?.summary ? String(section.summary) : `status: ${String(metricValue)}`;
    const redFlags = Array.isArray(section?.red_flags) ? section.red_flags : [];
    return {
      label: label || metricKey,
      status: statusFromMetric(metricValue),
      detail: summary,
      fix: redFlags.length > 0 ? String(redFlags[0]) : undefined,
    };
  };
  const scoreTableRow = (row: Record<string, unknown>): "pass" | "fail" | "warning" => {
    const entries = Object.entries(row);
    let hasWarning = false;
    for (const [key, value] of entries) {
      const k = key.toLowerCase();
      if (typeof value === "string") {
        if (k === "status") {
          const code = Number(value);
          if (Number.isFinite(code)) {
            if (code >= 400) return "fail";
            if (code >= 300) hasWarning = true;
          }
        }
        continue;
      }
      if (typeof value === "number") {
        if (k === "status") {
          if (value >= 400) return "fail";
          if (value >= 300) hasWarning = true;
        }
        if (k.includes("redirect_times") && value > 1) hasWarning = true;
        continue;
      }
      if (typeof value !== "boolean") continue;
      if (k.includes("missing") || k.includes("invalid") || k.includes("error") || k.includes("orphaned") || k.includes("uncatalogued") || k.includes("duplicate") || k.includes("blocked")) {
        if (value) return "fail";
      } else if (k.includes("present") || k.includes("found") || k.includes("self_referencing")) {
        if (!value) return "fail";
      } else if (k.includes("multiple") || k.includes("warning")) {
        if (value) hasWarning = true;
      }
    }
    return hasWarning ? "warning" : "pass";
  };
  const summarizeTableRow = (row: Record<string, unknown>): string => {
    const priority = [
      "status",
      "source",
      "schema_present",
      "schema_types",
      "canonical_missing",
      "self_referencing",
      "missing_h1",
      "multiple_h1",
      "title_missing",
      "description_missing",
      "faq_found",
      "faq_nodes_count",
      "in_crawl",
      "in_sitemap",
      "orphaned",
      "uncatalogued",
    ];
    const all = Object.entries(row).filter(([key, value]) => key !== "url" && value !== null && value !== "");
    const fields = [
      ...priority
        .map((key) => all.find(([k]) => k === key))
        .filter((entry): entry is [string, unknown] => Boolean(entry)),
      ...all.filter(([k]) => !priority.includes(k)),
    ]
      .slice(0, 4)
      .map(([key, value]) => `${key}: ${String(value)}`);
    return fields.join(" | ");
  };
  const sectionGroups: DiagnosticGroup[] = seoSections
    .map((section: any) => {
      const title = String(section?.title || "SEO Section");
      const redFlags = Array.isArray(section?.red_flags) ? section.red_flags : [];
      const summary = String(section?.summary || "No summary provided.");
      const details = String(section?.details || "");
      const tablePreview = Array.isArray(section?.table_preview) ? section.table_preview : [];
      const checks: DiagnosticCheck[] = [
        {
          label: `${title} Summary`,
          status: redFlags.length > 0 ? "warning" : "pass",
          detail: details ? `${summary} | ${details}` : summary,
          fix: redFlags.length > 0 ? String(redFlags[0]) : undefined,
        },
      ];
      const previewChecks: DiagnosticCheck[] = tablePreview
        .filter((row: unknown) => row && typeof row === "object")
        .slice(0, 8)
        .map((row: any, idx: number) => {
          const typed = row as Record<string, unknown>;
          const url = typeof typed.url === "string" ? typed.url.trim() : `${title} Row ${idx + 1}`;
          return {
            label: url,
            status: scoreTableRow(typed),
            detail: summarizeTableRow(typed) || "No row details provided.",
          };
        });
      checks.push(...previewChecks);
      return {
        category: title,
        checks,
      };
    })
    .filter((group) => group.checks.length > 0);

  const curatedCrawlabilityChecks = [
    metricCheck("Robots.txt", "Robots.txt Access"),
    metricCheck("LLMs.txt", "LLMs.txt Access"),
    metricCheck("Crawl Data", "Crawl Data"),
    metricCheck("Rendering Mode", "Rendering Mode"),
  ].filter((c): c is DiagnosticCheck => Boolean(c));

  const curatedStructuredChecks = [
    metricCheck("Schema", "Schema Markup"),
    ...(faqSummary
      ? [{
          label: "FAQ Schema",
          status: Number(faqSummary.pages_with_errors ?? 0) > 0 ? "warning" : "pass",
          detail: `pages_scanned: ${Number(faqSummary.pages_scanned ?? 0)} | pages_with_faq: ${Number(faqSummary.pages_with_faq ?? 0)} | total_warnings: ${Number(faqSummary.total_warnings ?? 0)}`,
        } as DiagnosticCheck]
      : []),
    ...structuredChecks.slice(0, 2),
  ];

  const curatedContentChecks = [
    metricCheck("Headings (H1)", "Heading Hierarchy"),
    metricCheck("Meta Data", "Meta Descriptions"),
    metricCheck("Sitemap & Crawl", "Content Freshness"),
    metricCheck("Internal Links", "Internal Linking"),
  ].filter((c): c is DiagnosticCheck => Boolean(c));

  const curatedGroups: DiagnosticGroup[] = [
    ...(curatedCrawlabilityChecks.length > 0 ? [{ category: "AI Crawlability", checks: curatedCrawlabilityChecks }] : []),
    ...(curatedStructuredChecks.length > 0 ? [{ category: "Structured Data", checks: curatedStructuredChecks }] : []),
    ...(curatedContentChecks.length > 0 ? [{ category: "Content Structure", checks: curatedContentChecks }] : []),
    ...(performanceChecks.length > 0 ? [{ category: "Performance", checks: performanceChecks }] : []),
  ];

  const legacyGroups: DiagnosticGroup[] = [
    ...(crawlabilityChecks.length > 0 ? [{ category: "AI Crawlability", checks: crawlabilityChecks }] : []),
    ...(freshnessChecks.length > 0 ? [{ category: "Content Freshness", checks: freshnessChecks }] : []),
    ...(faqChecks.length > 0 ? [{ category: "FAQ Schema Validation", checks: faqChecks }] : []),
    ...(performanceChecks.length > 0 ? [{ category: "Performance", checks: performanceChecks }] : []),
    ...(recommendationChecks.length > 0 ? [{ category: "Key Recommendations", checks: recommendationChecks }] : []),
    ...(structuredChecks.length > 0 ? [{ category: "Structured Data", checks: structuredChecks }] : []),
    ...groupedFromSchema,
    ...sectionGroups,
  ];
  const groups: DiagnosticGroup[] = curatedGroups.length > 0 ? curatedGroups : legacyGroups;

  const allChecks = groups.flatMap((g) => g.checks);
  const passed = allChecks.filter((c) => c.status === "pass").length;
  const warnings = allChecks.filter((c) => c.status === "warning").length;
  const failed = allChecks.filter((c) => c.status === "fail").length;
  const total = allChecks.length;

  const mapped: DiagnosticsData = {
    ...base,
    hasData: true,
    clientName: String(aeo?.client_name || aeo?.clientName || schema?.client_name || base.clientName || "").trim() || base.clientName,
    generationDate: String(aeo?.generation_date || aeo?.generationDate || seo?.generated_at || base.generationDate || "").trim() || base.generationDate,
    summary: {
      structuredCoverage: Number(aeo?.summary?.structuredCoverage ?? base.summary.structuredCoverage ?? 0),
      unstructuredCoverage: Number(aeo?.summary?.unstructuredCoverage ?? base.summary.unstructuredCoverage ?? 0),
      optimizationOpportunities: Number(aeo?.summary?.optimizationOpportunities ?? base.summary.optimizationOpportunities ?? 0),
      overallAEOReadiness: Number(aeo?.summary?.overallAEOReadiness ?? base.summary.overallAEOReadiness ?? 0),
      schemaCounts: {
        valid: Number(schemaCounts?.valid ?? 0),
        incorrect: Number(schemaCounts?.incorrect ?? 0),
        missing: Number(schemaCounts?.missing ?? 0),
        other: Number(schemaCounts?.other ?? 0),
      },
      totalSchemas: Number(aeo?.summary?.total_schemas ?? aeo?.summary?.totalSchemas ?? base.summary.totalSchemas ?? 0),
      optimizationCount: Number(aeo?.summary?.optimization_count ?? aeo?.summary?.optimizationCount ?? base.summary.optimizationCount ?? 0),
      caseMetricsFound: Array.isArray(aeo?.summary?.case_metrics_found)
        ? aeo.summary.case_metrics_found
        : (Array.isArray(base.summary.caseMetricsFound) ? base.summary.caseMetricsFound : []),
    },
    executiveSummary: {
      surface: String(aeo?.executive_summary?.surface || aeo?.executiveSummary?.surface || base.executiveSummary.surface || ""),
      deeper: String(aeo?.executive_summary?.deeper || aeo?.executiveSummary?.deeper || base.executiveSummary.deeper || ""),
      rootCauses: String(aeo?.executive_summary?.root_causes || aeo?.executiveSummary?.rootCauses || base.executiveSummary.rootCauses || ""),
    },
    groups: groups.length > 0 ? groups : base.groups,
    health: {
      score: Number(schema?.metrics?.health_score ?? base.health.score ?? (total > 0 ? Math.round((passed / total) * 100) : 0)),
      passed: total > 0 ? passed : base.health.passed,
      warnings: total > 0 ? warnings : base.health.warnings,
      failed: total > 0 ? failed : base.health.failed,
      total: total > 0 ? total : base.health.total,
    },
  };

  return mapped;
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCompetitors(value: unknown): Array<{ name: string; url: string }> {
  if (!Array.isArray(value)) return [];
  const out: Array<{ name: string; url: string }> = [];
  const seen = new Set<string>();
  value.forEach((entry) => {
    if (!entry) return;
    if (typeof entry === "string") {
      const name = entry.trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ name, url: "" });
      return;
    }
    if (typeof entry === "object") {
      const row = entry as { name?: unknown; url?: unknown };
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        name,
        url: typeof row.url === "string" ? row.url.trim() : "",
      });
    }
  });
  return out;
}

export function DiagnosticsPage() {
  const searchParams = useSearchParams();
  const globalQuery = (searchParams.get("q") || "").trim().toLowerCase();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [aeoGenerateResult, setAeoGenerateResult] = React.useState<any>(null);
  const [geoGenerateResult, setGeoGenerateResult] = React.useState<any>(null);
  const effectiveData = React.useMemo<DiagnosticsData | null>(() => {
    return normalizeAeoPayloadToDiagnostics(aeoGenerateResult, null);
  }, [aeoGenerateResult]);
  const diagnosticsRaw = React.useMemo(
    () =>
      ({
        ...((effectiveData || {}) as any),
        ...((aeoGenerateResult && typeof aeoGenerateResult === "object") ? aeoGenerateResult : {}),
        ...((geoGenerateResult && typeof geoGenerateResult === "object") ? geoGenerateResult : {}),
      }),
    [effectiveData, aeoGenerateResult, geoGenerateResult]
  );
  const aeoReportUrl = getReportUrl(diagnosticsRaw, "aeo");
  const geoReportUrl = getReportUrl(diagnosticsRaw, "geo");
  const hasAeoReport = Boolean(
    aeoReportUrl ||
    diagnosticsRaw?.aeo_report_exists ||
    diagnosticsRaw?.aeoReportExists ||
    diagnosticsRaw?.files?.aeo_report?.exists
  );
  const hasAeoData = Boolean(
    hasAeoReport ||
    aeoGenerateResult?.success ||
    aeoGenerateResult?.data?.aeo_data ||
    aeoGenerateResult?.data?.seo_data ||
    aeoGenerateResult?.data?.schema_data
  );
  const [generatingDiagnostics, setGeneratingDiagnostics] = React.useState(false);
  const [rerunningAeo, setRerunningAeo] = React.useState(false);
  const [generatingGeoFiles, setGeneratingGeoFiles] = React.useState(false);
  const [downloadingAuditReport, setDownloadingAuditReport] = React.useState(false);
  const [downloadingGeoReport, setDownloadingGeoReport] = React.useState(false);
  const [generateDiagnosticsError, setGenerateDiagnosticsError] = React.useState<string | null>(null);
  const [showDownloadOptions, setShowDownloadOptions] = React.useState(false);
  const aeoRequestInFlightRef = React.useRef(false);
  const initialAeoFetchDoneRef = React.useRef(false);
  const downloadMenuRef = React.useRef<HTMLDivElement | null>(null);
  const floatingDownloadMenuRef = React.useRef<HTMLDivElement | null>(null);
  const lastDownloadToggleAtRef = React.useRef(0);

  const groupsRaw = Array.isArray(effectiveData?.groups) ? effectiveData.groups : [];
  const groups = groupsRaw
    .map((group) => ({
      ...group,
      checks: group.checks.filter((check) => {
        const haystack = `${group.category} ${check.label} ${check.detail} ${check.fix || ""}`.toLowerCase();
        return !globalQuery || haystack.includes(globalQuery);
      }),
    }))
    .filter((group) => group.checks.length > 0 || !globalQuery);
  const allChecks = groups.flatMap((g) => g.checks);
  const passed = effectiveData?.health?.passed ?? allChecks.filter((c) => c.status === "pass").length;
  const warnings = effectiveData?.health?.warnings ?? allChecks.filter((c) => c.status === "warning").length;
  const failed = effectiveData?.health?.failed ?? allChecks.filter((c) => c.status === "fail").length;
  const total = effectiveData?.health?.total ?? allChecks.length;
  const score = effectiveData?.health?.score ?? (total > 0 ? Math.round((passed / total) * 100) : 0);

  const summary = effectiveData?.summary;

  const loadBrandContext = React.useCallback(async () => {
    const token = getAuthToken();
    if (!token) throw new Error("Authentication required.");

    const brandBaseUrl = process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
    const [meRes, brandRes] = await Promise.all([
      fetch(`${brandBaseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${brandBaseUrl}/api/brand-monitor/brand-profile/current`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const meData = await meRes.json().catch(() => ({}));
    const brandData = await brandRes.json().catch(() => ({}));
    const userId = String(meData?.user?.id || meData?.user?._id || "").trim();
    const brand = brandData?.brand || {};
    const brandId = String(brand?.id || "").trim();
    const brandUrl = String(brand?.url || "").trim();
    const customerName = String(brand?.name || "Cognerd").trim();
    const hostname = (() => {
      try {
        return new URL(brandUrl).hostname;
      } catch {
        return brandUrl.replace(/^https?:\/\//, "").split("/")[0] || "cognerd.ai";
      }
    })();
    const domainRegex = escapeRegexLiteral(hostname);
    const competitors = parseCompetitors(brand?.competitors);

    return {
      customerName,
      userId,
      brandId,
      brandUrl,
      domainRegex,
      competitors,
    };
  }, []);

  const runAeoGenerate = React.useCallback(async (showGlobalLoader = false) => {
    if (aeoRequestInFlightRef.current) return;
    aeoRequestInFlightRef.current = true;
    try {
      if (showGlobalLoader) setLoading(true);
      setError(null);
      setGenerateDiagnosticsError(null);

      const pythonServiceBaseUrl = process.env.NEXT_PUBLIC_PYTHON_SERVICE_BASE_URL || "http://localhost:8001";
      const ctx = await loadBrandContext();
      const aeoPayload = {
        customer_name: ctx.customerName,
        url: ctx.brandUrl || "https://cognerd.ai",
        domain_regex: ctx.domainRegex || "cognerd\\.ai",
        brand_id: ctx.brandId || "brand_123",
        user_id: ctx.userId || "user_456",
        brand_url: ctx.brandUrl || "https://cognerd.ai",
      };

      const aeoRes = await fetch(`${pythonServiceBaseUrl}/aeo-reports/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aeoPayload),
      });
      const aeoJson = await aeoRes.json().catch(() => ({}));
      setAeoGenerateResult(aeoJson);
      if (!aeoRes.ok) {
        throw new Error(aeoJson?.error?.message || aeoJson?.error || "AEO report generation failed.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load diagnostics.";
      setError(message);
      setGenerateDiagnosticsError(message);
    } finally {
      aeoRequestInFlightRef.current = false;
      if (showGlobalLoader) setLoading(false);
    }
  }, [loadBrandContext]);

  const fetchStoredAeoReport = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setGenerateDiagnosticsError(null);

      const pythonServiceBaseUrl = process.env.NEXT_PUBLIC_PYTHON_SERVICE_BASE_URL || "http://localhost:8001";
      const ctx = await loadBrandContext();
      const params = new URLSearchParams();
      if (ctx.userId) params.set("user_id", ctx.userId);
      if (ctx.brandId) params.set("brand_id", ctx.brandId);
      if (ctx.brandUrl) params.set("brand_url", ctx.brandUrl);

      const fetchRes = await fetch(`${pythonServiceBaseUrl}/aeo-reports/fetch?${params.toString()}`);
      const fetchJson = await fetchRes.json().catch(() => ({}));
      if (!fetchRes.ok) {
        throw new Error(fetchJson?.error?.message || fetchJson?.error || "Failed to fetch AEO report.");
      }
      setAeoGenerateResult(fetchJson);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch diagnostics report.";
      setError(message);
      setGenerateDiagnosticsError(message);
    } finally {
      setLoading(false);
    }
  }, [loadBrandContext]);

  const handleDownloadAuditReport = async () => {
    try {
      setDownloadingAuditReport(true);
      setGenerateDiagnosticsError(null);
      const pythonServiceBaseUrl = process.env.NEXT_PUBLIC_PYTHON_SERVICE_BASE_URL || "http://localhost:8001";
      const ctx = await loadBrandContext();
      const params = new URLSearchParams();
      if (ctx.userId) params.set("user_id", ctx.userId);
      if (ctx.brandId) params.set("brand_id", ctx.brandId);
      if (ctx.brandUrl) params.set("brand_url", ctx.brandUrl);
      params.set("format", "pdf");

      const response = await fetch(`${pythonServiceBaseUrl}/aeo-reports/download?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message || payload?.error || "Failed to download audit report.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      downloadFromUrl(objectUrl, "aeo_audit_report.pdf");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setShowDownloadOptions(false);
    } catch (err) {
      setGenerateDiagnosticsError(err instanceof Error ? err.message : "Failed to download audit report.");
    } finally {
      setDownloadingAuditReport(false);
    }
  };

  const handleDownloadGeoFiles = async () => {
    try {
      setDownloadingGeoReport(true);
      setGenerateDiagnosticsError(null);
      const pythonServiceBaseUrl = process.env.NEXT_PUBLIC_PYTHON_SERVICE_BASE_URL || "http://localhost:8001";
      const ctx = await loadBrandContext();
      const params = new URLSearchParams();
      if (ctx.userId) params.set("user_id", ctx.userId);
      if (ctx.brandId) params.set("brand_id", ctx.brandId);
      if (ctx.brandUrl) params.set("brand_url", ctx.brandUrl);

      const response = await fetch(`${pythonServiceBaseUrl}/geo-files/reports/download?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message || payload?.error || "Failed to download GEO files.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      downloadFromUrl(objectUrl, "geo_files.zip");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setShowDownloadOptions(false);
    } catch (err) {
      setGenerateDiagnosticsError(err instanceof Error ? err.message : "Failed to download GEO files.");
    } finally {
      setDownloadingGeoReport(false);
    }
  };

  const handleGetDiagnostics = async () => {
    try {
      setGeneratingDiagnostics(true);
      await runAeoGenerate(false);
    } catch (err) {
      setGenerateDiagnosticsError(err instanceof Error ? err.message : "Failed to generate diagnostics.");
    } finally {
      setGeneratingDiagnostics(false);
    }
  };

  const handleRerunAeo = async () => {
    try {
      setRerunningAeo(true);
      await runAeoGenerate(false);
    } catch (err) {
      setGenerateDiagnosticsError(err instanceof Error ? err.message : "Failed to re-run AEO diagnostics.");
    } finally {
      setRerunningAeo(false);
    }
  };

  const handleGenerateGeoFiles = async () => {
    try {
      setGeneratingGeoFiles(true);
      setGenerateDiagnosticsError(null);

      const pythonServiceBaseUrl = process.env.NEXT_PUBLIC_PYTHON_SERVICE_BASE_URL || "http://localhost:8001";
      const ctx = await loadBrandContext();

      const geoPayload = {
        customer_name: ctx.customerName,
        brand_url: ctx.brandUrl || "https://cognerd.ai",
        competitors: ctx.competitors.length > 0 ? ctx.competitors : [
          { name: "Competitor One", url: "https://example1.com" },
          { name: "Competitor Two", url: "https://example2.com" },
        ],
        max_pages: 15,
        faqs_md_path: null,
        brand_id: ctx.brandId || "brand_123",
        user_id: ctx.userId || "user_456",
      };

      const geoRes = await fetch(`${pythonServiceBaseUrl}/geo-files/generate-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geoPayload),
      });
      const geoJson = await geoRes.json().catch(() => ({}));
      setGeoGenerateResult(geoJson);
      if (!geoRes.ok) {
        throw new Error(geoJson?.error?.message || geoJson?.error || "GEO files generation failed.");
      }
    } catch (err) {
      setGenerateDiagnosticsError(err instanceof Error ? err.message : "Failed to generate GEO files.");
    } finally {
      setGeneratingGeoFiles(false);
    }
  };

  useEffect(() => {
    if (initialAeoFetchDoneRef.current) return;
    initialAeoFetchDoneRef.current = true;
    fetchStoredAeoReport();
  }, [fetchStoredAeoReport]);

  useEffect(() => {
    const listener = () => {
      const now = Date.now();
      if (now - lastDownloadToggleAtRef.current < 200) return;
      lastDownloadToggleAtRef.current = now;
      setShowDownloadOptions((prev) => !prev);
    };
    window.addEventListener("diagnostics-download", listener);
    return () => window.removeEventListener("diagnostics-download", listener);
  }, []);

  useEffect(() => {
    if (!showDownloadOptions) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const targetElement = target instanceof Element ? target : null;
      const clickedInsideInlineMenu = Boolean(downloadMenuRef.current && target && downloadMenuRef.current.contains(target));
      const clickedInsideFloatingMenu = Boolean(floatingDownloadMenuRef.current && target && floatingDownloadMenuRef.current.contains(target));
      const clickedDownloadTrigger = Boolean(
        targetElement?.closest('[data-diagnostics-download-trigger="true"]')
      );
      if (!clickedInsideInlineMenu && !clickedInsideFloatingMenu && !clickedDownloadTrigger) {
        setShowDownloadOptions(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showDownloadOptions]);

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchStoredAeoReport} className="underline underline-offset-2">Retry</button>
        </div>
      )}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">Loading diagnostics...</div>
      ) : null}
      {effectiveData?.error ? (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-warning">
          {effectiveData.error}
        </div>
      ) : null}
      {showDownloadOptions && hasAeoData ? (
        <div
          ref={floatingDownloadMenuRef}
          className="fixed right-4 top-14 z-40 min-w-40 rounded-lg border border-border bg-card p-2 shadow-lg"
        >
          <button
            onClick={handleDownloadAuditReport}
            disabled={downloadingAuditReport}
            className="block w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60"
          >
            {downloadingAuditReport ? "Downloading..." : "Audit Report"}
          </button>
          <button
            onClick={handleDownloadGeoFiles}
            disabled={downloadingGeoReport}
            className="mt-1 block w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60"
          >
            {downloadingGeoReport ? "Downloading..." : "GEO Files"}
          </button>
        </div>
      ) : null}
      {!hasAeoData && !loading && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <img src="/images/rench.jpg" alt="Diagnostics fallback" className="h-36 w-auto rounded-lg border border-border object-cover" />
            <p className="text-xs text-muted-foreground">
              AEO report is missing. Run diagnostics to generate a fresh report.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGetDiagnostics}
                disabled={generatingDiagnostics}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {generatingDiagnostics ? "Generating..." : "Get Diagnostics"}
              </button>
              <div ref={downloadMenuRef} className="relative">
                <button
                  onClick={() => setShowDownloadOptions((prev) => !prev)}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                >
                  Download
                </button>
                {showDownloadOptions ? (
                  <div className="absolute right-0 top-full z-20 mt-2 min-w-40 rounded-lg border border-border bg-card p-2 shadow-lg">
                    <button
                      onClick={handleDownloadAuditReport}
                      disabled={downloadingAuditReport}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60"
                    >
                      {downloadingAuditReport ? "Downloading..." : "Audit Report"}
                    </button>
                    <button
                      onClick={handleDownloadGeoFiles}
                      disabled={downloadingGeoReport}
                      className="mt-1 block w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60"
                    >
                      {downloadingGeoReport ? "Downloading..." : "GEO Files"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {generateDiagnosticsError ? (
              <p className="text-xs text-destructive">{generateDiagnosticsError}</p>
            ) : null}
          </div>
        </div>
      )}

      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-1 card-hover flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-5">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#F5F0EB" strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke={score >= 70 ? "#5B9A6B" : score >= 50 ? "#D4A44E" : "#D4644E"} strokeWidth="3" strokeDasharray={`${score * 0.942} 100`} strokeLinecap="round" />
            </svg>
            <span className="absolute text-lg font-bold text-foreground">{score}</span>
          </div>
          <span className="text-xs font-semibold text-foreground">Health Score</span>
          <span className="text-[10px] text-muted-foreground">{passed}/{Math.max(1, total)} passing</span>
        </div>

        {[
          { label: "Passed", value: String(passed), color: "text-success", icon: <Check size={16} strokeWidth={2} /> },
          { label: "Warnings", value: String(warnings), color: "text-warning", icon: <AlertTriangle size={16} strokeWidth={1.5} /> },
          { label: "Failed", value: String(failed), color: "text-destructive", icon: <X size={16} strokeWidth={2} /> },
          { label: "Last Scan", value: effectiveData?.generationDate || "-", color: "text-foreground", icon: <RefreshCw size={16} strokeWidth={1.5} /> },
        ].map((stat) => (
          <div key={stat.label} className="card-hover flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-secondary", stat.color)}>{stat.icon}</div>
            <div>
              <span className={cn("text-xl font-semibold", stat.color)}>{stat.value}</span>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
            {stat.label === "Last Scan" ? (
              <button
                onClick={handleRerunAeo}
                disabled={rerunningAeo || generatingDiagnostics || generatingGeoFiles}
                className="mt-1 w-fit rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
              >
                {rerunningAeo ? "Re-running..." : "Re-run"}
              </button>
            ) : null}
          </div>
        ))}
        <div className="card-hover flex flex-col justify-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground">
            <FileCode size={16} strokeWidth={1.5} />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">GEO Files</span>
            <p className="text-[11px] text-muted-foreground">Generate latest GEO files</p>
          </div>
          <button
            onClick={handleGenerateGeoFiles}
            disabled={generatingGeoFiles || generatingDiagnostics || rerunningAeo}
            className="w-fit rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary disabled:opacity-60"
          >
            {generatingGeoFiles ? "Generating..." : "Generate Files"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] text-muted-foreground">Client</p>
          <p className="text-sm font-semibold text-foreground">{effectiveData?.clientName || "-"}</p>
          <p className="mt-3 text-[11px] text-muted-foreground">Overall AEO Readiness</p>
          <p className="text-lg font-bold text-foreground">{summary?.overallAEOReadiness ?? 0}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] text-muted-foreground">Schema Audit</p>
          <p className="text-sm font-semibold text-foreground">
            {summary?.totalSchemas ?? 0} total | {summary?.schemaCounts?.valid ?? 0} valid | {summary?.schemaCounts?.incorrect ?? 0} incorrect | {summary?.schemaCounts?.missing ?? 0} missing
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground">Optimization Count</p>
          <p className="text-lg font-bold text-foreground">{summary?.optimizationCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] text-muted-foreground">Executive Summary</p>
          <p className="text-xs text-foreground">{effectiveData?.executiveSummary?.surface || "-"}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">Root Causes</p>
          <p className="text-xs text-foreground">{effectiveData?.executiveSummary?.rootCauses || "-"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {groups.map((group, groupIdx) => {
          const gPassed = group.checks.filter((c) => c.status === "pass").length;
          return (
            <div key={`${group.category}-${groupIdx}`} className="card-hover rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8 text-primary">
                    {categoryIcons[group.category] || <Wrench size={16} strokeWidth={1.5} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-card-foreground">{group.category}</h3>
                    <p className="text-[11px] text-muted-foreground">{gPassed}/{group.checks.length} passing</p>
                  </div>
                </div>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${group.checks.length ? (gPassed / group.checks.length) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="flex flex-col">
                {group.checks.map((check, i) => (
                  <div key={`${check.label}-${i}`} className={cn("flex items-start gap-3 px-5 py-3", i < group.checks.length - 1 && "border-b border-border/50")}>
                    <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", statusConfig[check.status].bg)}>
                      {statusConfig[check.status].icon}
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground">{check.label}</span>
                      <span className="text-[11px] leading-relaxed text-muted-foreground">{check.detail}</span>
                      {check.fix && (
                        <button className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80">
                          Fix: {check.fix}
                          <ArrowRight size={10} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
