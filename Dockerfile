# Verifiable Agents — Next.js (SSR) preview/deploy.
# bun install runs at IMAGE-BUILD time (works; bun's installer only fails on the
# NAS bind-mount, not in-build — same pattern as the vertice-api gateway).
FROM oven/bun:1 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN bun x next build

EXPOSE 3000
CMD ["bun", "x", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
