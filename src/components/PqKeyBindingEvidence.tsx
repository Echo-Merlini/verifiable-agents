"use client";

import { useState, type ReactNode } from "react";
import { sha256 } from "viem";
import { Check as CheckIcon, X as XIcon, Loader2, KeyRound, ExternalLink } from "lucide-react";

// Verify a post-quantum key-binding — in the browser, from raw bytes. The binding is self-verifying:
// you RE-DERIVE its content-address (canonical_content = JCS(statement); sha256), and, for a NIP-01
// carrier, the event_id; then check the PQ companion signature (ML-DSA / SLH-DSA) over it. The
// endpoint that serves it is discovery only — nothing here trusts it.
//
// Default target is the shared-profile live binding; point NEXT_PUBLIC_PQ_BINDING_URL at ours once the
// KYA-L4 binding is deployed. Conforms to recompute-kit conformance/pq-key-binding-v0.

// The real binding (for the "view it" link). The fetch goes through our same-origin proxy
// (/api/pq-binding) because the .well-known endpoint sends no CORS header — the recompute still
// happens client-side, so the proxy only moves bytes, it isn't trusted.
const BINDING_URL = process.env.NEXT_PUBLIC_PQ_BINDING_URL
  || "https://api.babyblueviper.com/.well-known/pq-key-binding.json";
const FETCH_URL = "/api/pq-binding";

const enc = (s: string) => new TextEncoder().encode(s);
const hx = (h: string) => { const s = h.replace(/^0x/, ""); const u = new Uint8Array(s.length / 2); for (let i = 0; i < u.length; i++) u[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16); return u; };
const sha256hex = (s: string) => sha256(enc(s)).slice(2);

// receiptos-c14n / JCS: recursive sorted-key, compact, non-ASCII literal.
function jcs(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(jcs).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ":" + jcs((v as Record<string, unknown>)[k])).join(",") + "}";
  return JSON.stringify(v);
}
// NIP-01 array is positional (not key-sorted).
const compact = (arr: unknown[]): string => "[" + arr.map((x) => (typeof x === "string" ? JSON.stringify(x) : Array.isArray(x) ? compact(x) : String(x))).join(",") + "]";

type Row = { label: string; ok: boolean | null; detail?: string };
type Props = { fetchUrl?: string; viewUrl?: string; title?: string; subtitle?: React.ReactNode };

