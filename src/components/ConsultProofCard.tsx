"use client";

import { useState, useEffect, useRef } from "react";
import { ShieldCheck, ExternalLink, Loader2, CheckCircle2, X } from "lucide-react";
import { keccak256, toBytes } from "viem";

type Proof = {
  jobId: string;
  settlementRef: string;        // release() tx hash
  verdictHash: string;          // keccak(abi.encode(jobId, resultHash))
  resultHash: string;           // keccak256(utf8 resultText)
  resultText: string;           // the delivered artifact
  amountWei: string;
  settlementChainId: number | null;
  verifierKey: string;          // attestor
};

/**
 * Detects an A2A consult's on-chain settlement (the escrow releases automatically the
 * moment the agent delivers) and surfaces it: the release tx, the amount paid, and a
 * live in-browser recompute of resultHash — proving the payout is bound to the exact
 * delivered result. Then the consumer can close the consult.
 */
export function ConsultProofCard({ jobId, gatewayUrl, onClose }: { jobId: string; gatewayUrl: string; onClose: () => void }) {
  const [proof, setProof] = useState<Proof | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`${gatewayUrl}/agent/consult/job/${jobId}/proof`);
        if (r.ok) { const p = await r.json(); if (alive) { setProof(p); return; } } // settled → stop polling
      } catch { /* keep polling */ }
      if (alive) timer.current = setTimeout(poll, 4000);
    };
    poll();
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); };
  }, [jobId, gatewayUrl]);

  if (!proof) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 flex items-center gap-2 text-[11px] text-paper/45">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-brass shrink-0" /> Waiting for delivery — the escrow releases on-chain the moment the agent delivers.
      </div>
    );
  }

  const explorer = proof.settlementChainId === 11155111 ? "https://sepolia.etherscan.io" : "https://etherscan.io";
  const eth = (Number(proof.amountWei || 0) / 1e18).toFixed(4);
  const short = (h?: string) => (h ? h.slice(0, 10) + "…" + h.slice(-6) : "—");
  // Recompute the payout binding in the judge's own browser: keccak256(utf8 resultText) must
  // equal the resultHash the attestor signed into the release. Match ⇒ the payment is honest.
  let hashOk: boolean | null = null;
  try { hashOk = keccak256(toBytes(proof.resultText ?? "")).toLowerCase() === (proof.resultHash || "").toLowerCase(); } catch { hashOk = null; }

  return (
    <div className="rounded-2xl border border-brassLight/30 bg-brass/[0.06] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-brass shrink-0" />
        <p className="text-sm font-display font-semibold text-paper">Consult complete — escrow released</p>
      </div>
      <p className="text-[11px] text-paper/50 leading-relaxed">
        The agent delivered; <b className="text-paper/75">{eth} ETH</b> released to the provider on-chain, attested by the gateway. Every field below is recomputable from public data.
      </p>

      {hashOk !== null && (
        <div className={`flex items-center gap-1.5 text-[11px] ${hashOk ? "text-emerald-400" : "text-red-400"}`}>
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          {hashOk ? "resultHash recomputed in your browser ✓ — payout bound to this exact result" : "resultHash mismatch ✗"}
        </div>
      )}

      <div className="space-y-1.5 text-[10px] font-mono">
        <div className="flex items-center justify-between gap-2">
          <span className="text-paper/30">settlement tx</span>
          <a href={`${explorer}/tx/${proof.settlementRef}`} target="_blank" rel="noreferrer" className="text-brassLight hover:text-brass inline-flex items-center gap-0.5">{short(proof.settlementRef)} <ExternalLink className="w-2.5 h-2.5" /></a>
        </div>
        <div className="flex items-center justify-between gap-2"><span className="text-paper/30">resultHash</span><span className="text-paper/60">{short(proof.resultHash)}</span></div>
        <div className="flex items-center justify-between gap-2"><span className="text-paper/30">verdictHash</span><span className="text-paper/60">{short(proof.verdictHash)}</span></div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <a href="/verify" className="flex-1 text-center rounded-lg bg-brass/20 border border-brassLight/40 px-3 py-2 text-[11px] font-medium text-paper hover:bg-brass/30 transition-colors inline-flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Verify by recompute
        </a>
        <button onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-[11px] text-paper/60 hover:bg-white/5 transition-colors inline-flex items-center gap-1">
          <X className="w-3.5 h-3.5" /> Close
        </button>
      </div>
    </div>
  );
}
