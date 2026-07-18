"use client";

import { useEffect } from "react";
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

const CHECKS = [
  { lbl: "raw input",  op: "keccak(query)",         hash: "0x2469bae0…9fef30" },
  { lbl: "provenance", op: "sanitization pipeline",  hash: "0x2469bae0…9fef30" },
  { lbl: "output",     op: "keccak(reply)",          hash: "0xfe6dee12…f8d544" },
  { lbl: "L3 anchor",  op: "ERC-8281 Recorded",      hash: "read on-chain" },
  { lbl: "L4 signer",  op: "EIP-712 recover",        hash: "= attestor" },
];

const STEPS = [
  { t: "OCP · ERC-8281 anchor", who: "Damon & Vincent", d: "joint work on observation commitments" },
  { t: "Pocket Network",        who: "",                d: "collaboration on the decentralized-inference side" },
  { t: "Jimmy joined",          who: "",                d: "when we helped land his ERC — task-hash / primary artifact" },
  { t: "Fede",                  who: "Inveritas",       d: "catching every flaw early through his lens" },
  { t: "trustless-AI",          who: "",                d: "the shared home for the reference implementations" },
];

const TOOLS = [
  { k: "Uniswap",             h: "Swaps, direct.",        d: "QuoterV2 price + SwapRouter02 calldata your own wallet signs. Not an aggregator.", proof: "0.002 ETH → 3.686 USDC", real: true },
  { k: "0G",                  h: "Stores its own proof.", d: "Writes the recompute artifact to 0G decentralized storage — not a single server.", proof: "rootHash 0x5feede…00e0", real: true },
  { k: "ENS · first write-MCP", h: "Buys & manages names.", d: "Check, register (commit → reveal), set records. Every other ENS MCP is read-only.", proof: "recompute.eth · available", real: true },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80 mb-5 inline-flex items-center gap-3">
      <span className="w-6 h-px bg-brass/50" aria-hidden="true" /> {children}
    </p>
  );
}

