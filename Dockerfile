# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile; \
  else npm install; fi

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 brief && \
    adduser --system --uid 1001 brief && \
    mkdir -p /app/uploads && \
    chown -R brief:brief /app/uploads

COPY --from=builder --chown=brief:brief /app/public ./public
COPY --from=builder --chown=brief:brief /app/.next/standalone ./
COPY --from=builder --chown=brief:brief /app/.next/static ./.next/static

USER brief
EXPOSE 3000

CMD ["node", "server.js"]
