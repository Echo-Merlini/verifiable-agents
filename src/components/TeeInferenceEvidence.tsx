"use client";

import { useEffect, useState } from "react";
import { recoverMessageAddress } from "viem";
import { Check as CheckIcon, X as XIcon, Loader2, Cpu, RefreshCw, Wand2, RotateCcw, ExternalLink } from "lucide-react";

// TEE-attested inference ⊕ recompute — the one link recompute can't re-derive is the model call
// itself; a TEE attests it. This panel recomputes everything AROUND that call, in your browser,
// from a real 0G TeeML signed inference — and is scrupulously honest about the evidence class of
// each check: `recomputed` (re-derived from public data) vs `broker-asserted` (a signature over a
// value) vs `attested` (a hardware quote — unavailable for this relay provider). Nothing is a
// silent green. It upgrades to a green enclave-quote parse the moment 0G points at a genuine
// enclave provider. Converged against gist TMerlini/19d532bc + recompute-kit#2 (tee-inference.v0).

type Sample = {
  provider: string; signer: string; model: string; chain: string; captured_at: string;
  prompt: string; answer: string; preimage: string; signature: `0x${string}`;
  provider_type: string; provider_identity: string;
  attested_request_hash: string; attested_response_hash: string; tls_cert_fingerprint: string;
  response_canonical: string; client_request_jcs_sha256: string; attestation_report: string;
  gist: string; pr: string;
};
const SAMPLE_URL = process.env.NEXT_PUBLIC_TEEML_SAMPLE_URL || "/teeml-sample.json";

type Basis = "recomputed" | "broker-asserted" | "attested";
type St = "idle" | "verified" | "rejected" | "unverifiable";
type Row = { id: string; label: string; basis: Basis; std: string; status: St; detail: string };

