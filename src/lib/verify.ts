/**
 * Verifiable Agents — in-browser recompute.
 *
 * Every check here runs in the visitor's own browser against public data:
 * keccak256 preimages, an on-chain read, and an EIP-712 signer recovery. Nothing
 * is trusted — it is re-derived. "Don't trust. Recompute."
 *
 * Field → recipe map (matches the gateway's attestation spec + recompute-kit):
 *   raw_input_hash             = keccak256(utf8(query))   · wyriwe/raw
 *   output_hash                = keccak256(utf8(reply))   · spine
 *   input_hash                 = raw_input_hash            · wyriwe (identity sentinel)
 *   l3 (on-chain)              = OCP record(inputHash)     · 8263/precedence
 *   l4 (EIP-712 "KYA-L4")      = recover(signer)==attestor · 8275/reputation
 */
import {
  keccak256,
  toHex,
  recoverTypedDataAddress,
  createPublicClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { mainnet, baseSepolia } from "viem/chains";

/** The public showcase record served by the gateway (`GET /attestations/showcase`). */
export type Showcase = {
  ens: string;               // e.g. "dinamic.eth"
  agentId: string;           // uint256 as decimal string
  registry: Address;         // ERC-8004 registry (EIP-712 verifyingContract)
  query: string;             // PUBLIC preimage — hashes to raw_input_hash
  reply: string;             // PUBLIC preimage — hashes to output_hash
  rawInputHash: Hex;
  sanitizationPipelineHash: Hex;
  inputHash: Hex;
  outputHash: Hex;
  manifestHash: Hex;
  timestamp: number;         // uint64 seconds
  l4Signature: Hex;          // EIP-712 KYA-L4 signature
  attestor: Address;         // expected signer (gateway attestor)
  l3Tx?: Hex;                // OCP record() tx hash
  ocpContract?: Address;     // ERC-8281 OCP anchor contract
  l3ChainId?: number;        // chain the anchor lives on (1 = mainnet showcase · 84532 = Base Sepolia live actions)
  live?: boolean;            // true = recomputing a just-happened action, not the baked showcase
};

// A check has three honest outcomes — never conflate the last two:
//   pass          = recomputed and matched
//   fail          = recomputed and did NOT match (a real mismatch)
//   unverifiable  = could not recompute (network/RPC) — NOT a failure, retryable
export type CheckStatus = "pass" | "fail" | "unverifiable";
export type Check = {
  id: string;
  label: string;
  recipe: string;
  status: CheckStatus;
  expected: string;
  got: string;
};

// The showcase OCP record() anchor is on mainnet (TruthAnchor · 0x1e2A118a). Several
// RPCs so one dead provider ambers, not fails. Env override wins.
const L3_RPCS: string[] = [
  process.env.NEXT_PUBLIC_L3_RPC,
  "https://ethereum-rpc.publicnode.com",
  "https://cloudflare-eth.com",
  "https://eth.drpc.org",
  "https://eth.llamarpc.com",
].filter((x): x is string => !!x);
// Live per-action anchors are written to Base Sepolia; the baked showcase is mainnet.
const BASE_SEPOLIA_RPCS: string[] = [
  process.env.NEXT_PUBLIC_L3_BASE_RPC,
  "https://sepolia.base.org",
  "https://base-sepolia-rpc.publicnode.com",
  "https://base-sepolia.drpc.org",
].filter((x): x is string => !!x);
const l3Chain = (id?: number) => (id === baseSepolia.id ? baseSepolia : mainnet);
const l3Rpcs  = (id?: number) => (id === baseSepolia.id ? BASE_SEPOLIA_RPCS : L3_RPCS);
const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const pf = (b: boolean): CheckStatus => (b ? "pass" : "fail");

// ERC-8281's canonical read is the event, not calldata — "the log is the ledger".
// Recorded(bytes32 indexed digest, address indexed committer) → digest is topic1.
const RECORDED_TOPIC = keccak256(toHex("Recorded(bytes32,address)"));

// Mirror the gateway's toBytes32(): a null/absent hash was signed as zero-bytes32, and a
// short one left-padded — so we must recover over the SAME normalized values, or a
// live action with no sanitization/manifest hash throws instead of recovering.
const toBytes32 = (h?: string | null): Hex => {
  if (!h) return ("0x" + "00".repeat(32)) as Hex;
  const clean = h.startsWith("0x") ? h.slice(2) : h;
  return ("0x" + clean.padStart(64, "0")) as Hex;
};

/** keccak256 of a string's UTF-8 bytes — the wyriwe/raw + spine recipe. */
export function keccakUtf8(s: string): Hex {
  return keccak256(toHex(s));
}

export function checkRawInput(sc: Showcase): Check {
  const got = keccakUtf8(sc.query);
  return { id: "raw", label: "Raw input", recipe: "wyriwe/raw · keccak256(utf8(query))",
    status: pf(eq(got, sc.rawInputHash)), expected: sc.rawInputHash, got };
}

export function checkOutput(sc: Showcase): Check {
  const got = keccakUtf8(sc.reply);
  return { id: "out", label: "Output", recipe: "spine · keccak256(utf8(reply))",
    status: pf(eq(got, sc.outputHash)), expected: sc.outputHash, got };
}

export function checkInputProvenance(sc: Showcase): Check {
  // Identity-sentinel path: no sanitization ⇒ the input the model received IS the raw
  // input, so it must be keccak256(utf8(query)). Recomputed from the query, so a tamper
  // cascades into this link too (not just the raw-input check).
  const got = keccakUtf8(sc.query);
  return { id: "input", label: "Input provenance", recipe: "wyriwe · keccak256(utf8(query)) === inputHash",
    status: pf(eq(got, sc.inputHash)), expected: sc.inputHash, got };
}

export async function checkL4Signature(sc: Showcase): Promise<Check> {
  // Recover from a message whose raw_input_hash is RE-DERIVED from the (maybe edited)
  // query — so a tamper changes the signed digest and the recovered signer drifts off
  // the attestor. Pristine query → recomputed hash == committed → recovers cleanly.
  const recomputedRaw = keccakUtf8(sc.query);
  let recovered = "";
  try {
    recovered = await recoverTypedDataAddress({
      domain: { name: "KYA-L4", version: "1", chainId: 1, verifyingContract: sc.registry },
      types: {
        InferenceAttestation: [
          { name: "raw_input_hash", type: "bytes32" },
          { name: "sanitization_pipeline_hash", type: "bytes32" },
          { name: "input_hash", type: "bytes32" },
          { name: "output_hash", type: "bytes32" },
          { name: "manifest_hash", type: "bytes32" },
          { name: "agentId", type: "uint256" },
          { name: "registry", type: "address" },
          { name: "timestamp", type: "uint64" },
        ],
      },
      primaryType: "InferenceAttestation",
      message: {
        raw_input_hash: toBytes32(recomputedRaw),
        sanitization_pipeline_hash: toBytes32(sc.sanitizationPipelineHash),
        input_hash: toBytes32(sc.inputHash),
        output_hash: toBytes32(sc.outputHash),
        manifest_hash: toBytes32(sc.manifestHash),
        agentId: BigInt(sc.agentId),
        registry: sc.registry,
        timestamp: BigInt(sc.timestamp),
      },
      signature: sc.l4Signature,
    });
  } catch { /* recovered stays "" → fails (this is local crypto, never a network amber) */ }
  return { id: "l4", label: "L4 attestation (EIP-712)", recipe: "KYA-L4 · recover(signer) == attestor",
    status: pf(eq(recovered, sc.attestor)), expected: sc.attestor, got: recovered || "recover failed" };
}

/** Confirm the L3 anchor on-chain: the OCP record() tx succeeded, hit the OCP contract,
 *  AND the digest it wrote equals the input hash recomputed from the (maybe edited) query.
 *  So a tamper breaks this link too. A digest mismatch / reverted tx is a FAIL; an
 *  unreachable chain is UNVERIFIABLE (amber) — "could not check" ≠ "did not match". */
export async function checkL3Onchain(sc: Showcase): Promise<Check> {
  const chainLabel = sc.l3ChainId === baseSepolia.id ? "Base Sepolia" : "mainnet";
  const base = { id: "l3", label: "L3 anchor (on-chain)", recipe: `8281 · Recorded event topic1 · ${chainLabel}` };
  if (!sc.l3Tx) return { ...base, status: "unverifiable" as const, expected: "an OCP record() tx",
    got: "anchor pending — the record() tx hasn't landed yet, retry in a moment" };
  const recomputed = keccakUtf8(sc.query);   // the digest the anchor SHOULD hold
  let lastErr = "";
  for (const rpc of l3Rpcs(sc.l3ChainId)) {
    try {
      const client = createPublicClient({ chain: l3Chain(sc.l3ChainId), transport: http(rpc) });
      const receipt = await client.getTransactionReceipt({ hash: sc.l3Tx });
      // A successful read is a definitive verdict — stop here (don't try more RPCs).
      if (receipt.status !== "success")
        return { ...base, status: "fail" as const, expected: "tx success", got: receipt.status };
      // 8281 canonical read: the digest is topic1 of the Recorded event emitted BY the
      // OCP contract — verified through the standard's own read path, not calldata.
      const log = receipt.logs.find((l) =>
        l.topics[0] === RECORDED_TOPIC && (!sc.ocpContract || eq(l.address, sc.ocpContract)));
      if (!log || !log.topics[1])
        return { ...base, status: "fail" as const, expected: `Recorded event from ${sc.ocpContract ?? "the OCP contract"}`, got: "no Recorded log in tx" };
      const anchored = log.topics[1] as Hex;
      return { ...base, status: pf(eq(anchored, recomputed)), expected: anchored, got: recomputed };
    } catch (e: any) {
      // Network error / tx not indexed on this provider → try the next RPC.
      lastErr = e?.shortMessage || e?.message || "read failed";
    }
  }
  // Every provider was unreachable — could not recompute. Amber, retryable, NOT a fail.
  return { ...base, status: "unverifiable" as const, expected: "on-chain OCP record()",
    got: `could not reach ${chainLabel} — RPC unavailable` + (lastErr ? ` (${lastErr})` : "") };
}

/** Run every check. `tamper` lets the UI flip a byte of the query to prove it's real. */
export async function verifyAll(sc: Showcase): Promise<Check[]> {
  const sync = [checkRawInput(sc), checkInputProvenance(sc), checkOutput(sc)];
  const [l4, l3] = await Promise.all([checkL4Signature(sc), checkL3Onchain(sc)]);
  return [...sync, l3, l4];
}
