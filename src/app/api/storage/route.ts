import { NextResponse } from "next/server";

// Same-origin proxy for the 0G storage MCP (the gateway's /mcp/zerog is not CORS-open,
// by design). Server → gateway has no CORS, so the admin Storage tab calls THIS route.
// Keeps the production gateway untouched.
const GW = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

const TOOL: Record<string, string> = {
  root: "og_root",             // read-only: content → content-addressed flow-merkle root (no upload, no gas)
  store: "og_store_artifact",  // upload to 0G → same root + tx
  fetch: "og_fetch_artifact",  // rootHash → bytes back
};

export async function POST(req: Request) {
  try {
    const { action, content, rootHash } = await req.json();
    const name = TOOL[action];
    if (!name) return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });

    const args = action === "fetch" ? { rootHash } : { content };
    const r = await fetch(`${GW}/mcp/zerog`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
      signal: AbortSignal.timeout(action === "store" ? 90_000 : 30_000),
    });

    const j = await r.json();
    const text = j?.result?.content?.[0]?.text;
    if (typeof text !== "string") {
      return NextResponse.json({ error: j?.error?.message || "no result from 0G MCP" }, { status: 502 });
    }
    return NextResponse.json(JSON.parse(text));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
