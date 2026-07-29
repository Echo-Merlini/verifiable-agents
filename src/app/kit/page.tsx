"use client";

import { TopNav } from "@/components/TopNav";
import { ArrowRight, ExternalLink, Terminal } from "lucide-react";

const INSTALL = 'pip install "git+https://github.com/trustless-ai/recompute-kit.git#subdirectory=verify"';
const REPO = "https://github.com/trustless-ai/recompute-kit";

const TRI = [
  ["verified-good", "0", "root recomputes AND the carried conformance verdict is ok", "text-emerald-300"],
  ["verified-bad", "1", "root mismatches (tampered) OR the carried verdict is rejected", "text-red-300"],
  ["UNVERIFIABLE", "2", "not parseable / no capsule / no stored root to check", "text-amber-300"],
];

export default function KitPage() {
  return (
    <main className="min-h-screen bg-deepink text-paper">
      <TopNav />
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80">recompute-kit</span>
        <h1 className="mt-4 font-display font-medium tracking-tightest text-4xl sm:text-5xl">
          Don&apos;t trust. <span className="brass-text">Recompute.</span>
        </h1>
        <p className="mt-4 text-gb-muted max-w-xl">
          The trust layer for agent tool-use. Every recompute-kit / MCP action can ship a <span className="text-paper">recomputable
          receipt</span> — you re-derive it on your own machine and read its verdict verbatim, trusting no one, not
          even us. Same discipline Fede&apos;s invinoveritas brings to review; recompute-kit brings it to <span className="text-paper">execution</span>.
        </p>

        {/* Install / verify */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-[12px] text-gb-muted"><Terminal className="h-4 w-4 text-brassLight/80" /> Verify a receipt offline — stdlib only, zero dependencies</div>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[12px] text-emerald-300/90"><code>{INSTALL}</code></pre>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[12px] text-paper/80"><code>{`recompute-verify receipt.json   # exit 0 = good, 1 = bad, 2 = unverifiable`}</code></pre>
          <p className="mt-3 text-[11px] text-paper/40">It recomputes the receipt&apos;s <code className="text-paper/70">receipt_root</code> (<code className="text-paper/70">receiptos-c14n-v0</code>) and reads the capsule&apos;s conformance verdict verbatim — never inferring the verdict from the root match.</p>
        </div>

        {/* Tri-state */}
        <h2 className="mt-12 font-display text-2xl text-paper">The tri-state</h2>
        <p className="mt-1 text-[13px] text-gb-muted">&quot;Couldn&apos;t check&quot; is its own verdict — never a silent pass.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-[12px]">
            <thead className="text-paper/40"><tr><th className="py-1 pr-4">status</th><th className="py-1 pr-4">exit</th><th className="py-1">meaning</th></tr></thead>
            <tbody>
              {TRI.map(([s, code, mean, color]) => (
                <tr key={s} className="border-t border-white/8">
                  <td className={`py-2 pr-4 ${color}`}>{s}</td>
                  <td className="py-2 pr-4 text-paper/50">{code}</td>
                  <td className="py-2 text-paper/70">{mean}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* What's in the kit */}
        <h2 className="mt-12 font-display text-2xl text-paper">What&apos;s in the kit</h2>
        <ul className="mt-3 space-y-2 text-[13px] text-gb-muted">
          <li>· <span className="text-paper">7 recompute primitives</span> (repo · claim · ci · onchain · commitment · storage-proof · receipt-proof) + an MCP server.</li>
          <li>· <span className="text-paper">Conformance vectors</span> — public inputs → expected verdicts; a candidate MCP is admissible only if it reproduces every one byte-for-byte.</li>
          <li>· <span className="text-paper">The receipt</span> — <code className="text-paper/70">recompute-kit.conformance_proof_object.v0</code>, deterministic + fails-closed.</li>
          <li>· <span className="text-paper">recompute-kit-verify</span> — the offline verifier above.</li>
        </ul>

        <div className="mt-6 flex flex-wrap gap-4 font-mono text-[12px]">
          <a href={REPO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brassLight/80 hover:text-brassLight">source <ExternalLink className="h-3 w-3" /></a>
          <a href="/reports" className="inline-flex items-center gap-1 text-brassLight/80 hover:text-brassLight">audit reports <ArrowRight className="h-3 w-3" /></a>
          <a href="/conformance" className="inline-flex items-center gap-1 text-brassLight/80 hover:text-brassLight">recompute our MCPs live <ArrowRight className="h-3 w-3" /></a>
        </div>

        <div className="mt-14 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
          <p className="font-display text-lg text-paper">Want your MCP or agent to ship recomputable receipts?</p>
          <p className="mt-2 text-[13px] text-gb-muted max-w-xl">Trust as a check, not a claim — the same layer, wired into your tools.</p>
          <a href="https://verticecriativo.pt/review-gate" className="mt-5 inline-flex items-center gap-1.5 text-sm text-brassLight hover:text-paper transition-colors">
            Talk to Vértice <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </main>
  );
}
