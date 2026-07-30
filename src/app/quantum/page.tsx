"use client";

import Link from "next/link";
import { Atom, Hash, ShieldCheck, GitCompareArrows, ArrowRight } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { PqKeyBindingEvidence } from "@/components/PqKeyBindingEvidence";

export default function QuantumPage() {
  return (
    <main className="min-h-screen bg-deepink text-paper">
      <TopNav />
      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* hero */}
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">Post-quantum</p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest">Quantum-ready by recomputation</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gb-muted">
          Shor&apos;s algorithm breaks the elliptic-curve signatures under most of Web3 and most AI
          attestation. It does not break hashes — and re-deriving an action from a hash of public data is
          our whole trust model. So the recompute layer is post-quantum by construction; what remains is
          the signature layer, and here&apos;s exactly how we&apos;re closing it — recomputable, not asserted.
        </p>

        {/* posture — the honest split */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="liquid-glass rounded-2xl border border-emerald-400/20 p-4">
            <p className="flex items-center gap-1.5 font-display font-medium text-emerald-300"><Hash className="h-4 w-4" /> Already post-quantum</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-gb-muted">
              Integrity + precedence are <span className="text-paper/70">hashes end to end</span> — receipt roots, input provenance, content-addressing, and every on-chain anchor. Grover only halves a hash (256→128 bit, still safe), and you <span className="text-paper/70">can&apos;t backdate into an anchor</span>. Prospective forgery, not retroactive decryption — nothing already committed is at risk.
            </p>
          </div>
          <div className="liquid-glass rounded-2xl border border-brassLight/25 p-4">
            <p className="flex items-center gap-1.5 font-display font-medium text-brassLight"><ShieldCheck className="h-4 w-4" /> The lane we&apos;re migrating</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-gb-muted">
              Signatures (ECDSA / Schnorr) are what Shor breaks. The fix isn&apos;t a second signature — a forger just omits it. It&apos;s an <span className="text-paper/70">anchored key-binding + a cutoff</span>, published before any break and <span className="text-paper/70">verified by re-deriving it</span>, not by trusting a server.
            </p>
          </div>
        </div>

        {/* convergence */}
        <div className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><GitCompareArrows className="h-5 w-5 text-brassLight" /> One profile, two NIST families</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gb-muted">
            A post-quantum key-binding says <span className="text-paper/70">this classical key → this post-quantum key</span>, dual-signed and anchored. Below are two live bindings from two <span className="text-paper/70">different</span> NIST post-quantum families — <span className="text-paper/70">ML-DSA</span> (lattice) and <span className="text-paper/70">SLH-DSA</span> (hash-based) — landing on byte-compatible content-addresses through the same canonicalization alone. That&apos;s the interop proof: <code className="rounded bg-white/5 px-1 text-[11px]">{`{algorithm}`}</code> is a field, not a fork. Recompute either one in your browser.
          </p>

          <div className="mt-4 space-y-3">
            <PqKeyBindingEvidence
              fetchUrl="/api/pq-binding"
              viewUrl="https://api.babyblueviper.com/.well-known/pq-key-binding.json"
              title="invinoveritas · ML-DSA-65 (lattice)"
              subtitle={<>Live, OTS-anchored to Bitcoin. Re-derive its content-address + NIP-01 id, verify the ML-DSA-65 companion signature — all in your browser. A different family, the same shared profile.</>}
            />
            <PqKeyBindingEvidence
              fetchUrl="/pq/kya-l4-binding.json"
              viewUrl="/pq/kya-l4-binding.json"
              title="KYA-L4 · SLH-DSA-SHA2-192s (hash-based)"
              subtitle={<>Our production binding — the whole chain reduces to hashes. Recompute the content-address + verify the SLH-DSA signature client-side. Its classical key is OCP-anchored on Ethereum <span className="text-paper/70">mainnet</span>, and the anchor tx is sent by that same key — so the on-chain record <span className="text-paper/70">is</span> the classical proof-of-possession, not a second signature to forge around.</>}
            />
          </div>
        </div>

        {/* conformance + honest line */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[13px] text-gb-muted">
            Both bindings conform to one shared profile, <span className="text-paper">pq_key_binding.v0</span>, with each pinned as a golden vector anyone can reproduce cold —{" "}
            <a href="https://github.com/trustless-ai/recompute-kit/tree/main/conformance/pq-key-binding-v0" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brassLight hover:text-brass">the conformance suite <ArrowRight className="h-3 w-3" /></a>
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-gb-faint">
            We don&apos;t say &ldquo;quantum-proof.&rdquo; The claim is precise: the recompute layer&apos;s trust rests on hashes — the primitive that survives quantum — and here are two post-quantum bindings you can verify yourself. Authentication still uses today&apos;s signatures; the recompute layer doesn&apos;t need them to prove integrity.
          </p>
        </div>

        <div className="mt-6 flex items-center gap-4 text-[12px]">
          <Link href="/verify" className="inline-flex items-center gap-1.5 text-brassLight hover:text-brass"><Atom className="h-3.5 w-3.5" /> the full recompute stack →</Link>
          <span className="font-mono uppercase tracking-[0.2em] text-gb-faint">Don&apos;t trust. Recompute.</span>
        </div>
      </div>
    </main>
  );
}