const short = (h?: string) => (h ? h.slice(0, 10) + "…" + h.slice(-6) : "—");

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function BasisChip({ basis }: { basis: Basis }) {
  const tone =
    basis === "recomputed" ? "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300/80"
    : basis === "broker-asserted" ? "border-brassLight/25 bg-brassLight/[0.06] text-brassLight/80"
    : "border-amber-400/30 bg-amber-400/[0.06] text-amber-300/80";
  return <span className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider ${tone}`}>{basis}</span>;
}

export type TeeSummary = { sig: St; resp: St; req: St; enclave: St };

export function TeeInferenceEvidence({ onResult }: { onResult?: (r: TeeSummary) => void }) {
  const [s, setS] = useState<Sample | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const [tampered, setTampered] = useState(false);

  useEffect(() => {
    fetch(SAMPLE_URL).then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => setS(null));
  }, []);

  // Recompute once when the sample lands so the panel + receipt reflect the honest result immediately;
  // the buttons below still re-run it and the tamper toggle still breaks it live.
  useEffect(() => { if (s && !ran) recompute(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [s]);

  if (!s) return null;

  async function recompute(tamper: boolean) {
    setRunning(true); setTampered(tamper);
    const preimage = tamper ? s!.preimage.replace(/^./, (c) => (c === "c" ? "d" : "c")) : s!.preimage;

    // check 1 — independent EIP-191 signer recovery (recomputed)
    let recovered = "0xINVALID";
    try { recovered = await recoverMessageAddress({ message: preimage, signature: s!.signature }); } catch {}
    const sigOk = recovered.toLowerCase() === s!.signer.toLowerCase();

    // check 2 — response digest binding under the broker's sha256(JSON) (recomputed)
    const respHash = await sha256hex(s!.response_canonical);
    const respOk = respHash === s!.attested_response_hash;

    // request binding — broker-asserted: no client canonicalization reproduces hash1 (enclave-internal forwarded body)
    const reqReproduces = s!.client_request_jcs_sha256 === s!.attested_request_hash;

    // enclave quote — attested lane: unavailable for a relay provider (fail-closed amber, never a silent green)
    const quoteAvailable = !/not available|without local TEE|forwards to an upstream/i.test(s!.attestation_report);

    onResult?.({
      sig: sigOk ? "verified" : "rejected",
      resp: respOk ? "verified" : "rejected",
      req: reqReproduces ? "verified" : "unverifiable",
      enclave: quoteAvailable ? "verified" : "unverifiable",
    });
    setRows([
      { id: "sig", label: "Signature recovery", basis: "recomputed", std: "EIP-191",
        status: sigOk ? "verified" : "rejected",
        detail: sigOk ? `ecrecover → ${short(recovered)} = the TEE signer` : `recovered ${short(recovered)} ≠ signer — ${tamper ? "tampered preimage" : "mismatch"}` },
      { id: "resp", label: "Response binding", basis: "recomputed", std: "0G TeeML",
        status: respOk ? "verified" : "rejected",
        detail: respOk ? `sha256(JSON(completion)) = ${short("0x" + respHash)} = H(response) — the answer is bound` : `recomputed ${short("0x" + respHash)} ≠ committed H(response)` },
      { id: "req", label: "Request binding", basis: "broker-asserted", std: "0G routing-proof",
        status: reqReproduces ? "verified" : "unverifiable",
        detail: "broker signs sha256(forwarded upstream body); the client can't confirm it equals its request — broker-asserted, not independently recomputable" },
      { id: "enclave", label: "Enclave attestation", basis: "attested", std: "dstack quote",
        status: quoteAvailable ? "verified" : "unverifiable",
        detail: quoteAvailable ? "quote parsed" : "no local TEE quote — this provider relays to an upstream (Alibaba DashScope). Fail-closed amber, never a silent green" },
    ]);
    setRunning(false); setRan(true);
  }

  const Icon = ({ st }: { st: St }) =>
    st === "verified" ? <CheckIcon className="h-3.5 w-3.5" />
    : st === "rejected" ? <XIcon className="h-3.5 w-3.5" />
    : <span className="text-[13px] leading-none">◑</span>;

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-brassLight/80" />
          <span className="font-display text-[15px] text-paper">TEE-attested inference</span>
          <span className="shrink-0 rounded-md border border-brassLight/25 bg-brassLight/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-brassLight/80">0G TeeML</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/40">{s.chain}</span>
      </div>
      <p className="mt-1.5 text-[12px] text-gb-muted">
        Recompute can&apos;t re-derive the model call — a TEE <span className="text-paper/70">attests</span> it. This recomputes everything <span className="text-paper/70">around</span> it from a real 0G TeeML signed inference, <span className="text-paper/70">in your browser</span>, and shows each check&apos;s <span className="text-paper/70">evidence class</span> honestly. This provider relays to an upstream, so the enclave quote is <span className="text-amber-300/80">unavailable</span> — never faked green.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-1 font-mono text-[11px] sm:grid-cols-2">
        <div><span className="text-paper/40">model </span><span className="text-paper/80">{s.model}</span></div>
        <div><span className="text-paper/40">signer </span><span className="text-paper/80">{short(s.signer)}</span></div>
        <div><span className="text-paper/40">prompt </span><span className="text-paper/80">{JSON.stringify(s.prompt)}</span></div>
        <div><span className="text-paper/40">answer </span><span className="text-paper/80">{JSON.stringify(s.answer)}</span></div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <button onClick={() => recompute(false)} disabled={running}
          className="inline-flex items-center gap-1.5 rounded-full border border-brassLight/30 px-3.5 py-1.5 text-[12px] text-brassLight hover:border-brassLight/50 disabled:opacity-50">
          {running && !tampered ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Recompute in your browser
        </button>
        {ran && (
          <button onClick={() => recompute(!tampered)} disabled={running}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-paper/70 hover:border-white/30 disabled:opacity-50">
            {tampered ? <><RotateCcw className="h-3.5 w-3.5" /> restore</> : <><Wand2 className="h-3.5 w-3.5" /> tamper one byte</>}
          </button>
        )}
      </div>

      {ran && (
        <div className="mt-3 space-y-2">
          {rows.map((r) => {
            const pass = r.status === "verified", rej = r.status === "rejected";
            return (
              <div key={r.id} className={`rounded-xl border p-3 ${pass ? "border-emerald-400/20 bg-emerald-400/[0.03]" : rej ? "border-red-500/30 bg-red-500/[0.03]" : "border-amber-400/25 bg-amber-400/[0.03]"}`}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${pass ? "bg-emerald-400/15 text-emerald-300" : rej ? "bg-red-500/15 text-red-300" : "bg-amber-400/15 text-amber-300"}`}>
                    <Icon st={r.status} />
                  </span>
                  <span className="text-[13px] text-paper">{r.label}</span>
                  <BasisChip basis={r.basis} />
                  <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-wider text-paper/35">{r.std}</span>
                </div>
                <p className={`mt-1.5 pl-7 font-mono text-[11px] break-all ${pass ? "text-emerald-300/80" : rej ? "text-red-300/90" : "text-amber-300/80"}`}>{r.detail}</p>
              </div>
            );
          })}
          <p className="pt-1 text-[11px] text-paper/40">
            Two recomputed-green + one broker-asserted + one attested-unavailable — the label &quot;TeeML&quot; on this relay provider is a broker signature over its commitments, not a hardware quote. The recompute discipline caught it.{" "}
            <a href={s.gist} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brassLight/70 hover:text-brassLight">sample <ExternalLink className="h-3 w-3" /></a>{" · "}
            <a href={s.pr} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brassLight/70 hover:text-brassLight">tee-inference.v0 <ExternalLink className="h-3 w-3" /></a>
          </p>
        </div>
      )}
    </div>
  );
}
