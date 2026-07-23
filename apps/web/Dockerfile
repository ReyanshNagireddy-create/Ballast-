# ── Builder ─────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install with the full workspace context so cross-package deps resolve.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN npm ci --no-audit --no-fund

COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN npm run generate -w @ballast/db \
  && npm run build -w @ballast/core \
  && npm run build -w @ballast/db \
  && npm run build -w @ballast/web

# ── Runner ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
  && groupadd -r ballast && useradd -r -g ballast ballast
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

# Next standalone output carries a pruned node_modules with traced deps.
COPY --from=builder --chown=ballast:ballast /app/apps/web/.next/standalone ./
COPY --from=builder --chown=ballast:ballast /app/apps/web/.next/static ./apps/web/.next/static

USER ballast
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
