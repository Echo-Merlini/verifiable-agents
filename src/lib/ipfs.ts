// Agent metadata and art live on IPFS. Every call site used to point at https://ipfs.io,
// which rate-limits per origin: once it starts answering 429 — or serves a Cloudflare block
// page carrying no Access-Control-Allow-Origin at all — every agent name and image on the
// page fails at once, and the browser reports it as a CORS error rather than as the quota
// error it actually is. That is what broke /marketplace.
//
// Our own Pinata dedicated gateway serves everything WE pinned, with
// `Access-Control-Allow-Origin: *`, and its quota is not shared with the whole internet.
// It answers 403 for a CID we never pinned, so it cannot be the only hop: an agent whose
// metadata was pinned elsewhere still needs a public gateway. Hence ours first, public
// gateways as fallback.
//
// Deliberately NOT an /api proxy route: `OUTPUT_STATIC=1` builds this app to a static
// bundle that is itself pinned and served from an IPFS gateway, where /api/* does not
// exist — and `output: "export"` cannot build a route handler in the first place.

const PINATA = "https://sapphire-naval-quelea-174.mypinata.cloud/ipfs";

/**
 * Ours first — it holds nearly every agent we minted and never throttles us. Then Pinata's
 * PUBLIC gateway, which serves any CID (not just our pins) on a quota independent of
 * Protocol Labs'. ipfs.io and dweb.link share one origin-rate-limit pool and will both be
 * 429 at the same moment, so neither is a real fallback for the other — they are last.
 */
export const IPFS_GATEWAYS = [
  PINATA,
  "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
  "https://dweb.link/ipfs",
  "https://w3s.link/ipfs",
] as const;

/** `ipfs://CID[/path]` → an https URL on our own gateway. Non-IPFS URIs pass through. */
export function ipfsHttp(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return `${PINATA}/${uri.slice(7)}`;
  if (uri.startsWith("ar://")) return `https://arweave.net/${uri.slice(5)}`;
  return uri;
}

/** Every URL worth trying for a URI, ours first. A non-IPFS URI yields just itself. */
export function ipfsCandidates(uri: string): string[] {
  if (!uri) return [];
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice(7);
    return IPFS_GATEWAYS.map((g) => `${g}/${path}`);
  }
  return [ipfsHttp(uri)];
}

/**
 * fetch() that walks the gateway list until one answers.
 *
 * A non-ok response is a reason to try the next gateway, not to give up: 403 means "not
 * pinned here" (ours, for a foreign CID) and 429 means "throttled" (a public one). Only
 * when every gateway has failed does this throw.
 */
export async function fetchIpfs(uri: string, timeoutMs = 6000): Promise<Response> {
  let last: unknown;
  for (const url of ipfsCandidates(uri)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return res;
      last = new Error(`${res.status} from ${url}`);
    } catch (e) {
      last = e;
    }
  }
  throw last ?? new Error(`no IPFS gateway served ${uri}`);
}
