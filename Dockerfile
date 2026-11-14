# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  else npm install; fi

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 brief && \
    adduser --system --uid 1001 brief && \
    mkdir -p /app/uploads && \
    chown -R brief:brief /app/uploads

COPY --from=builder --chown=brief:brief /app/dist ./dist
COPY --from=builder --chown=brief:brief /app/node_modules ./node_modules
COPY --from=builder --chown=brief:brief /app/package.json ./package.json

USER brief
EXPOSE 3000

CMD ["node", "dist/index.js"]
