/* eslint-disable no-console */
const BASE_URL = process.env.LOAD_TEST_BASE_URL || "http://localhost:3001";
const USERS = Number(process.env.LOAD_TEST_USERS || 50);
const CONCURRENCY = Number(process.env.LOAD_TEST_CONCURRENCY || 50);
const RUN_BRAND_CREATE = String(process.env.LOAD_TEST_RUN_BRAND_CREATE || "false") === "true";
const PASSWORD = process.env.LOAD_TEST_PASSWORD || "Pass@123456";

function nowMs() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

async function withPool(items, limit, worker) {
  const queue = [...items];
  const results = [];
  const runners = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (typeof item === "undefined") break;
      results.push(await worker(item));
    }
  });
  await Promise.all(runners);
  return results;
}

async function request(path, options = {}) {
  const start = nowMs();
  const res = await fetch(`${BASE_URL}${path}`, options);
  const latencyMs = nowMs() - start;
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body, latencyMs };
}

function summarize(latencies) {
  if (!latencies.length) return { avg: 0, p95: 0, max: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const max = sorted[sorted.length - 1];
  return { avg, p95, max };
}

async function main() {
  const stamp = Date.now();
  const users = Array.from({ length: USERS }, (_, idx) => ({
    idx: idx + 1,
    email: `loaduser_${stamp}_${idx + 1}@example.com`,
    name: `Load User ${idx + 1}`,
  }));

  console.log(`[LoadTest] base=${BASE_URL} users=${USERS} concurrency=${CONCURRENCY} brandCreate=${RUN_BRAND_CREATE}`);

  const registerResults = await withPool(users, CONCURRENCY, async (u) => {
    return request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: u.name,
        email: u.email,
        pwd: PASSWORD,
        phone: "",
        brandingMode: "self",
      }),
    });
  });

  const registerOk = registerResults.filter((r) => r.ok).length;
  const registerStats = summarize(registerResults.map((r) => r.latencyMs));
  console.log(`[Register] ok=${registerOk}/${USERS} avg=${registerStats.avg.toFixed(1)}ms p95=${registerStats.p95.toFixed(1)}ms max=${registerStats.max.toFixed(1)}ms`);

  const loginResults = await withPool(users, CONCURRENCY, async (u) => {
    const res = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: u.email, pwd: PASSWORD }),
    });
    return { ...res, email: u.email, token: res.body?.token };
  });

  const loginOk = loginResults.filter((r) => r.ok && typeof r.token === "string").length;
  const loginStats = summarize(loginResults.map((r) => r.latencyMs));
  console.log(`[Login] ok=${loginOk}/${USERS} avg=${loginStats.avg.toFixed(1)}ms p95=${loginStats.p95.toFixed(1)}ms max=${loginStats.max.toFixed(1)}ms`);

  const tokenResults = loginResults.filter((r) => r.ok && typeof r.token === "string");

  const profileResults = await withPool(tokenResults, CONCURRENCY, async (r) => {
    return request("/api/brand-monitor/brand-profile/current", {
      method: "GET",
      headers: { Authorization: `Bearer ${r.token}` },
    });
  });
  const profileOk = profileResults.filter((r) => r.ok).length;
  const profileStats = summarize(profileResults.map((r) => r.latencyMs));
  console.log(`[Profile] ok=${profileOk}/${tokenResults.length} avg=${profileStats.avg.toFixed(1)}ms p95=${profileStats.p95.toFixed(1)}ms max=${profileStats.max.toFixed(1)}ms`);

  if (RUN_BRAND_CREATE) {
    const brandResults = await withPool(tokenResults, CONCURRENCY, async (r, i) => {
      return request("/api/brand-monitor/brand-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${r.token}`,
        },
        body: JSON.stringify({
          name: `Load Brand ${Math.floor(Math.random() * 10_000_000)}`,
          url: `https://example-${stamp}-${Math.floor(Math.random() * 10_000_000)}.com`,
          industry: "SaaS",
          skipScrape: true,
        }),
      });
    });
    const brandOk = brandResults.filter((r) => r.ok).length;
    const brandStats = summarize(brandResults.map((r) => r.latencyMs));
    console.log(`[BrandCreate] ok=${brandOk}/${tokenResults.length} avg=${brandStats.avg.toFixed(1)}ms p95=${brandStats.p95.toFixed(1)}ms max=${brandStats.max.toFixed(1)}ms`);
  }

  const failures = [
    ...registerResults.filter((r) => !r.ok).map((r) => ({ phase: "register", status: r.status })),
    ...loginResults.filter((r) => !r.ok).map((r) => ({ phase: "login", status: r.status })),
    ...profileResults.filter((r) => !r.ok).map((r) => ({ phase: "profile", status: r.status })),
  ];
  if (failures.length) {
    console.log(`[Failures] count=${failures.length}`);
    console.log(failures.slice(0, 10));
    process.exitCode = 1;
    return;
  }

  console.log("[LoadTest] completed without HTTP failures.");
}

main().catch((err) => {
  console.error("[LoadTest] fatal error", err);
  process.exitCode = 1;
});
