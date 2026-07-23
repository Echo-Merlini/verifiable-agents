"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { Bot, Coins, ClipboardCheck, ExternalLink, Loader2, Store, Shield, ShieldCheck } from "lucide-react";
import { fetchMarketAgents, fetchPremiumMcps, tagPillClass, verificationOf, VERIFICATION_TAGS, type MarketAgent, type PremiumMcp } from "@/lib/marketplace";
import { VerificationBadge } from "@/components/VerificationBadge";
import { buildCardsFromIds } from "@/lib/mcps";
import { McpLogo } from "@/components/McpLogo";
import { ReputationBadge } from "@/components/ReputationBadge";
import { McpStore } from "@/components/McpStore";
import { TopNav } from "@/components/TopNav";

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
  // Loadout = owner-configured tools + capabilities the agent HOLDS on-chain (bought premium
  // MCPs, e.g. ENS Write), merged and deduped by slug so a held capability shows as its own
  // square rather than a separate pill.
  const cards = useMemo(() => {
    const toolCards = buildCardsFromIds(a.consultTools || []);
    const heldCards = (a.entitlements ?? [])
      .map((slug) => premium.get(slug))
      .filter(Boolean)
      .map((p) => ({ id: (p as PremiumMcp).slug, label: (p as PremiumMcp).label, logo: (p as PremiumMcp).logo, icon: (p as PremiumMcp).icon, fill: (p as PremiumMcp).fill }));
    const seen = new Set<string>();
    return [...heldCards, ...toolCards].filter((c: any) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  }, [a.consultTools, a.entitlements, premium]);
  // Agent category tags — the deduped union of its loadout's tags, aggregated by the gateway
  // (consult tools are mcp_server ids, so the tag join has to happen server-side). Pull Premium
  // first and Community second so they aren't lost among a dense loadout; keep the rest as-is.
  const verification = verificationOf(a.tags);
  const agentTags = useMemo(() => {
    const rank = (t: string) => (t.toLowerCase() === "premium" ? 0 : t.toLowerCase() === "community" ? 1 : 2);
    return [...(a.tags ?? [])].filter((t) => !VERIFICATION_TAGS.has(t.toLowerCase())).sort((x, y) => rank(x) - rank(y));
  }, [a.tags]);
  const shownTags = agentTags.slice(0, 8);
  const extraTags = agentTags.length - shownTags.length;
  const tools = cards.slice(0, 6);
  const extra = Math.max(0, cards.length - tools.length);
  const agentRef = `${a.registry}:${a.agentId}`;
  const openseaUrl = `https://opensea.io/assets/ethereum/${a.registry}/${a.agentId}`;

  return (
    <div className="liquid-glass flex flex-col rounded-2xl border border-brassLight/30 p-4">
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
            <VerificationBadge status={verification} />
          </div>
          <div className="mt-1.5">
            <ReputationBadge rep={a.reputation} />
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-zinc-400">{a.description || "—"}</p>

      {/* Loadout + price cluster — pinned near the actions bar so the squares and
          price line always sit at the same height across cards, regardless of how
          long the description runs */}
      <div className="mt-auto pt-3">
        {tools.length > 0 && (
          <div className="flex items-center gap-1.5">
            {tools.map((t) => (
              <div key={t.id} className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-black/30 ring-1 ring-brassLight/45" title={t.label}>
                <McpLogo card={t as any} className="h-5 w-5" fill />
              </div>
            ))}
            {extra > 0 && <span className="font-mono text-[11px] text-zinc-500">+{extra}</span>}
          </div>
        )}
        <div className={`flex items-center gap-4 text-[11px] text-zinc-500 ${tools.length > 0 ? "mt-3" : ""}`}>
          <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5" /> {fmtPrice(a.consultPrice)}</span>
          <span>window {fmtHours(a.completionWindow)}</span>
        </div>
        {shownTags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {shownTags.map((t) => (
              <span key={t} className={tagPillClass(t, "sm")}>{t}</span>
            ))}
            {extraTags > 0 && <span className={tagPillClass("+", "sm")}>+{extraTags}</span>}
          </div>
        )}
      </div>

      {/* Actions bar */}
      <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
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
    <>
    <TopNav />
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6">
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

      {/* Legend — what the shields and tags on each card mean */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[11px] text-zinc-500">
        <span className="font-medium uppercase tracking-wider text-zinc-400">What the marks mean</span>
        <span className="inline-flex items-center gap-1.5" title="Reproduced end-to-end from golden vectors, no human in the loop">
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-500" />
          <span><b className="font-semibold text-zinc-300">Recomputable</b> — re-derived from golden vectors, no human in the loop</span>
        </span>
        <span className="inline-flex items-center gap-1.5" title="Vouched for, not fully recomputable — the exception lane">
          <Shield className="h-3.5 w-3.5 text-amber-400" />
          <span><b className="font-semibold text-amber-300/90">Attested</b> — vouched for, not fully recomputable</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={tagPillClass("Premium", "sm")}>Premium</span>
          <span>paid capability, carried by the agent NFT</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={tagPillClass("Community", "sm")}>Community</span>
          <span>open, community-listed</span>
        </span>
        <span className="text-zinc-600">Other tags = capability categories (DEX, Data, …)</span>
      </div>

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
    </>
  );
}
