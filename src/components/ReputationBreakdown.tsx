"use client";

import { ShieldCheck, RotateCcw, Clock, Loader2, HelpCircle, AlertTriangle } from "lucide-react";
import { type Reputation, repScorePct, repTone, TONE_LABEL, TONE_CLASSES, shortAddr } from "@/lib/marketplace";

const EXPLORER: Record<number, string> = { 1: "https://etherscan.io", 11155111: "https://sepolia.etherscan.io", 84532: "https://sepolia.basescan.org" };

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-black/20 px-3 py-2.5">
      <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
      <div className="min-w-0">
        <div className="font-mono text-lg font-semibold leading-none">{value}</div>
        <div className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      </div>
    </div>
  );
}

// The auditor-facing reputation panel: the raw predicate laid out so anyone can re-run
// it. Every number here is recomputed from ConsultEscrow on-chain — the panel names the
// method, the escrow, and the chain so the reader can reproduce it, not trust it.
export function ReputationBreakdown({ rep }: { rep: Reputation | null | undefined }) {
  if (!rep) {
    return (
      <div className="liquid-glass rounded-2xl p-5 text-sm text-zinc-400">
        <AlertTriangle className="mb-2 h-5 w-5 text-amber-300" />
        Reputation could not be recomputed right now (the escrow read failed). Fails closed —
        no score is shown rather than a fabricated one. Retry shortly.
      </div>
    );
  }

  const tone = repTone(rep);
  const pct = repScorePct(rep);
  const t = TONE_CLASSES[tone];
  const explorer = rep.recompute.chainId ? EXPLORER[rep.recompute.chainId] : undefined;

  return (
    <div className="liquid-glass rounded-2xl p-5">
      {/* Headline score */}
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">Confidence-adjusted delivery rate</div>
          <div className={`mt-1 font-display text-3xl font-bold ${t.text}`}>
            {pct === null ? "Unrated" : `${pct}%`}
            {pct !== null && <span className="ml-2 align-middle text-sm font-normal text-zinc-500">{TONE_LABEL[tone]}</span>}
          </div>
        </div>
        {rep.window === "incomplete" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200 ring-1 ring-amber-300/25">
            <AlertTriangle className="h-3.5 w-3.5" /> Incomplete window
          </span>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-zinc-400">
        {pct === null
          ? "No settled consults yet — nothing to score. An empty record reads as unrated, never as a clean 0 or a 5-star."
          : <>Wilson 95% lower bound over {rep.trials} settled consult{rep.trials === 1 ? "" : "s"}. Small samples read low on purpose — one delivery is not a track record.</>}
      </p>

      {/* Counts */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat icon={ShieldCheck} label="Delivered · released" value={rep.successful} tone="text-emerald-300" />
        <Stat icon={RotateCcw} label="Refunded" value={rep.unsuccessful} tone="text-rose-300" />
        <Stat icon={Clock} label="Stale · expired" value={rep.stale} tone="text-zinc-300" />
        <Stat icon={Loader2} label="In-flight" value={rep.inFlight} tone="text-sky-300" />
        {rep.unverifiable > 0 && <Stat icon={AlertTriangle} label="Unverifiable" value={rep.unverifiable} tone="text-amber-300" />}
        {rep.notOnchain > 0 && <Stat icon={HelpCircle} label="Never opened" value={rep.notOnchain} tone="text-zinc-400" />}
      </div>

      {/* Binding recomputability */}
      {(rep.bindingVerified !== undefined || rep.bindingAsserted !== undefined) && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-[11px]">
          <span className="text-zinc-500">job→agent binding:</span>
          <span className="text-emerald-300">{rep.bindingVerified ?? 0} recomputable</span>
          {(rep.bindingAsserted ?? 0) > 0 && <span className="text-zinc-400">· {rep.bindingAsserted} legacy (asserted)</span>}
          <span className="ml-auto font-mono text-zinc-600">jobId = keccak(consumer:registry:agentId:salt)</span>
        </div>
      )}

      {/* Axis honesty + recompute provenance */}
      <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-zinc-500">
        <p>
          <span className="text-zinc-400">Axis:</span> delivery-vs-verdict. “Delivered” means the consult was
          returned <em>and the escrow released</em> — settlement, not a quality judgment. <span className="text-zinc-400">Stale</span> jobs
          are reported separately and excluded from the score’s trial count.
        </p>
        <p className="font-mono">
          <span className="not-italic text-zinc-400">recompute:</span> {rep.recompute.method}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-zinc-400">escrow:</span>
          {rep.recompute.escrow && explorer ? (
            <a href={`${explorer}/address/${rep.recompute.escrow}`} target="_blank" rel="noreferrer" className="font-mono text-brassLight hover:underline">
              {shortAddr(rep.recompute.escrow)}
            </a>
          ) : (
            <span className="font-mono">{shortAddr(rep.recompute.escrow)}</span>
          )}
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">chain</span> <span className="font-mono">{rep.recompute.chainId ?? "—"}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">z</span> <span className="font-mono">{rep.recompute.z}</span>
        </p>
      </div>
    </div>
  );
}
