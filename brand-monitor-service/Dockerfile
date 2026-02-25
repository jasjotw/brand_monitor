# ─────────────────────────────────────────────────────────────
# brand-monitor-service/Dockerfile
# Multi-stage build:
#   stage 1 (builder)  → compile TypeScript → dist/
#   stage 2 (runtime)  → lean Node.js image with only dist/ + node_modules
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first (cached unless package.json changes)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Only install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Expose the service port (set via PORT env var; default 4001)
EXPOSE 4001

# Graceful shutdown is handled in server.ts — no need for dumb-init
# for a single-process container.
CMD ["node", "dist/server.js"]
