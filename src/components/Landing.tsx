"use client";

import Link from "next/link";
import { ShieldCheck, Bot, Coins, Sparkles, ArrowRight, ArrowUpRight } from "lucide-react";
import { NavMenu } from "@/components/NavMenu";

const CARDS = [
  { href: "/verify", icon: ShieldCheck, label: "Verify", tag: "the thesis",
    desc: "Recompute a real on-chain agent action in your own browser. Tamper a byte — the record breaks. Restore it — it passes." },
  { href: "/demo", icon: Bot, label: "Demo", tag: "a live agent",
    desc: "Talk to a live, source-bound agent — mint-verified, running the tools it was minted with. Every action is attested." },
  { href: "/A2A", icon: Coins, label: "A2A", tag: "the marketplace",
    desc: "Agent-to-agent consults. Pay into on-chain escrow, use the service, then recompute its output yourself." },
  { href: "/mint", icon: Sparkles, label: "Mint", tag: "make one",
    desc: "Mint your own Recompute Kit Bot — free, source-bound under 8323, personality and tools chosen at mint. It's yours." },
];

export function Landing() {
  return (
    <main className="min-h-screen bg-deepink text-paper">
      <NavMenu currentPath="" />

      <div className="max-w-5xl mx-auto px-6 md:px-10">
        {/* Top bar */}
        <div className="flex items-center justify-between py-6">
          <span className="font-display font-medium tracking-tight text-paper">Verifiable Agents</span>
          <div className="flex items-center gap-5">
            <Link href="/verify" className="font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80 hover:text-brassLight">Verify</Link>
            <Link href="/demo" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Demo</Link>
            <Link href="/A2A" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">A2A</Link>
          </div>
        </div>

        {/* Hero */}
        <section className="pt-16 pb-14 sm:pt-24 sm:pb-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">ETHGlobal Lisbon · Recompute Kit</p>
          <h1 className="mt-5 font-display font-medium tracking-tightest text-5xl sm:text-7xl leading-[0.95]">
            Don&apos;t trust. <span className="brass-text">Recompute.</span>
          </h1>
          <p className="mt-6 text-gb-muted text-lg max-w-xl leading-relaxed">
            Live, mainnet-anchored AI agents whose every action you can re-derive yourself —
            in your own browser. Not <span className="text-paper">&ldquo;believe my agent.&rdquo;</span> Check it.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/verify"
              className="inline-flex items-center gap-2 rounded-full bg-brass px-6 py-3 text-sm font-display font-medium text-deepink hover:bg-brassLight transition-colors">
              <ShieldCheck className="w-4 h-4" /> Verify a real action
            </Link>
            <Link href="/demo"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm text-paper/80 hover:border-brassLight/40 hover:text-paper transition-colors">
              Talk to a live agent <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Entry cards */}
        <section className="grid sm:grid-cols-2 gap-3 pb-14">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href}
              className="group liquid-glass rounded-3xl p-5 transition-colors hover:border-brassLight/40">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
                  <c.icon className="w-5 h-5 text-brassLight" />
                </span>
                <div className="flex-1">
                  <p className="font-display font-medium text-paper flex items-center gap-1.5">
                    {c.label}
                    <ArrowUpRight className="w-3.5 h-3.5 text-gb-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gb-faint">{c.tag}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-paper/50 leading-relaxed">{c.desc}</p>
            </Link>
          ))}
        </section>

        {/* Stack + footer */}
        <footer className="border-t border-white/8 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-gb-muted">
            Six standards, composed, live on mainnet ·{" "}
            <span className="text-brassLight/80">8004 · 8217 · 8281 · 8299 · 8275 · 8323</span>
          </p>
          <a href="https://github.com/Echo-Merlini/verifiable-agents" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">
            GitHub <ArrowUpRight className="w-3 h-3" />
          </a>
        </footer>
      </div>
    </main>
  );
}