export function Landing() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      }),
      { threshold: 0.25 },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <NavMenu currentPath="" />

      <style>{`
        .story-reveal{opacity:0;transform:translateY(16px);transition:opacity .7s ease,transform .7s cubic-bezier(.22,.61,.36,1)}
        .story-reveal.is-in,[data-reveal].is-in .story-reveal{opacity:1;transform:none}
        .chkrow .mk{color:#6E6656;transition:color .55s ease}
        .chkrow .mk::after{content:"·"}
        [data-reveal].is-in .chkrow .mk{color:#68C08C}
        [data-reveal].is-in .chkrow .mk::after{content:"✓"}
        @media (prefers-reduced-motion:reduce){.story-reveal{opacity:1!important;transform:none!important}.chkrow .mk{transition:none}}
      `}</style>

      <div className="max-w-5xl mx-auto px-6 md:px-10">
        {/* Top bar */}
        <div className="flex items-center justify-between py-6">
          <span className="font-display font-medium tracking-tight text-paper">Recomputable Agents</span>
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
        <section className="grid sm:grid-cols-2 gap-3 pb-4">
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

        {/* ─── The story ─────────────────────────────────────────────── */}

        {/* Problem */}
        <section data-reveal className="mt-20 pt-16 sm:pt-24 border-t border-white/8">
          <div className="story-reveal">
            <Eyebrow>The problem</Eyebrow>
            <h2 className="font-display font-medium tracking-tighter2 text-3xl sm:text-5xl leading-[1.04]">AI agents are black boxes.</h2>
            <p className="mt-6 font-serif text-xl sm:text-2xl leading-relaxed text-paper/90 max-w-2xl">
              On-chain, you&apos;re asked to <span className="text-paper font-medium">trust</span> that an agent saw the input it claims — and did what it reports.
              A signature only proves <em>who</em> signed, never <em>that the computation was honest.</em>
            </p>
            <p className="mt-4 font-serif text-lg text-gb-muted">&ldquo;Trust me&rdquo; doesn&apos;t belong in a trust-minimized system.</p>
          </div>
        </section>

        {/* Origin */}
        <section data-reveal className="mt-20 pt-16 sm:pt-24 border-t border-white/8">
          <div className="story-reveal">
            <Eyebrow>Origin · April 2026</Eyebrow>
            <h2 className="font-display font-medium tracking-tighter2 text-3xl sm:text-5xl leading-[1.04]">It started with one comment.</h2>
            <blockquote className="mt-8 border-l-2 border-brass pl-6 font-serif italic text-2xl sm:text-3xl leading-snug text-paper max-w-xl">
              Can you prove an agent read what it claims to have read?
            </blockquote>
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.15em] text-gb-faint">
              — on the ERC-8004 discussion → became <span className="text-brassLight">WYRIWE</span> · ethereum/ERCs #1810
            </p>
            <p className="mt-4 font-serif text-lg text-gb-muted max-w-xl">What You Read Is What Executed. The seed — and the comment that found a community.</p>
          </div>
        </section>

        {/* The group */}
        <section data-reveal className="mt-20 pt-16 sm:pt-24 border-t border-white/8">
          <div className="story-reveal">
            <Eyebrow>The question found people</Eyebrow>
            <h2 className="font-display font-medium tracking-tighter2 text-3xl sm:text-5xl leading-[1.04]">Every answer became a primitive.</h2>
            <div className="mt-8 flex flex-col border-l border-white/10 max-w-2xl">
              {STEPS.map((s, i) => (
                <div key={i} className="relative pl-6 py-2.5">
                  <span className="absolute -left-[4px] top-[1.15rem] w-[7px] h-[7px] rounded-full bg-brass" aria-hidden="true" />
                  <p className="font-serif text-lg leading-relaxed text-gb-muted">
                    <span className="font-mono text-[0.95rem] font-semibold text-paper tracking-tight">{s.t}</span>
                    {s.who && <span className="font-mono text-sm text-brassLight"> · {s.who}</span>}
                    {" — "}{s.d}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-8 font-serif text-lg text-gb-muted max-w-2xl">
              Provenance → anchor → identity → source-binding → bounded actions → the Recompute Kit.
              <span className="text-paper font-medium"> AI primitives — a modular assembly.</span>
            </p>
          </div>
        </section>

        {/* Thesis — recompute ledger */}
        <section data-reveal className="mt-20 pt-16 sm:pt-24 border-t border-white/8">
          <div className="story-reveal">
            <Eyebrow>The thesis</Eyebrow>
            <h2 className="font-display font-medium tracking-tighter2 text-3xl sm:text-5xl leading-[1.04]">Verify by recomputing. Not by trusting.</h2>
            <p className="mt-6 font-serif text-xl leading-relaxed text-paper/90 max-w-2xl">
              Every agent action is wrapped in a chain of custody anyone can re-derive from public data. Five checks — no server, no oracle:
            </p>
            <div className="mt-8 font-mono text-sm border-t border-white/10 max-w-3xl">
              {CHECKS.map((c, i) => (
                <div key={i} className="chkrow grid grid-cols-[1.1fr_auto] sm:grid-cols-[1fr_1.3fr_1.4fr_auto] gap-3 sm:gap-6 items-center py-3 border-b border-white/8">
                  <span className="text-paper">{c.lbl}</span>
                  <span className="hidden sm:block text-gb-faint">{c.op}</span>
                  <span className="hidden sm:block text-gb-muted tracking-tight truncate">{c.hash}</span>
                  <span className="mk justify-self-end w-5 text-center text-base" style={{ transitionDelay: `${0.15 * (i + 1)}s` }} aria-hidden="true" />
                </div>
              ))}
            </div>
            <p className="mt-5 font-serif text-base text-gb-muted">A failed read shows <span className="text-brassLight">amber</span> — &ldquo;couldn&apos;t check.&rdquo; Honest ternary, never a false green.</p>
          </div>
        </section>

        {/* Toolbox */}
        <section data-reveal className="mt-20 pt-16 sm:pt-24 border-t border-white/8">
          <div className="story-reveal">
            <Eyebrow>It doesn&apos;t just talk — it acts</Eyebrow>
            <h2 className="font-display font-medium tracking-tighter2 text-3xl sm:text-5xl leading-[1.04]">Non-custodial. Recomputable.</h2>
            <div className="mt-8 grid sm:grid-cols-3 gap-3">
              {TOOLS.map((t, i) => (
                <div key={i} className="liquid-glass rounded-2xl p-5 flex flex-col gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-brassLight">{t.k}</span>
                  <h3 className="font-display font-medium text-lg text-paper">{t.h}</h3>
                  <p className="font-serif text-sm leading-relaxed text-paper/55">{t.d}</p>
                  <p className="mt-auto pt-2 font-mono text-[11px] text-gb-faint truncate">
                    {t.proof} <span className="text-[#68C08C]">✓ real</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-8 font-serif text-lg text-gb-muted max-w-2xl">
              Every tool call flows through the attestation pipeline. Each is an action you can <span className="text-paper font-medium">audit after the fact.</span>
            </p>
          </div>
        </section>

        {/* Close */}
        <section data-reveal className="mt-20 pt-16 sm:pt-24 border-t border-white/8">
          <div className="story-reveal">
            <Eyebrow>From a single WYRIWE to this</Eyebrow>
            <h2 className="font-display font-medium tracking-tightest text-4xl sm:text-6xl leading-[0.98]">
              Don&apos;t trust. <span className="brass-text">Recompute.</span>
            </h2>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/verify"
                className="inline-flex items-center gap-2 rounded-full bg-brass px-6 py-3 text-sm font-display font-medium text-deepink hover:bg-brassLight transition-colors">
                <ShieldCheck className="w-4 h-4" /> Recompute a real action
              </Link>
              <Link href="/demo"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm text-paper/80 hover:border-brassLight/40 hover:text-paper transition-colors">
                Watch an agent act <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 border-t border-white/8 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