export function PqKeyBindingEvidence({
  fetchUrl = FETCH_URL,
  viewUrl = BINDING_URL,
  title = "Post-quantum key-binding",
  subtitle,
}: Props = {}) {
  const [state, setState] = useState<"idle" | "running" | "ok" | "bad" | "err">("idle");
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<{ alg?: string; classical?: string; anchor?: string } | null>(null);
  const [err, setErr] = useState("");

  async function run() {
    setState("running"); setErr(""); setRows([]); setMeta(null);
    try {
      const d = await fetch(FETCH_URL, { signal: AbortSignal.timeout(15000) }).then((r) => r.json());
      if (d?.error) throw new Error(`binding fetch failed (${d.error})`);
      const st = d.statement;
      const alg: string = st.algorithm;
      const ev = d.schnorr_event; // NIP-01 carrier (optional)

      // 1) recompute the content-address from the statement (not the served content field)
      const content = jcs(st);
      const ccGot = sha256hex(content);
      const ccOk = ccGot === d.canonical_content_sha256;

      // 2) NIP-01 carrier event_id (when present)
      let idOk: boolean | null = null; let msgHex: string;
      if (ev) {
        const ser = compact([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, content]);
        const idGot = sha256hex(ser);
        idOk = idGot === ev.id;
        msgHex = ev.id; // the PQ companion signs the 32-byte event_id
      } else {
        msgHex = ccGot; // on-chain-anchored binding: PQ signs the content-address
      }

      // 3) PQ companion signature — verified in-browser (no precompile)
      const sigHex: string = d.pq_companion_signature?.signature_hex || d.pq_companion_signature?.signature || "";
      // @noble/post-quantum 0.4.x API: verify(publicKey, message, signature)
      let verifier: { verify: (pk: Uint8Array, msg: Uint8Array, sig: Uint8Array) => boolean };
      if (alg.startsWith("ML-DSA-65")) verifier = (await import("@noble/post-quantum/ml-dsa.js")).ml_dsa65;
      else if (alg.startsWith("SLH-DSA-SHA2-192s")) verifier = (await import("@noble/post-quantum/slh-dsa.js")).slh_dsa_sha2_192s;
      else throw new Error(`unsupported algorithm: ${alg}`);

      const sig = hx(sigHex), msg = hx(msgHex), pk = hx(st.pq_pubkey);
      const pqOk = verifier.verify(pk, msg, sig);
      // 4) tamper: flip one bit of the PQ signature — must reject
      const bad = Uint8Array.from(sig); bad[0] ^= 1;
      const pqTamperRejected = !verifier.verify(pk, msg, bad);

      const anchor = d.ots_anchor ? `OTS → Bitcoin (${d.ots_anchor.status || "?"})` : (d.onchain_anchor ? "OCP on-chain" : "—");
      setMeta({ alg, classical: st.secp256k1_pubkey, anchor });
      const r: Row[] = [
        { label: "content-address recomputed (JCS statement → sha256)", ok: ccOk, detail: ccGot.slice(0, 16) + "…" },
        ...(ev ? [{ label: "carrier event_id recomputed (NIP-01)", ok: idOk, detail: (ev.id as string).slice(0, 16) + "…" }] : []),
        { label: `${alg} companion signature verified`, ok: pqOk },
        { label: "tampered signature rejected", ok: pqTamperRejected },
      ];
      setRows(r);
      setState(ccOk && idOk !== false && pqOk && pqTamperRejected ? "ok" : "bad");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "verify failed"); setState("err");
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-brassLight/25 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-display font-medium text-paper"><KeyRound className="h-4 w-4 text-brassLight" /> {title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-gb-muted">
            {subtitle || <>A binding that says <span className="text-paper/70">this classical key → this post-quantum key</span>, dual-signed and anchored. You don&apos;t trust the server that hosts it — you <span className="text-paper/70">re-derive its identity from raw bytes</span> and check the PQ signature, here, in your browser.</>}
          </p>
        </div>
        <button onClick={run} disabled={state === "running"}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-brass/40 bg-brass/10 px-3 py-1.5 text-[12px] font-display font-medium text-brassLight hover:bg-brass/20 disabled:opacity-50">
          {state === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} {state === "running" ? "Recomputing…" : "Recompute"}
        </button>
      </div>

      {meta && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-gb-faint">
          <span>algorithm <span className="text-brassLight/90">{meta.alg}</span></span>
          <span>classical <span className="text-gb-muted">{meta.classical?.slice(0, 10)}…</span></span>
          <span>anchor <span className="text-gb-muted">{meta.anchor}</span></span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <p key={r.label} className="flex items-center gap-2 text-[12px]">
              {r.ok === true ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : r.ok === false ? <XIcon className="h-3.5 w-3.5 text-red-400" /> : <span className="h-3.5 w-3.5" />}
              <span className={r.ok === false ? "text-red-300" : "text-gb-muted"}>{r.label}</span>
              {r.detail && <span className="font-mono text-[10px] text-gb-faint">{r.detail}</span>}
            </p>
          ))}
          <p className="pt-1 text-[11px] text-gb-faint">
            Hash-recompute + the {meta?.alg} signature run in your browser. The classical (Schnorr/EIP-712) signature and the anchor read are the deeper lane. The manifest is discovery only.
          </p>
        </div>
      )}
      {state === "err" && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-red-400"><XIcon className="h-3.5 w-3.5" />{err}</p>}
      {state === "ok" && <p className="mt-2 text-[12px] text-emerald-300">Recomputed + verified — the binding is what it claims, no trust in the endpoint.</p>}
      <a href={BINDING_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] text-brassLight/70 hover:text-brassLight">the binding <ExternalLink className="h-3 w-3" /></a>
    </div>
  );
}
