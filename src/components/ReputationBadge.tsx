"use client";

import { ShieldCheck, ShieldQuestion, AlertTriangle } from "lucide-react";
import {
  type Reputation,
  repScorePct,
  repTone,
  TONE_LABEL,
  TONE_CLASSES,
} from "@/lib/marketplace";

// Compact reputation chip for marketplace cards. Shows the confidence-adjusted floor
// (Wilson lower bound) as a percent, the qualitative band, and — always — the raw
// counts, so nobody reads the number as more than "delivered vs refunded". A trial-less
// agent is honestly "Unrated", never a fake 0% or 5 stars.
export function ReputationBadge({ rep, className = "" }: { rep: Reputation | null | undefined; className?: string }) {
  const tone = repTone(rep);
  const pct = repScorePct(rep);
  const t = TONE_CLASSES[tone];
  const incomplete = rep?.window === "incomplete";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full bg-black/25 px-2.5 py-1 ring-1 ${t.ring} ${className}`}>
      {tone === "unrated" ? (
        <ShieldQuestion className={`h-3.5 w-3.5 ${t.text}`} />
      ) : (
        <ShieldCheck className={`h-3.5 w-3.5 ${t.text}`} />
      )}
      <span className={`font-mono text-xs font-semibold ${t.text}`}>
        {pct === null ? "Unrated" : `${pct}%`}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{TONE_LABEL[tone]}</span>
      {rep && rep.trials > 0 && (
        <span className="font-mono text-[10px] text-zinc-500">
          {rep.successful}/{rep.trials}
        </span>
      )}
      {incomplete && <AlertTriangle className="h-3 w-3 text-amber-300" aria-label="incomplete window" />}
    </div>
  );
}
