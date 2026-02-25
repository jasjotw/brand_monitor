# Brand Monitor Service

A standalone **Node.js + Express.js** microservice that powers the brand-monitoring features of CogNerd.  
Extracted from the Next.js monolith so it can scale, deploy, and be maintained independently.

---

## Architecture Overview

```
WebApp (Next.js :3000)
       │
       │  BRAND_MONITOR_SERVICE_URL set in .env.local?
       │  ┌──────────────────────────────────────────┐
       │  │  YES → next.config.ts rewrites proxy     │
       │  │         all /api/brand-monitor/* calls    │
       │  │         to this microservice              │
       │  │  NO  → original Next.js route handlers   │
       │  └──────────────────────────────────────────┘
       │
brand-monitor-service (Express :4001)
  ├─ POST /api/brand-monitor/scrape          (JSON)
  ├─ POST /api/brand-monitor/analyze         (SSE stream)
  ├─ GET  /api/brand-monitor/analyses        (JSON)
  ├─ POST /api/brand-monitor/analyses        (JSON)
  ├─ GET  /api/brand-monitor/analyses/:id    (JSON)
  ├─ DELETE /api/brand-monitor/analyses/:id  (JSON)
  └─ GET  /health
```

### Source Layout

```
src/
├── server.ts           ← entry point (load env → check DB → start Express)
├── app.ts              ← Express app factory (CORS, routes, error handler)
├── config/
│   ├── auth.ts         ← better-auth instance (shared with WebApp)
│   ├── constants.ts    ← feature IDs, credit costs, error messages
│   ├── database.ts     ← Drizzle ORM + pg pool
│   ├── env.ts          ← env var loading & validation
│   ├── firecrawl.ts    ← Firecrawl client singleton
│   └── providers.ts    ← AI provider registry (OpenRouter)
├── db/
│   ├── client.ts       ← Drizzle client export
│   ├── schema.ts       ← brandprofile + brandAnalyses tables
│   └── utils.ts        ← withRetry, executeWithRetry, testConnection
├── middleware/
│   └── auth.middleware.ts  ← requireAuth + isSuperuser
├── controllers/
│   ├── scrape.controller.ts    ← POST /scrape
│   ├── analyze.controller.ts   ← POST /analyze (SSE)
│   └── analyses.controller.ts  ← CRUD /analyses
├── routes/
│   ├── scrape.routes.ts
│   ├── analyze.routes.ts
│   └── analyses.routes.ts
├── services/
│   ├── credit.service.ts         ← Autumn SDK credit check / tracking
│   ├── brand.service.ts          ← brandprofile DB queries
│   ├── analysis-crud.service.ts  ← brandAnalyses CRUD
│   ├── scraper.service.ts        ← Firecrawl + AI extraction
│   ├── ai.service.ts             ← competitor ID, prompt gen, AI analysis
│   └── analysis.service.ts       ← full pipeline orchestrator (performAnalysis)
├── prompts/
│   └── index.ts         ← prompt template functions
├── types/
│   └── index.ts         ← all shared TypeScript interfaces
└── utils/
    ├── brand-detection.utils.ts
    ├── competitor.utils.ts
    ├── errors.ts
    ├── scoring.utils.ts
    ├── sentiment.utils.ts
    ├── sse.utils.ts
    └── url.utils.ts
```

---

## Quick Start

### 1. Install dependencies

```bash
cd brand-monitor-service
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Then edit .env with your real values
```

**Critical values:**
| Variable | Notes |
|---|---|
| `DATABASE_URL` | Same PostgreSQL DB as the WebApp |
| `BETTER_AUTH_SECRET` | **Must be identical** to the WebApp's `BETTER_AUTH_SECRET` |
| `OPENROUTER_API_KEY` | Single key for all AI providers via OpenRouter |
| `FIRECRAWL_API_KEY` | Required for website scraping |
| `AUTUMN_SECRET_KEY` | Billing / credit checks |

### 3. Run in development

```bash
npm run dev
# Service starts on http://localhost:4001
# Health: http://localhost:4001/health
```

### 4. Run in production

```bash
npm run build   # compiles TypeScript → dist/
npm start       # runs node dist/server.js
```

---

## WebApp Integration

To route WebApp traffic to this microservice, add one line to `WebApp/.env.local`:

```env
BRAND_MONITOR_SERVICE_URL=http://localhost:4001
```

The `rewrites()` block in `next.config.ts` will transparently proxy all  
`/api/brand-monitor/*` requests to the service. **Remove that variable** to fall back to the original built-in Next.js route handlers at any time.

> **Session cookies** — The Next.js proxy forwards cookies automatically.  
> The microservice validates them against the same `BETTER_AUTH_SECRET`.  
> No separate auth token / API key is required between the two services.

---

## Docker

### Build & run the microservice alone

```bash
cd brand-monitor-service
docker build -t brand-monitor-service .
docker run -p 4001:4001 --env-file .env brand-monitor-service
```

### Run with docker-compose (from the monorepo root)

```bash
# Export required env vars or create a root-level .env, then:
docker-compose up --build brand-monitor
```

---

## Environment Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | no | `4001` | HTTP port |
| `NODE_ENV` | no | `development` | `development` / `production` |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | **yes** | — | Must match WebApp exactly |
| `WEBAPP_BASE_URL` | no | `http://localhost:3000` | CORS allowed origin |
| `CORS_ORIGINS` | no | same as `WEBAPP_BASE_URL` | Comma-separated extra origins |
| `OPENROUTER_API_KEY` | **yes** | — | OpenRouter API key |
| `FIRECRAWL_API_KEY` | **yes** | — | Firecrawl API key |
| `AUTUMN_SECRET_KEY` | **yes** | — | Autumn billing secret key |
| `SUPERUSER_EMAILS` | no | — | Comma-separated admin emails |
| `USE_MOCK_MODE` | no | `false` | Return canned AI responses |

---

## API Reference

### `GET /health`
Returns `200 { status: "ok", ... }` — used by load balancers and docker healthchecks.

### `POST /api/brand-monitor/scrape`  *(auth required)*
Scrapes a URL and returns structured company info + generated prompts.

**Request body:**
```json
{ "url": "https://yeti.com", "maxAge": 604800 }
```
**Response:**
```json
{ "company": { ... }, "prompts": [ ... ] }
```

### `POST /api/brand-monitor/analyze`  *(auth required, SSE)*
Runs the full brand analysis pipeline. Returns a Server-Sent Events stream.

**Request body:**
```json
{
  "company": { "name": "YETI", "url": "https://yeti.com", ... },
  "prompts": [ ... ],
  "competitors": [ { "name": "RTIC", "url": "https://rticoutdoors.com" } ],
  "useWebSearch": false
}
```
**SSE event types:** `start`, `stage`, `competitor-found`, `prompt-generated`,
`analysis-start`, `analysis-complete`, `partial-result`, `progress`, `credits`, `complete`, `error`

### `GET /api/brand-monitor/analyses`  *(auth required)*
Returns all saved analyses for the authenticated user.

### `POST /api/brand-monitor/analyses`  *(auth required)*
Saves a brand analysis result returned by the `/analyze` endpoint.

### `GET /api/brand-monitor/analyses/:analysisId`  *(auth required)*
Returns a single saved analysis.

### `DELETE /api/brand-monitor/analyses/:analysisId`  *(auth required)*
Permanently deletes a saved analysis.
