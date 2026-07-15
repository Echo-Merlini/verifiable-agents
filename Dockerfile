# Verifiable Agents — Next.js (SSR) preview/deploy.
# Install with bun (respects bun.lock → the exact pinned versions the kit builds
# against; npm re-resolves and drifts @wagmi/core). Build with node (bun x next
# build hits a require-hook bug). Best of both.
FROM node:20-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install -g bun@1
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN npx next build

EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
