import { NextResponse } from "next/server";

// Same-origin proxy that reads the OCP Recorded event on 0G Chain (Galileo EVM testnet).
// The showcase digest is anchored a SECOND time here — an independent on-chain commitment
// on a different chain. /verify reads the record() tx's Recorded log and confirms topic1
// (the committed digest) equals the digest recomputed from the query. Proxied so the
// browser never depends on the 0G RPC's CORS policy on stage.
const RPC = process.env.ZEROG_CHAIN_RPC || "https://evmrpc-testnet.0g.ai";
// keccak256("Recorded(bytes32,address)")
const RECORDED = "0xdca60c2087041cbb12d9a57628c6cad28ecbd0437e47c7ab6c3aa6e162bf4497";

export async function POST(req: Request) {
  try {
    const { tx } = await req.json();
    if (typeof tx !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(tx)) {
      return NextResponse.json({ error: "tx must be a 0x-prefixed 32-byte hash" }, { status: 400 });
    }
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [tx] }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = await r.json();
    const rec = j?.result;
    if (!rec) return NextResponse.json({ error: "tx not found / not yet mined on 0G Chain" }, { status: 404 });
    const log = (rec.logs || []).find((l: { topics?: string[] }) => (l.topics?.[0] || "").toLowerCase() === RECORDED);
    if (!log || !log.topics?.[1]) return NextResponse.json({ error: "no Recorded log in tx" }, { status: 502 });
    return NextResponse.json({
      status: rec.status,                              // 0x1 = success
      blockNumber: parseInt(rec.blockNumber, 16),
      address: log.address,                            // the TruthAnchor on 0G Chain
      digest: log.topics[1],                           // the committed digest (topic1)
      committer: "0x" + log.topics[2].slice(-40),      // topic2 = indexed address
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
