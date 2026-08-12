"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Wallet, Loader2, ShieldCheck, Anchor, ExternalLink, KeyRound } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { PqAuthorize } from "@/components/PqAuthorize";
import { PqLifecycle } from "@/components/PqLifecycle";
import { useWalletModal } from "@/hooks/useWalletModal";

// Owner surface: the agents this wallet holds + their post-quantum key state. Existing agents (minted
// before the mint-time authorize flow) get an "Authorize PQ key" button here. Everything is recomputable —
// each card links to the agent's binding, which anyone can re-derive.
const GW = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const short = (h?: string) => (h ? h.slice(0, 6) + "…" + h.slice(-4) : "—");

type Agent = { registry: string; agent_id: string | number; name?: string; image?: string };
type Binding = { pq_pubkey?: string; owner_authorization?: unknown; anchor?: unknown };

export default function MyAgents() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { address } = useAccount();
  const { open } = useWalletModal();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [bindings, setBindings] = useState<Record<string, Binding>>({});

  useEffect(() => {
    if (!address) { setAgents(null); return; }
    setAgents(null);
    fetch(`${GW}/agents/by-owner/${address.toLowerCase()}`)
      .then((r) => r.json()).then((d) => setAgents(d.agents || [])).catch(() => setAgents([]));
  }, [address]);

  useEffect(() => {
    if (!agents) return;
    for (const a of agents) {
      const key = `${a.registry}/${a.agent_id}`;
      fetch(`${GW}/pq/agent/${a.registry}/${a.agent_id}/binding`)
        .then((r) => r.json()).then((b) => setBindings((s) => ({ ...s, [key]: b }))).catch(() => {});
    }
  }, [agents]);

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <TopNav />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">Owner</p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-tightest">Your agents</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gb-muted">
          The agents this wallet holds, and their post-quantum key state. Authorize an agent&apos;s PQ key so its
          per-attestation companion is <span className="text-paper/70">owner-authorized</span>, not just
          gateway-attested — one free signature. Every binding is recomputable.
        </p>

        {!mounted ? null : !address ? (
          <button onClick={open}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-brass px-6 py-3 font-display font-medium text-deepink hover:bg-brassLight transition-colors">
            <Wallet className="h-4 w-4" /> Connect wallet
          </button>
        ) : agents === null ? (
          <div className="mt-10 flex items-center gap-2 text-gb-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading your agents…</div>
        ) : agents.length === 0 ? (
          <p className="mt-10 text-sm text-gb-muted">No agents held by this wallet. <a href="/mint" className="text-brassLight hover:text-brass">Mint one →</a></p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {agents.map((a) => {
              const key = `${a.registry}/${a.agent_id}`;
              const b = bindings[key];
              const authorized = !!(b && b.owner_authorization);
              const anchored = !!(b && b.anchor);
              return (
                <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-3">
                    {a.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image} alt="" className="h-12 w-12 rounded-xl object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5"><KeyRound className="h-5 w-5 text-brassLight/70" /></div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-display text-[15px] text-paper">{a.name || `Agent #${a.agent_id}`}</p>
                      <p className="font-mono text-[10px] text-gb-faint">{short(a.registry)} · #{a.agent_id}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px]">
                    <span className="inline-flex items-center gap-1 text-gb-muted"><Anchor className="h-3 w-3" /> {anchored ? <span className="text-emerald-300/80">binding anchored</span> : "binding not yet anchored"}</span>
                    <span className="inline-flex items-center gap-1 text-gb-muted"><ShieldCheck className="h-3 w-3" /> {authorized ? <span className="text-emerald-300/80">owner-authorized</span> : "not authorized"}</span>
                  </div>

                  {b && !authorized && (
                    <div className="-mt-1"><PqAuthorize registry={a.registry} tokenId={String(a.agent_id)} /></div>
                  )}
                  {authorized && (
                    <p className="mt-3 text-[11px] text-emerald-300/80">Post-quantum key authorized — recompute it below.</p>
                  )}

                  <a href={`${GW}/pq/agent/${a.registry}/${a.agent_id}/binding`} target="_blank" rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-[11px] text-brassLight/80 hover:text-brassLight">
                    recompute the PQ binding <ExternalLink className="h-3 w-3" />
                  </a>

                  {/* Rotate / revoke / terminate — all owner-signed, no admin, no gas. Collapsed by
                      default: this is recovery machinery, not everyday use. */}
                  <PqLifecycle registry={a.registry} tokenId={String(a.agent_id)} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
