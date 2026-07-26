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
    const r = await fetch(`${GW}/agent/verify/${rawInputHash}`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null; // not logged yet — caller can retry shortly
    const a = await r.json();
    if (!a?.l4_signature) return null;

    let attestor = agent.attestor;
    if (!attestor) {
      const card = await fetch(`${GW}/.well-known/agent/${agent.registry}/${agent.agentId}.json`, { signal: AbortSignal.timeout(12000) })
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
      // Multi-surface: the gateway stores each chat action's recompute manifest on 0G Storage
      // and anchors it a SECOND time on 0G Chain (best-effort, async — so these may lag the L4
      // sign by a few seconds; the panels simply appear once present).
      zerog: a.zerog_root
        ? { network: "0G Galileo Storage", root: a.zerog_root as string, tx: (a.zerog_tx ?? "") as string, bytes: Number(a.zerog_bytes ?? 0), artifact: "" }
        : undefined,
      zerogChain: a.zerog_chain_tx
        ? { network: "0G Galileo Testnet", chainId: 16602, rpc: "https://evmrpc-testnet.0g.ai", explorer: "https://chainscan-galileo.0g.ai", contract: "0x29A45029DE2439925f2525E01Be6b6631fC9DD85", tx: a.zerog_chain_tx as string, block: 0 }
        : undefined,
      live: true,
    };
  } catch {
    return null;
  }
}

/** Re-fetch an already-stashed live action and merge in fields that arrived AFTER the initial
 *  stash. The 0G Storage root, the 0G Chain anchor tx, and (sometimes) the L3 anchor tx are all
 *  written best-effort/async ~10–15s after the reply, so a record stashed the instant the reply
 *  landed usually misses them — and the 0G panels then never show for that action. Polling this
 *  fills them once present. Preserves the preimages/edits; returns the merged record (re-stashed),
 *  or the original on error / when nothing new arrived. */
export async function refreshLiveRecord(rec: Showcase): Promise<Showcase> {
  try {
    const key = keccak256(toHex(rec.query)) as Hex;
    const r = await fetch(`${GW}/agent/verify/${key}`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return rec;
    const a = await r.json();
    const merged: Showcase = {
      ...rec,
      l3Tx: (rec.l3Tx ?? a.l3_tx ?? undefined) as Hex | undefined,
      zerog: rec.zerog ?? (a.zerog_root
        ? { network: "0G Galileo Storage", root: a.zerog_root as string, tx: (a.zerog_tx ?? "") as string, bytes: Number(a.zerog_bytes ?? 0), artifact: "" }
        : undefined),
      zerogChain: rec.zerogChain ?? (a.zerog_chain_tx
        ? { network: "0G Galileo Testnet", chainId: 16602, rpc: "https://evmrpc-testnet.0g.ai", explorer: "https://chainscan-galileo.0g.ai", contract: "0x29A45029DE2439925f2525E01Be6b6631fC9DD85", tx: a.zerog_chain_tx as string, block: 0 }
        : undefined),
    };
    if (merged.l3Tx !== rec.l3Tx || merged.zerog !== rec.zerog || merged.zerogChain !== rec.zerogChain) stashLiveRecord(merged);
    return merged;
  } catch { return rec; }
}

export function stashLiveRecord(rec: Showcase) {
  try { sessionStorage.setItem(LIVE_STASH_KEY, JSON.stringify(rec)); } catch {}
}
export function readLiveRecord(): Showcase | null {
  try { const s = sessionStorage.getItem(LIVE_STASH_KEY); return s ? (JSON.parse(s) as Showcase) : null; }
  catch { return null; }
}
