"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Check, ArrowRight, Download, ExternalLink, Terminal } from "lucide-react";

const GW = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

type Entry = {
  inputHash: string; agentId: string | number; registry: string; actionType: string;
  outputHash: string; l3Tx?: string; l3ChainId: number; attestor: string; timestamp: number;
  verdict: string; receipt: string;
};

const short = (h?: string) => (h ? h.slice(0, 10) + "…" + h.slice(-6) : "—");
const scan = (id: number) => (id === 1 ? "https://etherscan.io" : "https://sepolia.basescan.org");

export default function LedgerPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch(`${GW}/ledger?limit=50`).then((r) => r.json()).then((d) => setEntries(d.entries || [])).catch(() => setErr(true));
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
          Every attested agent action, live from the gateway. Download any receipt and verify it on your own
          machine with <code className="text-paper/70">recompute-kit-verify</code> — or recompute the whole chain on
          <a href="/verify" className="text-brassLight/80 hover:text-brassLight"> /verify</a>. No trust required.
        </p>

        <div className="mt-6 rounded-lg border border-white/10 bg-black/40 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-gb-muted"><Terminal className="h-3.5 w-3.5 text-brassLight/70" /> verify any receipt below</div>
          <pre className="mt-1.5 overflow-x-auto font-mono text-[11px] text-emerald-300/90"><code>{`pip install recompute-kit-verify\nrecompute-verify receipt.json   # → verified-good`}</code></pre>
        </div>

        <div className="mt-6 space-y-3">
          {entries === null && !err && <p className="text-[13px] text-gb-muted">Loading the record…</p>}
          {err && <p className="text-[13px] text-amber-300/80">Couldn&apos;t reach the gateway ledger right now — that&apos;s &quot;couldn&apos;t check&quot;, not a failure. Retry shortly.</p>}
          {entries?.length === 0 && <p className="text-[13px] text-gb-muted">No attested actions yet.</p>}
          {entries?.map((e) => (
            <div key={e.inputHash} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="h-3.5 w-3.5" /></span>
                  <span className="font-display text-[15px] text-paper">agent <span className="text-paper/50">#{e.agentId}</span></span>
                  <span className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-paper/50">{e.actionType}</span>
                  <span className="rounded-md border border-emerald-400/30 bg-emerald-400/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-300/80">{e.verdict}</span>
                </div>
                <span className="font-mono text-[10px] text-paper/40">{new Date(e.timestamp * 1000).toISOString().slice(0, 10)}</span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-1 font-mono text-[11px] sm:grid-cols-2">
                <div><span className="text-paper/40">input </span><span className="text-paper/80">{short(e.inputHash)}</span></div>
                <div><span className="text-paper/40">output </span><span className="text-paper/80">{short(e.outputHash)}</span></div>
                <div><span className="text-paper/40">attestor </span><span className="text-paper/80">{short(e.attestor)}</span></div>
                {e.l3Tx && <div><span className="text-paper/40">anchor </span>
                  <a href={`${scan(e.l3ChainId)}/tx/${e.l3Tx}`} target="_blank" rel="noopener noreferrer" className="text-brassLight/80 hover:text-brassLight">{short(e.l3Tx)} <ExternalLink className="inline h-3 w-3" /></a></div>}
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-[12px]">
                <a href={`${GW}${e.receipt}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-brassLight/90 hover:text-brassLight"><Download className="h-3.5 w-3.5" /> receipt</a>
                <a href={`/verify?key=${e.inputHash}`} className="inline-flex items-center gap-1.5 text-brassLight/90 hover:text-brassLight">recompute the chain <ArrowRight className="h-3.5 w-3.5" /></a>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-[12px] text-gb-muted max-w-xl">
          Each receipt is a <code className="text-paper/70">conformance_proof_object.v0</code> bridged live from the gateway&apos;s
          WYRIWE attestation (<a href="/kit" className="text-brassLight/80 hover:text-brassLight">recompute-kit</a>), integrity-bound
          and EIP-712 signed — the deep re-derivation runs on <a href="/verify" className="text-brassLight/80 hover:text-brassLight">/verify</a>.
          Wins and losses both kept.
        </p>
      </div>
    </main>
  );
}
