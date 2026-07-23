# ── Builder ─────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN npm ci --no-audit --no-fund

COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker

RUN npm run generate -w @ballast/db \
  && npm run build -w @ballast/core \
  && npm run build -w @ballast/db \
  && npm run build -w @ballast/worker \
  && npm prune --omit=dev

# ── Runner ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
  && groupadd -r ballast && useradd -r -g ballast ballast
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=ballast:ballast /app/node_modules ./node_modules
COPY --from=builder --chown=ballast:ballast /app/package.json ./package.json
COPY --from=builder --chown=ballast:ballast /app/packages/core/dist ./node_modules/@ballast/core/dist
COPY --from=builder --chown=ballast:ballast /app/packages/core/package.json ./node_modules/@ballast/core/package.json
COPY --from=builder --chown=ballast:ballast /app/packages/db/dist ./node_modules/@ballast/db/dist
COPY --from=builder --chown=ballast:ballast /app/packages/db/package.json ./node_modules/@ballast/db/package.json
COPY --from=builder --chown=ballast:ballast /app/apps/worker/dist ./dist
COPY --from=builder --chown=ballast:ballast /app/apps/worker/package.json ./worker-package.json

USER ballast
CMD ["node", "dist/index.js"]
