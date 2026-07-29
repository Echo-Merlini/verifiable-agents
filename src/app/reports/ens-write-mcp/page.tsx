"use client";

import { useState } from "react";
import { namehash, encodeFunctionData, isAddress } from "viem";
import { TopNav } from "@/components/TopNav";
import { ArrowRight, ExternalLink, Check as CheckIcon, X as XIcon } from "lucide-react";

// Audit Report · instance #2 — the ENS Write MCP. Same deliverable template as /reports/0g-teeml, but the
// live recompute here is the ENS calldata derivation itself: an MCP that builds ENS writes is only trustworthy
// if the transaction it builds is byte-identical to what the public ENS rules require. viem re-derives that
// in your browser (namehash per EIP-137/ENSIP-1 + the resolver ABI) — no chain read, fully deterministic.

const SETADDR_ABI = [{ type: "function", name: "setAddr", stateMutability: "nonpayable",
  inputs: [{ name: "node", type: "bytes32" }, { name: "addr", type: "address" }], outputs: [] }] as const;

function EnsCalldataRecompute() {
  const [name, setName] = useState("alice.eth");
  const [addr, setAddr] = useState("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
  const valid = isAddress(addr);
  let node = "", calldata = "", err = "";
  try {
    if (!valid) throw new Error("not a valid address");
    node = namehash(name);
    calldata = encodeFunctionData({ abi: SETADDR_ABI, functionName: "setAddr", args: [node as `0x${string}`, addr as `0x${string}`] });
  } catch (e) { err = (e as Error).message; }

  const input = "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[12px] text-paper placeholder-paper/30 outline-none focus:border-brassLight/50";

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-[12px] text-gb-muted">
        <span className="text-paper">Recompute the calldata yourself.</span> This is the exact transaction the MCP must build for
        <code className="text-paper/70"> ens_set_addr</code>. Change the inputs — the derivation is public and deterministic, no MCP trusted.
      </p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><label className="font-mono text-[10px] uppercase tracking-wider text-paper/40">name</label><input value={name} onChange={(e) => setName(e.target.value)} className={input} /></div>
        <div><label className="font-mono text-[10px] uppercase tracking-wider text-paper/40">addr</label><input value={addr} onChange={(e) => setAddr(e.target.value)} className={input} /></div>
      </div>
      <div className="mt-3 space-y-2 font-mono text-[11px]">
        <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
          <p className="text-paper/40">namehash(name) · EIP-137</p>
          <p className="mt-1 break-all text-brassLight/90">{node || "—"}</p>
        </div>
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.03] p-3">
          <div className="flex items-center gap-1.5 text-emerald-300/90">
            {err ? <><XIcon className="h-3.5 w-3.5" /> {err}</> : <><CheckIcon className="h-3.5 w-3.5" /> setAddr calldata · selector 0x8b95dd71 ‖ node ‖ addr</>}
          </div>
          <p className="mt-1 break-all text-emerald-300/80">{calldata || "—"}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-paper/40">Conformant iff the MCP builds exactly these bytes. A build with a different node, recipient, or encoding is caught by the rule — not by any self-comparison.</p>
    </div>
  );
}

export default function EnsWriteReport() {
  return (
    <main className="min-h-screen bg-deepink text-paper">
      <TopNav />
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
        <a href="/reports" className="text-sm text-gb-muted hover:text-paper transition-colors">← Audit Reports</a>

        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80">Audit Report · recompute investigation</p>
        <h1 className="mt-4 font-display font-medium tracking-tightest text-4xl sm:text-5xl">
          Can you trust an MCP that <span className="brass-text">writes to ENS for you?</span>
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-paper/50">
          <span>subject · ENS Write MCP</span>
          <span>method · recompute the calldata from public rules</span>
          <span>verdict · non-custodial + recompute-first</span>
        </div>

        <p className="mt-6 text-gb-muted leading-relaxed">
          An MCP that sets your ENS records is a scary amount of trust: it builds a transaction that changes what
          your name points to. So we don&apos;t ask you to trust it — we make its output <span className="text-paper">checkable</span>.
          Two properties, both verifiable without trusting the MCP:
        </p>

        <h2 className="mt-10 font-display text-2xl text-paper">1 — Non-custodial by construction</h2>
        <p className="mt-2 text-[13px] text-gb-muted leading-relaxed">
          The MCP <span className="text-paper">never holds your keys</span>. It builds an unsigned transaction; you sign it in your
          own wallet. It cannot move anything on its own — the worst a broken MCP can do is build a <em>wrong</em>
          transaction, and that&apos;s exactly what the next check catches before you sign.
        </p>

        <h2 className="mt-10 font-display text-2xl text-paper">2 — Recompute-first: the calldata is byte-identical to public rules</h2>
        <p className="mt-2 text-[13px] text-gb-muted leading-relaxed">
          For each operation the transaction is fully determined by public ENS rules —
          <code className="text-paper/70"> calldata = selector ‖ namehash(name) ‖ abi.encode(args)</code>, with
          <code className="text-paper/70"> namehash</code> per EIP-137 / ENSIP-1. Anyone re-derives it; the MCP is admissible
          only if it builds <span className="text-paper">exactly those bytes</span>. Recompute it here, live:
        </p>
        <EnsCalldataRecompute />

        <h2 className="mt-12 font-display text-2xl text-paper">The evidence, per operation</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="text-paper/40"><tr><th className="py-1 pr-4">tool</th><th className="py-1 pr-4">function</th><th className="py-1">basis</th></tr></thead>
            <tbody className="text-paper/80">
              <tr className="border-t border-white/8"><td className="py-1.5 pr-4">ens_set_addr</td><td className="py-1.5 pr-4">setAddr(node, addr)</td><td className="py-1.5 text-emerald-300/80">recomputed · byte-identical</td></tr>
              <tr className="border-t border-white/8"><td className="py-1.5 pr-4">ens_set_text</td><td className="py-1.5 pr-4">setText(node, key, value)</td><td className="py-1.5 text-emerald-300/80">recomputed · byte-identical</td></tr>
              <tr className="border-t border-white/8"><td className="py-1.5 pr-4">ens_set_primary</td><td className="py-1.5 pr-4">setName(name)</td><td className="py-1.5 text-emerald-300/80">recomputed · byte-identical</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-gb-muted leading-relaxed">
          Frozen as the conformance profile <code className="text-paper/70">ens-write.v0</code> — a candidate MCP is conformant only
          if, over the pinned vectors, every operation matches the independent derivation byte-for-byte.
        </p>

        <div className="mt-6 flex flex-wrap gap-4 font-mono text-[12px]">
          <a href="https://demo.verticecriativo.pt/conformance" className="inline-flex items-center gap-1 text-brassLight/80 hover:text-brassLight">recompute the whole catalog (live) <ArrowRight className="h-3 w-3" /></a>
          <a href="https://recomputekit-ai.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brassLight/80 hover:text-brassLight">recompute-kit <ExternalLink className="h-3 w-3" /></a>
        </div>

        <div className="mt-14 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
          <p className="font-display text-lg text-paper">Want a recomputable audit report like this for your MCP or agent?</p>
          <p className="mt-2 text-[13px] text-gb-muted max-w-xl">Independent, signed, and re-derivable by anyone — the deliverable format for a Vértice audit.</p>
          <a href="https://verticecriativo.pt/review-gate" className="mt-5 inline-flex items-center gap-1.5 text-sm text-brassLight hover:text-paper transition-colors">
            The Recomputable Review Gate <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </main>
  );
}
