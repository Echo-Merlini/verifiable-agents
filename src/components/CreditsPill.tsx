"use client";

import { useState, useEffect } from "react";
import { Zap, Coins } from "lucide-react";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

// Discreet AI-credit pill. Polls so it reflects deductions after each chat turn.
// When a `registry` is given and that collection is community-metered (and the
// user hasn't switched to their own wallet), it shows the shared COMMUNITY POOL
// balance; otherwise it shows the connected wallet's own credits. Renders nothing
// until a balance loads.
export function CreditsPill({ address, registry, className = "" }: { address?: string; registry?: string; className?: string }) {
  const [state, setState] = useState<{ variant: "pool" | "wallet"; credits: number } | null>(null);

  useEffect(() => {
    let active = true;
    const regLc = registry?.toLowerCase();

    const load = async () => {
      try {
        if (regLc && /^0x[0-9a-f]{40}$/.test(regLc)) {
          const cr = await fetch(`${GW_URL}/api/registry/${regLc}/credits`).then(r => r.json());
          const source = (typeof window !== "undefined" && localStorage.getItem(`creditSource:${regLc}`)) || "pool";
          // Community pool is what usage spends unless the user opted into their wallet.
          if (cr?.meteringMode === "community" && source !== "wallet") {
            if (active) setState({ variant: "pool", credits: typeof cr.credits === "number" ? cr.credits : 0 });
            return;
          }
        }
        // Wallet variant (wallet-only collections, genesis, or user-selected wallet).
        if (address && /^0x[0-9a-fA-F]{40}$/.test(address)) {
          const wr = await fetch(`${GW_URL}/api/registry/wallet/${address}/credits`).then(r => r.json());
          if (active && typeof wr.credits === "number") setState({ variant: "wallet", credits: wr.credits });
        } else if (active) {
          setState(null);
        }
      } catch { /* ignore */ }
    };

    load();
    const t = setInterval(load, 12000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { active = false; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [address, registry]);

  if (!state) return null;
  const isPool = state.variant === "pool";
  const cls = isPool
    ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-300/90 hover:bg-emerald-400/15"
    : "bg-amber-400/10 border-amber-400/20 text-amber-300/90 hover:bg-amber-400/15";
  return (
    <a
      href={isPool ? "/my-agents/" : (address ? `/top-up/?address=${address}` : "/top-up/")}
      title={isPool ? "Community pool credits — shared. Switch source in my-agents." : "Your AI credits — click to top up"}
      className={`inline-flex items-center gap-1 font-mono text-[9px] px-1.5 py-0.5 rounded-full border transition-colors ${cls} ${className}`}
    >
      {isPool ? <Coins className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />} {state.credits.toLocaleString()}
    </a>
  );
}
