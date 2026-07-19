"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bot, Loader2, ShieldCheck, FileJson, Gauge, ArrowUpRight, Store } from "lucide-react";
import { fetchMarketAgents, fetchPremiumMcps, type MarketAgent, type PremiumMcp } from "@/lib/marketplace";
import { ReputationBreakdown } from "@/components/ReputationBreakdown";
import { LicensedMcpAudit } from "@/components/LicensedMcpAudit";
import { getGatewayUrl } from "@/hooks/useGatewayEnv";

function ConsoleInner() {
  const params = useSearchParams();
  const wanted = params.get("agent"); // "registry:agentId"

  const [agents, setAgents] = useState<MarketAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRef, setSelectedRef] = useState<string | null>(wanted);
  const [premium, setPremium] = useState<Map<string, PremiumMcp>>(new Map());

  useEffect(() => {
    fetchMarketAgents().then((list) => {
      setAgents(list);
      setLoading(false);
      if (!wanted && list.length) setSelectedRef(`${list[0].registry}:${list[0].agentId}`);
    });
    fetchPremiumMcps().then((list) => setPremium(new Map(list.map((m) => [m.slug, m]))));
  }, [wanted]);

  const selected = useMemo(
    () => agents.find((a) => `${a.registry}:${a.agentId}` === selectedRef) ?? null,
    [agents, selectedRef],
  );

  const rawUrl = selected
    ? `${getGatewayUrl()}/marketplace/reputation/${selected.registry}/${selected.agentId}`
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <Gauge className="h-6 w-6 text-brassLight" />
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Console</h1>
        <span className="rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-zinc-400 ring-1 ring-white/[0.06]">
          owner &amp; auditor
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        The same agents as the <Link href="/marketplace" className="text-brassLight hover:underline">marketplace</Link>,
        seen from the accountability side: reputation you can re-run, and the recompute trail behind
        each action. Nothing here is our word — every figure is a predicate over public chain data.
      </p>

      {loading ? (
        <div className="mt-16 flex items-center justify-center text-zinc-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : agents.length === 0 ? (
        <div className="liquid-glass mt-10 rounded-2xl p-8 text-center text-sm text-zinc-400">
          No agents published yet — nothing to audit.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
          {/* Agent rail */}
          <aside className="flex flex-col gap-1.5">
            {agents.map((a) => {
              const ref = `${a.registry}:${a.agentId}`;
              const active = ref === selectedRef;
              return (
                <button
                  key={ref}
                  onClick={() => setSelectedRef(ref)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${
                    active ? "bg-white/[0.07] ring-1 ring-brass/40" : "bg-white/[0.02] ring-1 ring-white/[0.05] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-black/30">
                    {a.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Bot className="m-1.5 h-5 w-5 text-zinc-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.name || `Agent #${a.agentId}`}</div>
                    <div className="font-mono text-[10px] text-zinc-500">#{a.agentId}</div>
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Detail */}
          <section className="min-w-0 space-y-5">
            {selected && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/[0.06]">
                    {selected.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selected.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Bot className="m-3 h-6 w-6 text-zinc-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-semibold">{selected.name || `Agent #${selected.agentId}`}</h2>
                    <div className="font-mono text-[11px] text-zinc-500">{selected.registry}</div>
                  </div>
                </div>

                {/* Held premium capabilities (bought, carried by the agent NFT) */}
                {(selected.entitlements ?? []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500">Capabilities held</span>
                    {(selected.entitlements ?? []).map((slug) => {
                      const p = premium.get(slug);
                      return (
                        <span key={slug} className="inline-flex items-center gap-1 rounded-full bg-brass/12 px-2 py-0.5 text-[11px] text-brassLight ring-1 ring-brass/25">
                          {p?.label ?? slug} <ShieldCheck className="h-3 w-3" />
                        </span>
                      );
                    })}
                  </div>
                )}

                <ReputationBreakdown rep={selected.reputation} />

                <LicensedMcpAudit registry={selected.registry} agentId={selected.agentId} />

                {/* Recompute affordances */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Link
                    href="/verify"
                    className="liquid-glass group flex items-center gap-3 rounded-2xl p-4 transition hover:ring-1 hover:ring-brass/30"
                  >
                    <ShieldCheck className="h-6 w-6 shrink-0 text-brassLight" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Recompute a live action</div>
                      <div className="text-[11px] text-zinc-500">Re-derive an agent action’s 5 checks in your browser →</div>
                    </div>
                    <ArrowUpRight className="ml-auto h-4 w-4 text-zinc-500 transition group-hover:text-brassLight" />
                  </Link>
                  {rawUrl && (
                    <a
                      href={rawUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="liquid-glass group flex items-center gap-3 rounded-2xl p-4 transition hover:ring-1 hover:ring-brass/30"
                    >
                      <FileJson className="h-6 w-6 shrink-0 text-brassLight" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">Raw reputation predicate</div>
                        <div className="truncate text-[11px] text-zinc-500">The exact JSON a verifier reproduces →</div>
                      </div>
                      <ArrowUpRight className="ml-auto h-4 w-4 text-zinc-500 transition group-hover:text-brassLight" />
                    </a>
                  )}
                </div>

                {/* Next deepening — per-action receipt feed (the /verify chain per action) */}
                <div className="rounded-2xl border border-dashed border-white/[0.08] p-4 text-[11px] leading-relaxed text-zinc-500">
                  <span className="text-zinc-400">Next:</span> a per-action receipt feed — each action's
                  full attestation chain, recomputable inline the way <Link href="/verify" className="text-brassLight hover:underline">/verify</Link> does for the showcase run.
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default function ConsolePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /></div>}>
      <ConsoleInner />
    </Suspense>
  );
}
