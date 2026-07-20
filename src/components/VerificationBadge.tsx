import { ShieldCheck, Shield } from "lucide-react";
import type { Verification } from "@/lib/marketplace";

// Recomputable (green) = verified end-to-end against golden vectors, no human in the loop.
// Attested (amber) = vouched for but not fully recomputable — the priced-worse exception lane.
export function VerificationBadge({ status, className = "" }: { status: Verification; className?: string }) {
  const rec = status === "recomputable";
  return (
    <span
      title={rec
        ? "Recomputable — reproduced end-to-end from golden vectors, no human in the loop"
        : "Attested — vouched for, not fully recomputable"}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${
        rec ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-amber-400/40 bg-amber-400/10 text-amber-300"
      } ${className}`}
    >
      {rec ? <ShieldCheck className="h-2.5 w-2.5" /> : <Shield className="h-2.5 w-2.5" />}
      {rec ? "Recomputable" : "Attested"}
    </span>
  );
}
