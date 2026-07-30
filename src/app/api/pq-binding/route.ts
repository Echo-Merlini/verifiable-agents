// Same-origin proxy for a post-quantum key-binding artifact.
// The binding (e.g. api.babyblueviper.com/.well-known/pq-key-binding.json) sends no CORS header, so the
// browser can't fetch it cross-origin. This thin server-side relay lets the /verify PQ panel recompute
// the binding in-browser without trusting anything: the client still re-derives the content-address and
// verifies the PQ companion signature itself; we only move the bytes. A malicious relay can't forge a
// binding that recomputes + verifies, so this is transport, not a trust point.
export const dynamic = "force-dynamic";

const BINDING = process.env.PQ_BINDING_URL || "https://api.babyblueviper.com/.well-known/pq-key-binding.json";

export async function GET() {
  try {
    const r = await fetch(BINDING, { cache: "no-store", headers: { accept: "application/json" } });
    if (!r.ok) return Response.json({ error: `upstream ${r.status}` }, { status: 502 });
    const body = await r.json();
    return Response.json(body, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
