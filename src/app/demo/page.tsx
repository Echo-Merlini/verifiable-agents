"use client";

import { useRef } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowUpRight } from "lucide-react";
import { AgentChat } from "@/components/AgentChat";
import { MCP_SELECTORS, DEMO_AGENT, type McpSelector } from "@/lib/mcps";

export default function DemoPage() {
  // AgentChat hands us its sendMessage via onReady; MCP cards call it.
  const sendRef = useRef<((payload: string, display?: string) => void) | null>(null);

  const pick = (m: McpSelector) => sendRef.current?.(m.prompt, m.display);

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link href="/" className="font-display font-medium tracking-tight text-paper">Verifiable Agents</Link>
          <div className="flex items-center gap-6">
            <Link href="/consult/?registry=0xe91934ab1f6a40cc1bb4cd530feff56dfe524963&agentId=1" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Consult (A2A)</Link>
            <Link href="/verify" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80 hover:text-brassLight">
              <ShieldCheck className="h-3.5 w-3.5" /> Verify
            </Link>
          </div>
        </div>

        {/* Agent header */}
        <div className="mt-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">Live agent · {DEMO_AGENT.by}</p>
          <h1 className="mt-2 font-display font-medium tracking-tightest text-4xl sm:text-5xl">{DEMO_AGENT.name}</h1>
          <p className="mt-2 font-mono text-[11px] text-gb-faint">
            {DEMO_AGENT.ens} · #{DEMO_AGENT.agentId} · {DEMO_AGENT.registry.slice(0, 6)}…{DEMO_AGENT.registry.slice(-4)}
          </p>
        </div>

        {/* MCP selectors */}
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">
          Its tools — click one, watch it run
        </p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MCP_SELECTORS.map((m) => (
            <button
              key={m.id}
              onClick={() => pick(m)}
              className="liquid-glass group rounded-2xl p-4 text-left transition-colors hover:border-brassLight/40"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl font-display font-semibold text-sm text-paper"
                style={{ background: m.color }}
              >
                {m.name[0]}
              </span>
              <p className="mt-3 font-display font-medium text-paper flex items-center gap-1">
                {m.name}
                <ArrowUpRight className="h-3.5 w-3.5 text-gb-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </p>
              <p className="mt-0.5 text-[11px] text-gb-faint">{m.tagline}</p>
            </button>
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
