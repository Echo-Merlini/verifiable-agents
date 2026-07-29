"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Check, ArrowRight, Download, ExternalLink, Terminal } from "lucide-react";

type Att = {
  ens: string; agentId: number | string; rawInputHash: string; inputHash: string; outputHash: string;
  l4Signature: string; attestor: string; l3Tx: string; ocpContract: string; l3ChainId: number; timestamp: number;
};

// Entry = a bridged receipt + its source attestation. Today: the mainnet showcase (Phase 2a/2b). Per-call
// receipts land here as the gateway emits them (2c). Wins AND losses kept — a real track record.
const ENTRIES = [
  { att: "/showcase.json", receipt: "/showcase-receipt.json", verdict: "verified", note: "mainnet showcase · WYRIWE L1–L4" },
];

const short = (h?: string) => (h ? h.slice(0, 10) + "…" + h.slice(-6) : "—");
const scan = (id: number) => (id === 1 ? "https://etherscan.io" : "https://sepolia.basescan.org");

export default function LedgerPage() {
  const [rows, setRows] = useState<{ att: Att; e: typeof ENTRIES[number] }[]>([]);
  useEffect(() => {
    Promise.all(ENTRIES.map((e) => fetch(e.att).then((r) => r.json()).then((att) => ({ att, e })).catch(() => null)))
      .then((xs) => setRows(xs.filter(Boolean) as any));
  }, []);

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <TopNav />
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80">The ledger</span>
        <h1 className="mt-4 font-display font-medium tracking-tightest text-4xl sm:text-5xl">
          A track record you can <span className="brass-text">recompute.</span>
        </h1>
        <p className="mt-4 text-gb-muted max-w-xl">
          Every agent action carries a signed, on-chain-anchored receipt. Download any one and verify it on your
          own machine with <code className="text-paper/70">recompute-kit-verify</code> — or recompute the whole chain
          live. Wins and losses both kept. No trust required.
        </p>

        <div className="mt-8 space-y-3">
          {rows.length === 0 && <p className="text-[13px] text-gb-muted">Loading the record…</p>}
          {rows.map(({ att, e }, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="h-3.5 w-3.5" /></span>
                  <span className="font-display text-[15px] text-paper">{att.ens} <span className="text-paper/40">#{att.agentId}</span></span>
                  <span className="rounded-md border border-emerald-400/30 bg-emerald-400/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-300/80">{e.verdict}</span>
                </div>
                <span className="font-mono text-[10px] text-paper/40">{new Date(att.timestamp * 1000).toISOString().slice(0, 10)}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-paper/35">{e.note}</p>

              <div className="mt-3 grid grid-cols-1 gap-1 font-mono text-[11px] sm:grid-cols-2">
                <div><span className="text-paper/40">input </span><span className="text-paper/80">{short(att.inputHash)}</span></div>
                <div><span className="text-paper/40">output </span><span className="text-paper/80">{short(att.outputHash)}</span></div>
                <div><span className="text-paper/40">attestor </span><span className="text-paper/80">{short(att.attestor)}</span></div>
                <div><span className="text-paper/40">anchor </span>
                  <a href={`${scan(att.l3ChainId)}/tx/${att.l3Tx}`} target="_blank" rel="noopener noreferrer" className="text-brassLight/80 hover:text-brassLight">{short(att.l3Tx)} <ExternalLink className="inline h-3 w-3" /></a>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-white/10 bg-black/40 p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-gb-muted"><Terminal className="h-3.5 w-3.5 text-brassLight/70" /> verify this receipt yourself</div>
                <pre className="mt-1.5 overflow-x-auto font-mono text-[11px] text-emerald-300/90"><code>{`pip install recompute-kit-verify\ncurl -sO https://ai.verticecriativo.pt${e.receipt}\nrecompute-verify ${e.receipt.slice(1)}   # → verified-good`}</code></pre>
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-[12px]">
                <a href={e.receipt} download className="inline-flex items-center gap-1.5 text-brassLight/90 hover:text-brassLight"><Download className="h-3.5 w-3.5" /> download receipt</a>
                <a href="/verify" className="inline-flex items-center gap-1.5 text-brassLight/90 hover:text-brassLight">recompute the whole chain <ArrowRight className="h-3.5 w-3.5" /></a>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[12px] text-gb-muted max-w-xl">
          This is the front of the record — per-call receipts land here as the gateway emits them. Each is a
          <code className="text-paper/70"> conformance_proof_object.v0</code> bridged from the gateway&apos;s WYRIWE attestation
          (<a href="/kit" className="text-brassLight/80 hover:text-brassLight">recompute-kit</a>), integrity-bound and
          signed — the deep re-derivation runs on <a href="/verify" className="text-brassLight/80 hover:text-brassLight">/verify</a>.
        </p>
      </div>
    </main>
  );
}
