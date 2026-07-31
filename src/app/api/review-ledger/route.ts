// Same-origin proxy for the reviewer's (invinoveritas) public verdict ledger.
// The /ledger endpoint sends no CORS header, so the browser can't fetch it cross-origin. This thin
// server-side relay lets the review-verdict panel confirm inclusion in-browser without trusting anything:
// the client re-derives the verdict's Nostr event id itself and matches it against the ledger entries —
// the proxy only moves the bytes. A malicious relay can't forge an entry whose event_id matches a verdict
// whose Schnorr signature the client independently verified, so this is transport, not a trust point.
export const dynamic = "force-dynamic";

const LEDGER = process.env.REVIEW_LEDGER_URL || "https://api.babyblueviper.com/ledger";

export async function GET() {
  try {
    const r = await fetch(LEDGER, { cache: "no-store", headers: { accept: "application/json" } });
    if (!r.ok) return Response.json({ error: `upstream ${r.status}` }, { status: 502 });
    const body = await r.json();
    return Response.json(body, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
