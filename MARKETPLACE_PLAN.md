# Marketplace + Console — build plan

_Revised 2026-07-19. Supersedes the reputation-only scaffold note. Decision (Tiago): **two-sided from the start** — one data model, two views._

## Vision

Three things are purchasable, each a primitive made transactable:

1. **An agent** — like a regular NFT (`GenesisAgentRegistry`, ERC-721, mainnet).
2. **An agent's service** — a paid consult (`ConsultEscrow`, mainnet; the /A2A flow).
3. **A specialized MCP** — a capability bought and **bound to the agent's tokenId**, so it is *carried with the token* on transfer.

## The business anchor (why this exists past the demo)

We can't sell the primitive — recompute-kit + the standards are CC0 under trustless-ai (the non-profit trust layer). Vértice sells what it **builds and operates on top**: compliance-grade recomputability as a managed layer for anyone running autonomous agents. Chromium is open; the browser is the business.

**The marketplace is the showroom, not the business.** It is the one surface where buy-agent / buy-service / buy-MCP all visibly emit recomputable receipts — which is the sales collateral for shipping the same layer into a fintech / trading desk / KYC flow, where "prove the agent did what it claims, to an auditor who trusts no vendor log" is *mandatory spend*. The `/console` view is that compliance surface in miniature.

## Architecture — one model, two views

Everything keys off the **agent tokenId**. The gateway assembles one `AgentRecord`; the two client views render subsets.

```
                        AgentRecord (keyed by tokenId)
        ┌───────────────────────────────────────────────────────┐
        │ identity (ENS name, image)  ·  reputation (recomputable)│
        │ services (consult config)   ·  MCP entitlements (on-chain)│
        │ action receipts (attestation chain per action)          │
        └───────────────────────────────────────────────────────┘
              │                                        │
     /marketplace (buyer view)              /console (owner + auditor view)
     discovery + purchase                   receipts + audit
       · agent cards + reputation             · action receipt feed
       · service storefront (escrow)          · licensed-MCP audit (least-privilege)
       · MCP store → buy entitlement          · reputation breakdown (the math, shown)
       · Buy / Hire / Attach CTAs             · Verify buttons (no-trust recompute)
```

## Data model / gateway endpoints

- `GET /marketplace/agents` → `AgentRecord[]` (summary): `tokenId, ensName, image, description, reputation, consultable, listing?`
- `GET /marketplace/agent/:tokenId` → full `AgentRecord` incl. MCP entitlements + recent receipts
- `GET /reputation/:tokenId` → recomputable reputation (below) — its own endpoint so it's independently checkable
- `GET /console/:tokenId/receipts` → action receipt feed (attestation chain per action; the /verify source)
- `GET /console/:tokenId/mcp-audit` → per-action licensed-MCP audit (below)

Owner-only controls use **`/agent/auth` (ungated owner auth), never `/admin/auth`** — see the /demo+/consult sign-in bug. Auditor view is read-only + public.

## Contracts

| Contract | Status | Role |
| --- | --- | --- |
| `GenesisAgentRegistry` | live, mainnet | agent NFTs (buy an agent) |
| `ConsultEscrow` | live, mainnet | paid services (hire an agent) |
| **`MCPEntitlementRegistry`** | **new (small)** | `buyEntitlement(agentTokenId, mcpId)` payable → `EntitlementGranted(tokenId, mcpId, buyer, ts)`; `hasEntitlement(tokenId, mcpId) view`. Entitlement is **keyed by tokenId**, so it travels with the NFT; the gateway checks the *current* token owner. Recompute = read `EntitlementGranted` events. |

The entitlement being on-chain is what makes "carried with the token" real (not a gateway-DB claim you'd have to trust) — and it's what unlocks the audit check below.

## Recomputable reputation (the score on every card)

From `ConsultEscrow` events, per agent:
- **successful** = `Opened → Released` (delivered + settled)
- **unsuccessful** = `Opened → Refunded`
- **stale** = `Opened`, expired, unresolved

Score = **Wilson lower bound (95%)** over successful/unsuccessful; raw counts always shown alongside.

Three gates (non-negotiable, they're what makes it *recomputable* not vibes):
1. **stale is excluded from the Wilson trial** — `n = successful + unsuccessful`. Stale is reported separately, never folded into the ratio.
2. **axis is delivery-vs-verdict, named honestly** — "successful" = *delivered + released*, not "good outcome." The card labels the axis so nobody reads more into it.
3. **fails-closed on an incomplete window** — if the event range can't be fully read, show **unverifiable**, never a fake 0 or a smoothed guess. (Same doctrine as `winRate = None`.)

A verifier re-derives the score from the same events → matches. Add a `reputation/wilson` conformance vector to recompute-kit.

## The recompute angle — capability provenance is a compliance control

Because entitlements are on-chain, we get a **6th check** for free: *did the agent invoke only MCPs it was entitled to?* The gateway logs which MCP each action used; recompute verifies each invoked MCP had a matching on-chain `EntitlementGranted` (base/free tools whitelisted). Green = least-privilege honored; red = used an unlicensed capability.

This is the showroom and the product being the same primitive: in the marketplace it's "your paid MCP works"; in a compliance console it's a **least-privilege / licensed-capability audit** an auditor can re-run.

## Build order (each phase ships something; two-sided honored from Phase B)

- **A — Spine.** `/reputation/:tokenId` (recomputable, from escrow events) + `/marketplace/agents`. One data model exists.
- **B — Both thin views.** `/marketplace` buyer grid (agent cards + reputation, Buy via registry, Hire reusing /A2A) **and** `/console` owner/auditor view (receipt feed + reputation breakdown, reusing /verify). This is where "two-sided from the start" lands.
- **C — Entitlement + close the reputation seam.** `MCPEntitlementRegistry` + MCP store (buy → on-chain entitlement) + gateway reads it. "Carried with the token" becomes real. **Also close the Phase-A seam:** the jobId→agent binding is currently gateway-asserted (from `consult_jobs`); the *outcomes* are already recomputed on-chain. Close it by publishing the per-agent job index (or keying jobId to the agent on-chain) so reputation is end-to-end recomputable with no trusted mapping. (The jobId could commit to the agent — `jobId = keccak(registry ‖ agentId ‖ consumer ‖ nonce)` — making the binding checkable from the Opened event + preimage.)
- **D — Audit check.** The licensed-MCP recompute check in /console + a recompute-kit conformance vector. The compliance story becomes literal.

MVP for Sun 26 = **A + B**, with C + D as the differentiators. If C/D slip, the deck still shows a two-sided, recomputable-reputation marketplace; C/D are what make it a *compliance* product, not a store.

## Non-goals
- No custodial anything — every purchase (agent, service, entitlement) is signed by the buyer's own wallet.
- Not a general NFT exchange — secondary agent trading can lean on OpenSea + our reputation overlay rather than a bespoke order book (revisit if needed).
- Reputation score is a *predicate over public events*, never an opinion — no admin override, no manual boosting.
