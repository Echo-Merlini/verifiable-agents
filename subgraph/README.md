# Recomputable Agents — Anchor subgraph

An independent, **queryable** read-path to the OCP (ERC-8281) on-chain anchor.

Each attested agent action is committed on-chain via `TruthAnchor.record()`, which
emits `Recorded(bytes32 indexed digest, address indexed committer)`. This subgraph
indexes those events so `/verify` can confirm the anchor **two independent ways** —
a raw RPC log read **and** a subgraph query — and require they agree. Ethereum proves
the *commitment*; The Graph proves it's *queryable*.

- **Contract:** `TruthAnchor` `0x1e2A118a2bf1C240aE6fDe187c07f905D360f094` (Ethereum mainnet)
- **Event:** `Recorded(indexed bytes32 digest, indexed address committer)`
- **startBlock:** `25548334` (contract deploy block — sync is near-instant)

## Build (no auth needed)

```bash
npm install
npm run codegen
npm run build
```

## Deploy to Subgraph Studio

1. Create a subgraph at <https://thegraph.com/studio> named **`recomputable-agents-anchor`**.
2. Copy the **deploy key** it shows, then:

```bash
npm run auth          # paste the deploy key when prompted
npm run deploy        # deploys ./subgraph.yaml, prompts for a version label (e.g. v0.0.1)
```

3. Studio gives a **query URL** like
   `https://api.studio.thegraph.com/query/<id>/recomputable-agents-anchor/<version>`.
   Wire it into the client as `NEXT_PUBLIC_ANCHOR_SUBGRAPH_URL` (queries authenticate
   with the Graph API key already in use).

## Query — the showcase anchor

```graphql
{
  anchors(where: { digest: "0x1d27faf1a3489564a6fb1ff3790e366b36b6807ff769529a3d953636c59c6596" }) {
    id
    digest
    committer
    txHash
    blockNumber
    blockTimestamp
  }
}
```

`/verify` runs this, then asserts the returned `digest` + `txHash` equal what the raw
RPC log read returned — an independent read-path to the same commitment.
