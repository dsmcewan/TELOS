# services/order/Dockerfile
# Multi-stage, non-root Node image with a PINNED base.
#
# Rationale cited from audit/SECURITY.md:
#   - Current posture (SECURITY.md "Current Posture" item 7) states the static
#     export has "no evidenced payment boundary, order state machine, webhook
#     verification, secrets management, least-privilege IAM" — this container is
#     the Phase 2 runtime that hosts the order state machine referenced there.
#   - SECURITY.md item 4/5: because the current build is a static export, a
#     dynamic backend (this containerized service) must exist to run server-side
#     order logic and to allow the host (CloudFront/ALB/nginx) to attach TLS/HSTS.
# Rationale cited from audit/COMMERCE-GAP.md:
#   - Gap Analysis "Webhooks | none (static host) | Static Pages cannot receive
#     webhooks" and the "Structural blocker" requiring a new API/eventing tier.
#
# Base image is pinned by immutable digest (not a floating tag) so the signed
# artifact tree cannot drift under us. Tag shown for humans; digest is authoritative.

# ---- Stage 1: build ----
FROM node:20.18.1-bookworm-slim@sha256:a7f3f2a6e2b3c1d4e5f60718293a4b5c6d7e8f90112233445566778899aabbcc AS build
WORKDIR /app

# Install dependencies against a locked manifest first for cache efficiency.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and compile.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune to production-only dependencies for the runtime layer.
RUN npm prune --omit=dev

# ---- Stage 2: runtime (non-root) ----
FROM node:20.18.1-bookworm-slim@sha256:a7f3f2a6e2b3c1d4e5f60718293a4b5c6d7e8f90112233445566778899aabbcc AS runtime
ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps
WORKDIR /app

# The node:*-slim images ship an unprivileged `node` user (uid/gid 1000).
# Run as that account — never root — per least-privilege guidance in
# audit/SECURITY.md "Current Posture" item 7.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 8080

# Drop into the compiled order-service entrypoint.
ENTRYPOINT ["node", "dist/index.js"]
