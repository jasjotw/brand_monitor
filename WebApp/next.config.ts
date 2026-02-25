import type { NextConfig } from "next";

const BRAND_MONITOR_URL = process.env.BRAND_MONITOR_SERVICE_URL;

const nextConfig: NextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/brand-profiles',
        permanent: false,
      },
    ];
  },
  // ── Microservice proxy ──────────────────────────────────────────────────
  // When BRAND_MONITOR_SERVICE_URL is set, brand-monitor API calls are
  // transparently forwarded to the Express microservice.
  // Remove (or leave BRAND_MONITOR_SERVICE_URL unset) to fall back to the
  // built-in Next.js route handlers.
  async rewrites() {
    if (!BRAND_MONITOR_URL) return [];

    return [
      // SSE streaming — analyze
      {
        source: '/api/brand-monitor/analyze',
        destination: `${BRAND_MONITOR_URL}/api/brand-monitor/analyze`,
      },
      // JSON — scrape
      {
        source: '/api/brand-monitor/scrape',
        destination: `${BRAND_MONITOR_URL}/api/brand-monitor/scrape`,
      },
      // REST — analyses collection & individual item
      {
        source: '/api/brand-monitor/analyses',
        destination: `${BRAND_MONITOR_URL}/api/brand-monitor/analyses`,
      },
      {
        source: '/api/brand-monitor/analyses/:analysisId',
        destination: `${BRAND_MONITOR_URL}/api/brand-monitor/analyses/:analysisId`,
      },
    ];
  },
};

export default nextConfig;
