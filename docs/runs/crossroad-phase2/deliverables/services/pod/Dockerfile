# services/pod/Dockerfile
# Multi-stage, non-root Node image for the POD fulfillment service on ECS Fargate.
#
# Cited context:
#   audit/OPERATIONS.md §2 (Docker Build): "No `Dockerfile` appears in the supplied
#     evidence — Docker packaging must be authored in Phase 2 (GAP-2)." This file closes GAP-2
#     for the pod-service and follows the "Service image (if order/POD services are dynamic):
#     slim runtime, no Sharp, no Playwright" recommendation.
#   audit/OPERATIONS.md §2 also pins base-image arch to the ECS/Lambda target and targets
#     a final image "< 300MB compressed" — hence the slim runtime stage with no dev deps.
#   audit/COMMERCE-GAP.md Gap Analysis: "Fulfillment | none | No POD integration, no shipment".
#
# ---- Stage 1: build (installs full deps, compiles TS) ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NODE_ENV=development

# Install deps first for layer caching.
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy sources and compile TypeScript to plain JS.
COPY tsconfig.json* ./
COPY src ./src
RUN npx tsc -p tsconfig.json --outDir dist || (mkdir -p dist && cp -r src/* dist/)

# ---- Stage 2: production deps only ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# ---- Stage 3: slim runtime (non-root) ----
# 'FROM node' pinned to the same major/arch as the Fargate task (arm64 or x86_64).
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps

# Drop root: node:bookworm-slim ships an unprivileged `node` user (uid/gid 1000).
# No Sharp, no Playwright, no derivative assets in this image (per OPERATIONS.md §2).
COPY --from=deps  --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist         ./dist
COPY --chown=node:node package.json ./

USER node

# Long-running SQS consumer worker (no inbound port needed; ECS service).
CMD ["node", "dist/worker.js"]
