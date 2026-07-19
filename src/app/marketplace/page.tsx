"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { Bot, Coins, ClipboardCheck, ExternalLink, Loader2, Store, Check } from "lucide-react";
import { fetchMarketAgents, fetchPremiumMcps, type MarketAgent, type PremiumMcp } from "@/lib/marketplace";
import { buildCardsFromIds } from "@/lib/mcps";
import { McpLogo } from "@/components/McpLogo";
import { ReputationBadge } from "@/components/ReputationBadge";
import { McpStore } from "@/components/McpStore";

function fmtHours(s?: number) {
  if (!s) return "—";
  const h = s / 3600;
  return h >= 1 ? `${h}h` : `${Math.round(s / 60)}m`;
}

function fmtPrice(wei: string) {
  try {
    const eth = formatEther(BigInt(wei || "0"));
    return `${eth} ETH`;
  } catch {
    return "—";
  }
}

function AgentCard({ a, premium }: { a: MarketAgent; premium: Map<string, PremiumMcp> }) {
  const tools = useMemo(() => buildCardsFromIds(a.consultTools || []).slice(0, 6), [a.consultTools]);
  const extra = Math.max(0, (a.consultTools?.length || 0) - tools.length);
  const agentRef = `${a.registry}:${a.agentId}`;
  const openseaUrl = `https://opensea.io/assets/ethereum/${a.registry}/${a.agentId}`;
  const held = (a.entitlements ?? []).map((slug) => premium.get(slug)).filter(Boolean) as PremiumMcp[];

  return (
    <div className="liquid-glass flex flex-col rounded-2xl p-4">
      {/* Identity row */}
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/[0.06]">
          {a.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.image} alt={a.name} className="h-full w-full object-cover" />
          ) : (
            <Bot className="m-3.5 h-7 w-7 text-zinc-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-display text-base font-semibold">{a.name || `Agent #${a.agentId}`}</h3>
          </div>
          <div className="mt-1.5">
            <ReputationBadge rep={a.reputation} />
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-zinc-400">{a.description || "—"}</p>

      {/* Tool loadout */}
      {tools.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5">
          {tools.map((t) => (
            <div key={t.id} className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-black/30 ring-1 ring-white/[0.06]" title={t.label}>
              <McpLogo card={t} className="h-4 w-4" fill />
            </div>
          ))}
          {extra > 0 && <span className="font-mono text-[11px] text-zinc-500">+{extra}</span>}
        </div>
      )}

      {/* Held premium capabilities (bought, carried by the agent NFT) */}
      {held.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {held.map((p) => (
            <span key={p.slug} className="inline-flex items-center gap-1.5 rounded-full bg-brass/12 px-2 py-0.5 text-[11px] text-brassLight ring-1 ring-brass/25" title={`${p.label} — held on-chain`}>
              <span className="flex h-3.5 w-3.5 items-center justify-center overflow-hidden rounded-[3px]">
                <McpLogo card={{ id: p.slug, label: p.label, logo: p.logo } as any} className="h-3.5 w-3.5" />
              </span>
              {p.label}
              <Check className="h-3 w-3" />
            </span>
          ))}
        </div>
      )}

      {/* Price + window */}
      <div className="mt-3 flex items-center gap-4 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5" /> {fmtPrice(a.consultPrice)}</span>
        <span>window {fmtHours(a.completionWindow)}</span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-3">
        <Link
          href={`/A2A?agent=${encodeURIComponent(agentRef)}`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brass/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-brass"
        >
          <Coins className="h-4 w-4" /> Hire
        </Link>
        <Link
          href={`/console?agent=${encodeURIComponent(agentRef)}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2 text-sm font-medium text-zinc-300 ring-1 ring-white/[0.06] transition hover:bg-white/[0.07]"
        >
          <ClipboardCheck className="h-4 w-4" /> Audit
        </Link>
        <a
          href={openseaUrl}
          target="_blank"
          rel="noreferrer"
          title="Collect this agent (ERC-721)"
          className="inline-flex items-center justify-center rounded-lg bg-white/[0.04] px-2.5 py-2 text-zinc-400 ring-1 ring-white/[0.06] transition hover:bg-white/[0.07]"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [agents, setAgents] = useState<MarketAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [premium, setPremium] = useState<Map<string, PremiumMcp>>(new Map());

  useEffect(() => {
    fetchMarketAgents().then((list) => {
      setAgents(list);
      setLoading(false);
    });
    fetchPremiumMcps().then((list) => setPremium(new Map(list.map((m) => [m.slug, m]))));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Store className="h-6 w-6 text-brassLight" />
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Marketplace</h1>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Hire a recomputable agent, collect one as an NFT, or open its audit trail. Every reputation
        score is a predicate over public escrow settlements — recomputed on-chain, not asserted.
        <Link href="/console" className="ml-1 text-brassLight hover:underline">Owner &amp; auditor console →</Link>
      </p>

      {/* Grid */}
      {loading ? (
        <div className="mt-16 flex items-center justify-center text-zinc-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading agents…
        </div>
      ) : agents.length === 0 ? (
        <div className="liquid-glass mt-10 rounded-2xl p-8 text-center text-sm text-zinc-400">
          No agents are published to the marketplace yet.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={`${a.registry}:${a.agentId}`} a={a} premium={premium} />
          ))}
        </div>
      )}

      {/* Premium MCP store — buy a capability, carried by the agent NFT */}
      {!loading && <McpStore agents={agents} />}
    </main>
  );
}
