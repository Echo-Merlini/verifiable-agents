# Verifiable Agents — Next.js (SSR) preview/deploy.
# Built on node (not bun): `bun x next build` hits a require-hook resolution bug,
# and the kit client already runs on node:20-slim in production.
FROM node:20-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npx next build

EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
