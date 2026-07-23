import { ShieldCheck, Shield } from "lucide-react";
import type { Verification } from "@/lib/marketplace";

// Icon-only mark, deliberately discreet — both shields stay muted grey so they don't shout. The
// checkmark shield (lighter grey) = Recomputable (verified end-to-end against golden vectors, no
// human in the loop); the plain shield (dimmer grey) = Attested (vouched for, not fully
// recomputable — the quiet exception lane). Icon shape + shade tell them apart; the marketplace
// and home-page legends spell it out.
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
      <Icon className={`h-4 w-4 ${rec ? "text-zinc-500" : "text-zinc-600"}`} />
    </span>
  );
}
