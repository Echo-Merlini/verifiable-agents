"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowUpRight } from "lucide-react";
import { AgentChat } from "@/components/AgentChat";
import { McpLogo } from "@/components/McpLogo";
import { buildMcpCards, DEMO_AGENT, type McpCard, type PublicMcp } from "@/lib/mcps";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

export default function DemoPage() {
  // AgentChat hands us its sendMessage via onReady; MCP cards call it.
  const sendRef = useRef<((payload: string, display?: string) => void) | null>(null);
  const [cards, setCards] = useState<McpCard[]>([]);

  // The agent's real toolbox — the same public list the consult page uses.
  useEffect(() => {
    fetch(`${GW_URL}/agent/public-mcps`)
      .then((r) => (r.ok ? r.json() : []))
      .then((mcps: PublicMcp[]) => setCards(buildMcpCards(mcps)))
      .catch(() => setCards([]));
  }, []);

  const pick = (c: McpCard) => sendRef.current?.(c.prompt, c.display);

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link href="/" className="font-display font-medium tracking-tight text-paper">Verifiable Agents</Link>
          <div className="flex items-center gap-6">
            <Link href={`/consult/?registry=${DEMO_AGENT.registry}&agentId=${DEMO_AGENT.agentId}`} className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Consult (A2A)</Link>
            <Link href="/verify" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80 hover:text-brassLight">
              <ShieldCheck className="h-3.5 w-3.5" /> Verify
            </Link>
          </div>
        </div>

        {/* Agent header — avatar left of the title */}
        <div className="mt-8 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={DEMO_AGENT.image}
            alt={DEMO_AGENT.name}
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border border-white/10 object-cover shrink-0"
            style={{ imageRendering: "pixelated" }}
          />
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">Live agent · {DEMO_AGENT.by}</p>
            <h1 className="mt-1 font-display font-medium tracking-tightest text-4xl sm:text-5xl">{DEMO_AGENT.name}</h1>
            <p className="mt-1.5 font-mono text-[11px] text-gb-faint truncate">
              {DEMO_AGENT.ens} · #{DEMO_AGENT.agentId} · {DEMO_AGENT.registry.slice(0, 6)}…{DEMO_AGENT.registry.slice(-4)}
            </p>
          </div>
        </div>

        {/* MCP selectors */}
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">
          Its tools — hover to learn, click to watch it run
        </p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.id} className="relative group">
              <button
                onClick={() => pick(c)}
                className="liquid-glass w-full h-full group/btn rounded-2xl p-4 text-left transition-colors hover:border-brassLight/40"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <McpLogo card={c} className="h-6 w-6" />
                </span>
                <p className="mt-3 font-display font-medium text-paper flex items-center gap-1">
                  {c.label}
                  <ArrowUpRight className="h-3.5 w-3.5 text-gb-faint transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                </p>
                <p className="mt-0.5 text-[11px] text-gb-faint">{c.tagline}</p>
              </button>

              {/* Hover tooltip — brief italic description of the MCP */}
              <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <div className="rounded-xl border border-white/10 bg-deepink/95 px-3 py-2.5 text-[11px] italic leading-relaxed text-gb-muted shadow-xl backdrop-blur">
                  {c.blurb}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chat */}
        <div className="mt-6 liquid-glass rounded-2xl overflow-hidden">
          <AgentChat
            registry={DEMO_AGENT.registry}
            agentId={DEMO_AGENT.agentId}
            onReady={(send) => { sendRef.current = send; }}
          />
        </div>

        {/* Verify note */}
        <div className="mt-4 rounded-xl border border-white/8 p-4 text-sm text-gb-muted">
          Every action this agent takes is attested on-chain. When it runs a tool, you can{" "}
          <Link href="/verify" className="text-brassLight hover:text-brass">recompute the attestation yourself</Link> —
          input, output, and the on-chain anchor, all verified in your browser.
        </div>
      </div>
    </main>
  );
}
