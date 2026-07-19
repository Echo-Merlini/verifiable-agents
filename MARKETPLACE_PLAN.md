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

## Phase C — MCPEntitlementRegistry (contract scope)

The contract that makes "buy an MCP, carried in the agent's metadata" real, and (via its
event log) the substrate for the Phase-D licensed-MCP audit. House style: MIT, `^0.8.20`,
no OpenZeppelin, event-first, pull-payment, recompute-friendly — same idiom as
`ConsultEscrow.sol`.

**The one idea:** entitlements key off the **agent NFT** `(registry, tokenId)`, not off a
wallet or our DB. So a capability is **carried with the token** on transfer — the new
owner inherits every MCP the token holds — and anyone recomputes the entitlement set from
the `EntitlementGranted` log. No trusted database in the authorization path.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MCPEntitlementRegistry — specialized-MCP capabilities owned by the agent NFT
contract MCPEntitlementRegistry {
    address public owner;                              // platform admin (registers MCPs)

    struct Mcp { uint256 price; address payTo; uint64 duration; bool active; }
    mapping(bytes32 => Mcp) public mcps;               // mcpId = keccak256(bytes(catalogSlug))

    // agentKey(registry,tokenId) -> mcpId -> expiry (type(uint64).max = perpetual, else unix ts)
    mapping(bytes32 => mapping(bytes32 => uint64)) public entitlement;
    mapping(address => uint256) public balances;      // pull-payment accrual per payTo

    event OwnerSet(address indexed owner);
    event McpRegistered(bytes32 indexed mcpId, uint256 price, address payTo, uint64 duration, bool active);
    event EntitlementGranted(address indexed registry, uint256 indexed tokenId, bytes32 indexed mcpId, address buyer, uint64 expiry, uint256 paid);
    event Withdrawn(address indexed to, uint256 amount);

    function agentKey(address registry, uint256 tokenId) public pure returns (bytes32) {
        return keccak256(abi.encode(registry, tokenId));
    }
    // registerMcp(onlyOwner) · buy(registry,tokenId,mcpId) payable · isEntitled(...) view · withdraw()
}
```

**Mechanics decided in scope:**
- **Perpetual OR subscription in one field.** `duration == 0` ⇒ perpetual (`expiry = uint64.max`);
  `duration > 0` ⇒ time-boxed, renewals extend from `max(now, currentExpiry)`. Demo sells
  perpetual; the same contract supports recurring (the compliance-revenue shape) with zero code change.
- **Anyone may fund a capability for a token** (it only *adds* value to that token). Authority
  to *use* it is the token's current owner — the gateway checks `ownerOf` off-chain, exactly
  as it recomputes escrow status. No owner-gate on `buy`, so gifting/sponsoring works.
- **`payTo` is per-MCP** (the provider, or treasury) — so third-party MCP providers can be paid
  directly. Capability side of the marketplace is two-sided too.
- **Exact-price `buy`** (`msg.value == price`), pull-payment `withdraw()` — no change-making, no push-reentrancy.
- `mcpId = keccak256(bytes(catalogSlug))` binds on-chain entitlements to the existing
  `agent-mcp-catalog` slugs.

**Gateway integration (Phase C, part 2):**
- Admin registers each *premium* catalog MCP: `registerMcp(mcpId, price, payTo, duration, active)`.
- Tool authorization: for premium MCPs the gateway adds an `isEntitled(registry, tokenId, mcpId)`
  read (same pattern as the escrow read) before allowing the tool; free/base tools skip it.
- `/marketplace` gains an **MCP store**: purchasable capabilities; the buyer's own wallet signs
  `buy()` (non-custodial); the entitlement attaches to their agent token.

**Feeds Phase D:** the `EntitlementGranted` log + the agent's per-action MCP-usage log let a
verifier check *the agent invoked only MCPs it was entitled to* — the least-privilege audit.

**Decisions (locked 2026-07-14):** deploy to **Ethereum mainnet** — one chain across the
whole family (GenesisAgentRegistry + ConsultEscrow + entitlements). First **premium**
(purchasable) MCP is the **ENS write-MCP**: "buy the capability to give your agent a real
`.eth` identity it controls" (`ens_register` / set records / `ens_set_contenthash` gated
behind entitlement). Demo price set low so the buy tx is cheap; gas is the only real cost.

**Files:** `contracts/src/MCPEntitlementRegistry.sol` + `script/DeployMCPEntitlementRegistry.s.sol`
+ `test/MCPEntitlementRegistry.t.sol` (carry-on-transfer, perpetual vs expiry, exact-price,
pull-payment, isEntitled boundary). Then gateway read + `/marketplace` MCP store.

**DEPLOYED (2026-07-14, Ethereum mainnet):**
- `MCPEntitlementRegistry` → **`0x6374556D1c19924584644BD48ebecF444e43Ed9F`** (owner = safe deployer `0xFf9a…4ca14`)
- Premium MCP registered: `ens-write`, mcpId `0x6be39bd6…cc82f794` (= keccak256("ens-write")),
  price **0.001 ETH**, payTo **`0x9C01826A3D027D3CEB42D185A646df055b325aAF`**, duration 0 (perpetual), active.
- Gateway env: `MCP_ENTITLEMENT_ADDRESS` + `MCP_ENTITLEMENT_CHAIN_ID=1` — store live, buy flow enabled.

## Non-goals
- No custodial anything — every purchase (agent, service, entitlement) is signed by the buyer's own wallet.
- Not a general NFT exchange — secondary agent trading can lean on OpenSea + our reputation overlay rather than a bespoke order book (revisit if needed).
- Reputation score is a *predicate over public events*, never an opinion — no admin override, no manual boosting.
