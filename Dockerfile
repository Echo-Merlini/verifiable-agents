# Verifiable Agents — Next.js (SSR) preview/deploy.
# Install with bun (respects bun.lock → the exact pinned versions the kit builds
# against; npm re-resolves and drifts @wagmi/core). Build with node (bun x next
# build hits a require-hook bug). Best of both.
FROM node:20-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* are baked at build time. Point the client at the real dinamic
# gateway (kit default is localhost:8787 → ERR_CONNECTION_REFUSED in a container).
ARG NEXT_PUBLIC_GATEWAY_URL=https://gateway.ensub.org
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL

RUN npm install -g bun@1
COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN npx next build

EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
