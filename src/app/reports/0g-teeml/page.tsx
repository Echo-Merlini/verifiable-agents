"use client";

import { TopNav } from "@/components/TopNav";
import { TeeInferenceEvidence } from "@/components/TeeInferenceEvidence";
import { EnclaveQuoteEvidence } from "@/components/EnclaveQuoteEvidence";
import { ArrowRight, ExternalLink } from "lucide-react";

// Audit Report — the reusable Vértice deliverable format. A recomputable investigation, published as a
// case-study page: the narrative + the honest evidence classes + the live in-browser recompute panels.
// This one is instance #1 (0G TeeML). Every future audit (client / MCP / chain) renders in this shape.

export default function ZeroGTeemlReport() {
  return (
    <main className="min-h-screen bg-deepink text-paper">
      <TopNav />
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
        <a href="/audit" className="text-sm text-gb-muted hover:text-paper transition-colors">← Audit</a>

        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80">Audit Report · recompute investigation</p>
        <h1 className="mt-4 font-display font-medium tracking-tightest text-4xl sm:text-5xl">
          Is 0G TeeML actually <span className="brass-text">enclave-executed?</span>
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-paper/50">
          <span>subject · 0G TeeML inference</span>
          <span>method · recompute from public bytes</span>
          <span>verdict · relay ≠ enclave; genuine enclave fully recomputed</span>
        </div>

        <p className="mt-6 text-gb-muted leading-relaxed">
          &quot;TeeML&quot; promises the model ran in a sealed enclave. We didn&apos;t take the label — we recomputed it. Two
          findings, both re-derivable in your browser below: on 0G Galileo the reachable provider is a
          <span className="text-paper"> signing relay, not an enclave</span> (the label outran its evidence); on 0G
          Compute mainnet a <span className="text-paper">genuine enclave</span> lets us recompute the entire chain of a
          live inference — with no reliance on the provider&apos;s own <code className="text-paper/70">tee_verified</code> flag.
        </p>

        {/* Finding 1 — relay baseline */}
        <h2 className="mt-12 font-display text-2xl text-paper">Finding 1 — the relay baseline</h2>
        <p className="mt-2 text-[13px] text-gb-muted leading-relaxed">
          A real signed inference on the reachable Galileo provider. The broker signature over its own commitments
          recomputes — but there is <span className="text-paper">no hardware quote</span>. &quot;TeeML&quot; here is a signed
          routing proof, not proof the model ran sealed. Recompute it:
        </p>
        <TeeInferenceEvidence />

        {/* Finding 2 — genuine enclave */}
        <h2 className="mt-12 font-display text-2xl text-paper">Finding 2 — the genuine enclave, fully recomputed</h2>
        <p className="mt-2 text-[13px] text-gb-muted leading-relaxed">
          A live glm-5.2 inference on 0G Compute mainnet. Every arrow re-derived from public bytes: the enclave
          signer, request + response digests, the TDX quote&apos;s RTMR replay, the signer↔quote↔registry identity, and
          the quote&apos;s hardware root of trust down to <span className="text-paper">Intel&apos;s pinned root</span> (dcap-qvl,
          in-browser, no vendor SDK). Recompute it:
        </p>
        <EnclaveQuoteEvidence />

        {/* The honest boundary */}
        <h2 className="mt-12 font-display text-2xl text-paper">The line we don&apos;t cross</h2>
        <p className="mt-2 text-[13px] text-gb-muted leading-relaxed">
          Three distinct claims sit around the quote — we don&apos;t conflate them. <span className="text-emerald-300/80">Hardware
          authenticity</span> (the quote is a genuine Intel-provisioned part) is <em>recomputed, green</em>.
          <span className="text-amber-300/80"> Expected-image authorization</span> (MRTD == 0G&apos;s <em>published</em> glm-5.2
          measurement) is the one <em>honest amber</em>, pending 0G publishing it. <span className="text-paper/70">PCS
          freshness</span> (the part&apos;s TCB is current) is a separate liveness claim, out of scope. This report never
          says &quot;we audited 0G&quot; — it recomputes a specific inference and states exactly what each check proves.
        </p>

        <div className="mt-6 flex flex-wrap gap-4 font-mono text-[12px]">
          <a href="https://gist.github.com/TMerlini/19d532bcb627d3ea237c72003d550337" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brassLight/80 hover:text-brassLight">reproduce (node) <ExternalLink className="h-3 w-3" /></a>
          <a href="https://github.com/trustless-ai/recompute-kit/pull/2" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brassLight/80 hover:text-brassLight">conformance vector (11/11) <ExternalLink className="h-3 w-3" /></a>
        </div>

        {/* CTA → sales funnel */}
        <div className="mt-14 rounded-3xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
          <p className="font-display text-lg text-paper">Want a recomputable audit report like this for your project?</p>
          <p className="mt-2 text-[13px] text-gb-muted max-w-xl">Independent, signed, and re-derivable by anyone — not a PDF you have to trust. This is the deliverable format for a Vértice audit.</p>
          <a href="https://verticecriativo.pt/review-gate" className="mt-5 inline-flex items-center gap-1.5 text-sm text-brassLight hover:text-paper transition-colors">
            The Recomputable Review Gate <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </main>
  );
}
