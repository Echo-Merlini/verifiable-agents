import { ShieldCheck, Shield } from "lucide-react";
import type { Verification } from "@/lib/marketplace";

// Icon-only mark. Green shield = Recomputable (verified end-to-end against golden vectors, no
// human in the loop); amber shield = Attested (vouched for, not fully recomputable). The home
// page explains the symbol — see Landing legend.
export function VerificationBadge({ status, className = "" }: { status: Verification; className?: string }) {
  const rec = status === "recomputable";
  const Icon = rec ? ShieldCheck : Shield;
  return (
    <span
      role="img"
      aria-label={rec ? "Recomputable" : "Attested"}
      title={rec
        ? "Fully recomputable — reproduced end-to-end from golden vectors, no human in the loop"
        : "Attested — vouched for, not fully recomputable"}
      className={`inline-flex shrink-0 ${className}`}
    >
      <Icon className={`h-4 w-4 ${rec ? "text-zinc-500" : "text-amber-400"}`} />
    </span>
  );
}
