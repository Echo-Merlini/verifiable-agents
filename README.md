# Verifiable Agents

> **Autonomous agents you verify, not trust** — attested on the way in, attested on the way out, and **recomputable by anyone** from public data.
>
> *Don't trust. Recompute.*

**Demo:** _(coming — clickable, click "Verify" on any agent action)_
**By:** [Vértice Criativo](https://verticecriativo.pt) — a self-hosted, verifiable, full-stack studio.

---

## The problem

AI agents are black boxes. On-chain, you're asked to **trust** that an agent saw the input it claims, and did what it reports. "Trust me" doesn't belong in a trust-minimized system — and a signature only proves *who* signed, not *that the computation was honest*.

## What Verifiable Agents does

Every agent action is wrapped in a chain of custody that **anyone** can re-derive:

1. **Attested in** — the exact input the model received is committed on-chain (WYRIWE input-provenance, ERC-8299), so the reviewed input is provably the executed input.
2. **Executed** — the agent acts hands-off, including a **cross-chain action via Chainlink CCIP**.
3. **Attested out** — the output/verdict is anchored on-chain (OCP `record()`, ERC-8281).
4. **Recomputed** — click **Verify** and the **Recompute Kit** re-derives the entire flow from public data. Match ⇒ true. **No trust required.**

The differentiator vs. demo-ware: you don't take our word for anything — you press a button and the result recomputes in front of you.

## How it's made

- **Boiler Kit** — the on-chain agent backend (TypeScript · viem · Hono · Bun), restyled to the Vértice design system.
- **Attestation** — via the [`trustless-ai/agent-sdk`](https://github.com/trustless-ai/agent-sdk) ERC clients: **ERC-8299 (WYRIWE)** input provenance in · **ERC-8281 (OCP)** on-chain anchor out · **ERC-8004** identity · **ERC-8323** source-token binding.
- **Verification** — the [`recompute-kit`](https://recomputekit-ai.com) MCP (recompute repo / step / on-chain / storage + receipt proofs); the one-click **Verify** re-derives from the primary artifacts at a pinned ref.
- **Cross-chain** — **Chainlink CCIP** (CCIP Read + router) for the agent's cross-chain action leg.
- **Identity** — **ENS**: the agent is a `.eth` name (`dinamic.eth`), Double PIN via `dinamic.eth.limo`.
- **Storage** — artifacts pinned to **IPFS**, with recompute storage proofs.
- **Deployment** — core primitives live on **Ethereum mainnet** (not a testnet toy); CCIP action leg on **Base** (L2).

## Sponsor tracks

| Track | How it's hit |
| --- | --- |
| **Chainlink** | CCIP cross-chain action leg |
| **ENS** | agent identity via `.eth` / Double PIN |
| **IPFS / Filecoin** | recompute storage proofs + pinned artifacts |
| **L2 (Base)** | action leg deployed on Base |

## Run it yourself

```bash
git clone https://github.com/Echo-Merlini/verifiable-agents
cd verifiable-agents
# setup + run instructions — WIP during the sprint
```

_Full run + verify walkthrough lands before submission._

---

*Built for [ETH hackathon] · Vértice Criativo · Don't trust. Recompute.*
