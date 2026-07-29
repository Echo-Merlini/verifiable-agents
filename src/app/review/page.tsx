"use client";

import { TopNav } from "@/components/TopNav";
import { ReviewVerdictEvidence } from "@/components/ReviewVerdictEvidence";
import { ExternalLink } from "lucide-react";

export default function ReviewPage() {
  return (
    <main className="min-h-screen bg-deepink text-paper">
      <TopNav />
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80">Don&apos;t trust. Recompute.</span>

        <h1 className="mt-4 font-display font-medium tracking-tightest text-4xl sm:text-5xl">
          Reviewed — <span className="brass-text">recompute the review.</span>
        </h1>
        <p className="mt-4 text-gb-muted max-w-xl">
          Before Vértice presents its flagship claim, an <span className="text-paper">independent reviewer</span> signs a verdict on it.
          The verdict isn&apos;t a badge you trust — it&apos;s a proof you re-derive: the Schnorr signature, the reviewer&apos;s pinned key,
          the decision binding, and the reviewed artifact re-hashed from its published source — all <span className="text-paper">in your browser</span>.
          Recompute the claim on <a href="/verify" className="text-brassLight hover:underline">/verify</a>, then recompute the review of it here.
        </p>

        <div className="mt-6">
          <ReviewVerdictEvidence />
        </div>

        <p className="mt-6 text-[12px] text-gb-muted max-w-xl">
          The reviewer&apos;s public track record — every signed verdict, wins and losses kept — is the invinoveritas{" "}
          <a href="https://api.babyblueviper.com/ledger" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brassLight/80 hover:text-brassLight">/ledger <ExternalLink className="h-3 w-3" /></a>.
          You never have to call anyone to check this verdict — recompute it offline with{" "}
          <code className="text-paper/70">npm i invinoveritas-verify</code> against the pinned key.
        </p>
      </div>
    </main>
  );
}
