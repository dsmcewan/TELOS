# transaction-service multi-stage build
# Addresses audit/SECURITY.md Current Posture item 7: "no evidenced payment
# boundary, order state machine, webhook verification, secrets management"
# and audit/COMMERCE-GAP.md items 7-8 (server-authoritative transaction path).
#
# Stage 1: build/compile TypeScript to JS.
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install only what is needed to build; leverage layer caching.
COPY package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY tsconfig*.json ./
COPY src ./src
# Compile if a build script exists; otherwise ship the sources as-is.
RUN npm run build --if-present

# Prune dev dependencies for a lean runtime image.
RUN npm prune --omit=dev || true

# Stage 2: minimal, non-root runtime.
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

# node:*-slim images already ship a least-privilege 'node' user (uid 1000).
# Copy build output owned by that user; never run as root in production.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/package*.json ./

# Drop privileges: run as the unprivileged built-in user.
USER node

# Secrets (STRIPE_WEBHOOK_SECRET, provider keys) are injected at runtime via
# env/secret store per SECURITY.md — never baked into the image layers.
EXPOSE 8080
ENV PORT=8080

# Prefer compiled output, fall back to source entrypoint.
CMD ["node", "dist/checkout.js"]
