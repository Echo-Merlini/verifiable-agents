# Plan — Verifiable Agents: the "Verify" demo hero (post-restyle)

## Context
Hackathon build **Verifiable Agents** (~19 Jul). **Track decision locked (2026-07-15): pure ENS + recompute; Chainlink dropped entirely.** Rationale: Chainlink Functions would outsource the *verify* to their oracle DON — the literal opposite of "Don't trust. Recompute." (it would gut the thesis); CCIP is only thesis-safe as heavy transport and isn't worth the days. So we do **one track brilliantly**: ENS identity (dinamic.eth / EIP-3668 / Double-PIN / IPFS — all live) + the **Recompute Kit** as the centerpiece.

Day 1 restyle is **done + pushed** (`Echo-Merlini/verifiable-agents`, commit `5aa223b`); a live preview is still pending (needs the Next dev server stood up — bun-install fails on the NAS bind-mount, so use a Docker image-build or npm). This plan is the **next build: the Verify demo hero.**

## The centerpiece — recompute in the judge's own browser
The strongest, most honest demo: the verification runs **client-side**, not on a server. The gateway already stores the full attestation chain-of-custody; we surface one and let anyone re-derive it live.

**What already exists (reuse, don't rebuild):**
- Gateway stores execution attestations (`agent-attestations` namespace): `rawInputHash` / `sanitizationPipelineHash` / `inputHash` (WYRIWE L1–L3, keccak256(utf8)), L3 **OCP `record()` on-chain** tx, L4 **EIP-712** signature. Served via `listAllAttestations` + `/admin/attestations` (auth'd).
- Client `src/app/admin/attestations/page.tsx` already renders the triple-hash + `PipelineBadge` / `OnchainBadges` and a legend **"each field maps to the recompute-kit recipe that verifies it."** That mapping is the spec for the hero.
- `recompute-kit` (MCP + recomputekit-ai.com) = the recipe source of truth.

## Approach
1. **Public read** — expose a public gateway endpoint for a recent/showcase attestation (the admin one is auth'd). Likely add `GET /attestations/recent` (or reuse an existing public list) returning the row + its public `rawInput` (or its IPFS ref).
2. **`/verify` hero page** (new, in the restyled client) — Vértice-styled, the demo's front door:
   - Show one real mainnet agent execution: ENS identity (dinamic.eth), the input→pipeline→output chain, the L3 OCP tx + L4 signature.
   - A prominent **Verify** button that, **in-browser**, recomputes and reads:
     - `keccak256(utf8(rawInput)) === rawInputHash` (viem, client-side) → ✅ per field;
     - read the **OCP contract on-chain** (viem `readContract`) → the recorded `inputHash` matches → ✅;
     - recover the **EIP-712** signer (viem) → equals the attestor → ✅.
   - Each check animates to green with the recomputed value shown; footer: *"Recomputed from public data — verified. No trust required."* Credit/link the recompute-kit recipes.
3. **ENS + IPFS surfacing** — feature dinamic.eth identity + the IPFS-pinned artifact (with its storage-proof CID) in the hero so the ENS + IPFS story is visible in the same view.
4. **Home** (`app/page.tsx`) — point the primary CTA at `/verify`.

## Critical files
- `client/src/app/verify/page.tsx` (new) + a `VerifyPanel` component — reuse the `AttestationRow` type + badge logic from `app/admin/attestations/page.tsx`; use **viem** (`keccak256`, `readContract`, `recoverTypedDataAddress`) for the in-browser recompute.
- `gateway/src/index.ts` (+ `db.ts` `listAllAttestations`) — add/confirm a **public** recent-attestation read.
- `client/src/app/page.tsx` — CTA → `/verify`.
- Reuse OCP contract address/ABI already referenced by the attestations flow.

## Rest of the sprint (after the hero)
- Live preview / deploy (NAS Docker build → URL; doubles as the demo link).
- README run-through + **deck + 2-min video** (the Verify click is the video's money shot).
- Testnet vs mainnet: the attestation primitives are already **mainnet** — demo on mainnet reads (credibility), no new deploys needed (Chainlink dropped = zero contract deploys).

## Verification
1. Run the client dev server; open `/verify`.
2. Click **Verify** against a real mainnet attestation → every field recomputes ✅ **in the browser**; the OCP on-chain read matches; the EIP-712 signer recovers to the attestor.
3. Tamper test: flip a byte of the shown `rawInput` locally → the recompute goes ✗ red (proves it's really recomputing, not faking green).
4. `bun x next build` clean.

## Non-goals
- No Chainlink, no cross-chain, **no new contract deploys**.
- Not reworking the kit's internal routes — the hero is a new focused surface on top of the (now Vértice-styled) kit.
