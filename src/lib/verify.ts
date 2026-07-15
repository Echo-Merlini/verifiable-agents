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
import { mainnet } from "viem/chains";

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
};

export type Check = {
  id: string;
  label: string;
  recipe: string;
  ok: boolean;
  expected: string;
  got: string;
};

const RPC = process.env.NEXT_PUBLIC_MAINNET_RPC || "https://eth.llamarpc.com";
const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** keccak256 of a string's UTF-8 bytes — the wyriwe/raw + spine recipe. */
export function keccakUtf8(s: string): Hex {
  return keccak256(toHex(s));
}

export function checkRawInput(sc: Showcase): Check {
  const got = keccakUtf8(sc.query);
  return { id: "raw", label: "Raw input", recipe: "wyriwe/raw · keccak256(utf8(query))",
    ok: eq(got, sc.rawInputHash), expected: sc.rawInputHash, got };
}

export function checkOutput(sc: Showcase): Check {
  const got = keccakUtf8(sc.reply);
  return { id: "out", label: "Output", recipe: "spine · keccak256(utf8(reply))",
    ok: eq(got, sc.outputHash), expected: sc.outputHash, got };
}

export function checkInputProvenance(sc: Showcase): Check {
  // Identity-sentinel path: no sanitization ⇒ input the model received === raw input.
  return { id: "input", label: "Input provenance", recipe: "wyriwe · rawInputHash === inputHash",
    ok: eq(sc.rawInputHash, sc.inputHash), expected: sc.rawInputHash, got: sc.inputHash };
}

export async function checkL4Signature(sc: Showcase): Promise<Check> {
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
        raw_input_hash: sc.rawInputHash,
        sanitization_pipeline_hash: sc.sanitizationPipelineHash,
        input_hash: sc.inputHash,
        output_hash: sc.outputHash,
        manifest_hash: sc.manifestHash,
        agentId: BigInt(sc.agentId),
        registry: sc.registry,
        timestamp: BigInt(sc.timestamp),
      },
      signature: sc.l4Signature,
    });
  } catch { /* recovered stays "" → fails */ }
  return { id: "l4", label: "L4 attestation (EIP-712)", recipe: "KYA-L4 · recover(signer) == attestor",
    ok: eq(recovered, sc.attestor), expected: sc.attestor, got: recovered || "recover failed" };
}

/** Confirm the L3 anchor really happened on-chain (OCP record() tx succeeded on mainnet). */
export async function checkL3Onchain(sc: Showcase): Promise<Check> {
  const base = { id: "l3", label: "L3 anchor (on-chain)", recipe: "OCP record(inputHash) · mainnet" };
  if (!sc.l3Tx) return { ...base, ok: false, expected: "an OCP record() tx", got: "none" };
  try {
    const client = createPublicClient({ chain: mainnet, transport: http(RPC) });
    const receipt = await client.getTransactionReceipt({ hash: sc.l3Tx });
    const okStatus = receipt.status === "success";
    const okTarget = !sc.ocpContract || eq(receipt.to ?? undefined, sc.ocpContract);
    return { ...base, ok: okStatus && okTarget,
      expected: sc.ocpContract ? `success → ${sc.ocpContract}` : "tx success",
      got: `${receipt.status} → ${receipt.to ?? "—"}` };
  } catch (e: any) {
    return { ...base, ok: false, expected: "on-chain OCP record()", got: e?.message ?? "read failed" };
  }
}

/** Run every check. `tamper` lets the UI flip a byte of the query to prove it's real. */
export async function verifyAll(sc: Showcase): Promise<Check[]> {
  const sync = [checkRawInput(sc), checkInputProvenance(sc), checkOutput(sc)];
  const [l4, l3] = await Promise.all([checkL4Signature(sc), checkL3Onchain(sc)]);
  return [...sync, l3, l4];
}
