# Plans & AI process

*Added per the ETHGlobal Lisbon 2026 Continuity Track guidance ("add your plan files to the repo"; you'll
be asked to explain how AI was used). This documents how the project was planned and built, and — in the
spirit of the project itself — is honest about it. **Don't trust. Recompute.***

## How AI was used

This project was built by a human (Tiago Merlini / Vértice Criativo) pair-building with **Claude Code**.
The human owns every architectural decision, every track/scope call, and understands how the whole system
works end-to-end; the AI is the fast hands and a second set of eyes. The working loop is deliberate:

1. **Plan** — write down the approach and the trade-offs before touching code (see `01-verify-hero-plan.md`
   for a real example: the decision to drop Chainlink entirely because outsourcing verification to an oracle
   DON is the literal opposite of "recompute").
2. **Build** — implement against the plan, reusing what already exists rather than rebuilding.
3. **Verify by recompute** — the house discipline is applied to *our own* work: never trust a summary or a
   claim, re-derive it from the primary artifact. This caught our own mistakes more than once — e.g. an
   inferred basis-points rounding rule was **wrong**, and verifying it against the shipped reference code
   surfaced the error before it shipped; a commitment string-form (`0x…` vs `sha256:…`) would have caused a
   silent cross-implementation mismatch, caught by comparing forms; the 0G storage round-trip is proven by
   fetching the bytes back and recomputing the root, not by trusting "we stored it."

The point of the project *is* verifiability, so the process holds itself to the same bar: claims are checked
against live systems and shipped code, and where something is only *attested* (not independently
recomputable), it is labelled honestly rather than overclaimed.

## What was built during the event (Continuity Track)

The open-source client here extends a product we already maintain (the client) on top of a private gateway
backend (the dinamic / ENS Boiler service). New, open-source work shipped during ETHGlobal Lisbon:

- **The `/verify` recompute hero** — five checks re-derived client-side (viem) against a real mainnet
  action: `keccak256` of the input, its provenance, `keccak256` of the output, the on-chain OCP anchor read
  (ERC-8281 `Recorded` event), and the EIP-712 signer recovery. Tamper one byte → the linked checks go red,
  the untouched output stays green. Honestly ternary (amber = "could not check", never a false green).
- **Recomputable MCP integrations**, each graded by the conformance gate as *recomputable* or *attested*:
  - **The Graph** — `graph_query_at_block`: a subgraph read pinned to a finalized block is byte-reproducible
    across indexers → the recomputable lane for indexed data.
  - **UniswapX** — `uniswapx_order_hash`: a signed Dutch-order *intent* whose EIP-712 order hash is
    deterministic → recomputable in principle; non-custodial (the user signs, fillers execute).
  - **0G** — recompute artifacts stored on 0G decentralized storage; the demo action's manifest is really on
    0G, fetched back and re-rooted live on `/verify`.
  - **ENS write** — register a `.eth` name + set records (addr / text / primary / contenthash) non-custodially,
    recomputable.
- **The marketplace** — agents + MCP capabilities, each carrying a verification shield **derived from the
  gate**, not hand-tagged.

## Architecture (so the plan makes sense)

- **Client** (this repo) — Next.js 14 App Router. Surfaces: `/verify` (recompute), `/demo` (drive an agent),
  `/A2A` (hire another agent via escrow), `/mint` (own an agent), `/marketplace`, `/conformance` (the gate),
  and the admin.
- **Gateway** (private) — Bun · Hono · SQLite: the model, the MCP tool layer, and the attestation pipeline
  (WYRIWE input-provenance in → OCP observation-commitment out). Holds no key that can move user funds.
- **Recompute Kit** — the verification layer: a recipe per primitive that re-derives the value from public
  data and issues a portable receipt. This is what powers one-click **Verify** and the conformance gate.
- **On-chain** — GenesisAgentRegistry (mint = agent), ConsultEscrow (A2A), the ERC-8281 anchor; identity via
  ENS + CCIP-Read.
- **Standards** (from `trustless-ai/agent-ercs`): ERC-8004 identity · ERC-8299 input-provenance · ERC-8281
  observation anchor · ERC-8275 reputation · ERC-8323 source-token binding; ENSIP-7 + ENSIP-25 for identity.

## Files here

- `01-verify-hero-plan.md` — the original plan for the `/verify` recompute hero (the demo's centerpiece),
  including the reasoning for the track decision.

*Open core: [trustless-ai](https://github.com/trustless-ai). Shipped by Vértice Criativo. Don't trust. Recompute.*
