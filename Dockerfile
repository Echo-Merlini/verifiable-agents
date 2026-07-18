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
# Recompute Kit Bots genesis registry (mainnet) — powers /mint.
ARG NEXT_PUBLIC_GENESIS_REGISTRY_ADDRESS=0x8b5AF3A59f81c7e16617E8Eb824BC6FfB792A2C3
ENV NEXT_PUBLIC_GENESIS_REGISTRY_ADDRESS=$NEXT_PUBLIC_GENESIS_REGISTRY_ADDRESS
ARG NEXT_PUBLIC_GENESIS_CHAIN_ID=1
ENV NEXT_PUBLIC_GENESIS_CHAIN_ID=$NEXT_PUBLIC_GENESIS_CHAIN_ID
# This build is the Vértice-branded demo; dinamic.eth keeps its own build.
ARG NEXT_PUBLIC_ENS_NAME=vertice.eth
ENV NEXT_PUBLIC_ENS_NAME=$NEXT_PUBLIC_ENS_NAME
# ConsultEscrow (mainnet) — powers the on-chain settlement panel in admin/settlement.
ARG NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS=0x7057fbA75Ca88B8eF43564be3244bdd7163De04D
ENV NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS=$NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS
ARG NEXT_PUBLIC_ESCROW_CHAIN_ID=1
ENV NEXT_PUBLIC_ESCROW_CHAIN_ID=$NEXT_PUBLIC_ESCROW_CHAIN_ID
ARG NEXT_PUBLIC_ESCROW_RPC=https://ethereum-rpc.publicnode.com
ENV NEXT_PUBLIC_ESCROW_RPC=$NEXT_PUBLIC_ESCROW_RPC

RUN npm install -g bun@1
COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN npx next build

EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
