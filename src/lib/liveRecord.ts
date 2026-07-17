import { keccak256, toHex, type Hex } from "viem";
import type { Showcase } from "./verify";

const GW = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
// The gateway anchors live per-action records via ERC-8281 record() on Base Sepolia.
const BASE_OCP = (process.env.NEXT_PUBLIC_L3_BASE_OCP || "0x0963Fd33DF80c94360F2DC22e5c09517AeE7ED5c") as `0x${string}`;
const BASE_SEPOLIA_ID = 84532;
export const LIVE_STASH_KEY = "va-live-record";

export type LiveAgent = { ens: string; agentId: string; registry: string; attestor?: string };

/** Build a full 5-check recompute record for an action that just happened. The client
 *  already holds the preimages (the message it sent + the reply it got); we only fetch
 *  the committed hashes + anchor tx + signature by input-hash. No server-side preimage
 *  storage — the plaintext never left the browser. Returns null if not attested yet. */
export async function buildLiveRecord(agent: LiveAgent, query: string, reply: string): Promise<Showcase | null> {
  const rawInputHash = keccak256(toHex(query)) as Hex;
  try {
    const r = await fetch(`${GW}/agent/verify/${rawInputHash}`);
    if (!r.ok) return null; // not logged yet — caller can retry shortly
    const a = await r.json();
    if (!a?.l4_signature) return null;

    let attestor = agent.attestor;
    if (!attestor) {
      const card = await fetch(`${GW}/.well-known/agent/${agent.registry}/${agent.agentId}.json`)
        .then((x) => (x.ok ? x.json() : null)).catch(() => null);
      attestor = card?.pricing?.attestor ?? undefined;
    }
    if (!attestor) return null;

    return {
      ens: agent.ens,
      agentId: agent.agentId,
      registry: agent.registry as `0x${string}`,
      query,
      reply,
      rawInputHash: (a.raw_input_hash ?? rawInputHash) as Hex,
      sanitizationPipelineHash: a.sanitization_pipeline_hash as Hex,
      inputHash: (a.input_hash ?? rawInputHash) as Hex,
      outputHash: a.output_hash as Hex,
      manifestHash: a.manifest_hash as Hex,
      timestamp: Number(a.l4_timestamp ?? a.created_at ?? Math.floor(Date.now() / 1000)),
      l4Signature: a.l4_signature as Hex,
      attestor: attestor as `0x${string}`,
      l3Tx: (a.l3_tx ?? undefined) as Hex | undefined, // may be pending → /verify ambers, retry
      ocpContract: BASE_OCP,
      l3ChainId: BASE_SEPOLIA_ID,
      live: true,
    };
  } catch {
    return null;
  }
}

export function stashLiveRecord(rec: Showcase) {
  try { sessionStorage.setItem(LIVE_STASH_KEY, JSON.stringify(rec)); } catch {}
}
export function readLiveRecord(): Showcase | null {
  try { const s = sessionStorage.getItem(LIVE_STASH_KEY); return s ? (JSON.parse(s) as Showcase) : null; }
  catch { return null; }
}
