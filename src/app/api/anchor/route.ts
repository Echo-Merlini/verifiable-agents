import { NextResponse } from "next/server";

// Same-origin proxy for the Anchor subgraph (The Graph, Subgraph Studio). Gives /verify
// an independent, queryable read-path to the OCP (ERC-8281) on-chain anchor — the same
// Recorded events a raw RPC log read returns, indexed and queryable. Proxied so the browser
// never depends on a third-party CORS policy on stage.
// One subgraph per network: mainnet indexes the showcase anchor, Base Sepolia the live
// per-action anchor. /verify passes the action's chainId so the right index is queried.
const MAINNET_SUBGRAPH =
  process.env.ANCHOR_SUBGRAPH_URL ||
  "https://api.studio.thegraph.com/query/1756895/recomputable-agents-anchor/v0.0.1";
const BASE_SUBGRAPH =
  process.env.ANCHOR_SUBGRAPH_BASE_URL ||
  "https://api.studio.thegraph.com/query/1756895/recomputable-agents-anchor-base/v0.0.1";

const QUERY = `query Anchor($digest: Bytes!) {
  _meta { block { number } hasIndexingErrors }
  anchors(where: { digest: $digest }, first: 1) {
    id
    digest
    committer
    txHash
    blockNumber
    blockTimestamp
  }
}`;

export async function POST(req: Request) {
  try {
    const { digest, chainId } = await req.json();
    if (typeof digest !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(digest)) {
      return NextResponse.json({ error: "digest must be a 0x-prefixed 32-byte hex string" }, { status: 400 });
    }
    const subgraphUrl = Number(chainId) === 84532 ? BASE_SUBGRAPH : MAINNET_SUBGRAPH;
    const r = await fetch(subgraphUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { digest: digest.toLowerCase() } }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = await r.json();
    if (j.errors) return NextResponse.json({ error: j.errors?.[0]?.message || "subgraph error" }, { status: 502 });
    const anchor = j?.data?.anchors?.[0] ?? null;
    return NextResponse.json({ anchor, meta: j?.data?._meta ?? null });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
