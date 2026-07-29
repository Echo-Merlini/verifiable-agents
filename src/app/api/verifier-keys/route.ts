// Same-origin proxy for invinoveritas' verifier-key rotation/revocation manifest.
// The manifest (api.babyblueviper.com/.well-known/verifier-keys.json) sends no CORS header, so the browser
// can't fetch it cross-origin. This thin server-side relay lets the /review panel recompute the key-freshness
// lane in-browser without trusting anything: the client still checks the window + revocation itself; we only
// move the bytes. Falls back gracefully (the panel degrades to a "verify at the manifest URL" note) if this
// route is absent (e.g. a static export).
export const dynamic = "force-dynamic";

const MANIFEST = "https://api.babyblueviper.com/.well-known/verifier-keys.json";

export async function GET() {
  try {
    const r = await fetch(MANIFEST, { cache: "no-store" });
    if (!r.ok) return Response.json({ error: `upstream ${r.status}` }, { status: 502 });
    const body = await r.json();
    return Response.json(body, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
