"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { ShieldCheck, ChevronDown, ExternalLink, Wallet, LogOut, Bot } from "lucide-react";
import { AgentMark } from "@/components/AgentMark";
import { useWalletModal } from "@/hooks/useWalletModal";
import { ThemeToggle } from "@/components/ThemeToggle";

// Lightweight top bar for the marketplace surfaces. The trust/proof surfaces are grouped under one
// "Audit" dropdown (stack verify · MCP conformance · reports · review gate) so the header stays clean
// and each is a distinct, sellable offering rather than a loose link.
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Live Agent", live: true },   // the agent that actually runs on the platform (route kept as /demo so external links don't break)
  { href: "/mint", label: "Mint" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/business", label: "Business" },
];

// The owner-facing surfaces — everything you do with agents you already hold. Grouped like
// AUDIT so the top row stays short; /top-up lives here because it had no entry point at all.
const AGENTS = [
  { href: "/my-agents", label: "My Agents", desc: "the agents this wallet holds" },
  { href: "/A2A", label: "A2A", desc: "agent-to-agent jobs, escrowed" },
  { href: "/console", label: "Console", desc: "cross-reference recompute matrix" },
  { href: "/top-up", label: "Top up", desc: "add AI credits to your wallet" },
];

const AUDIT = [
  { href: "/verify", label: "Stack Verify", desc: "recompute a live agent action" },
  { href: "/conformance", label: "MCP Conformance", desc: "recompute our MCPs" },
  { href: "/reports", label: "Audit Reports", desc: "recompute investigations" },
  { href: "/ledger", label: "The Ledger", desc: "public track record · verify offline" },
  { href: "/quantum", label: "Post-Quantum", desc: "recompute a PQ key-binding · two NIST families" },
  { href: "/kit", label: "recompute-kit", desc: "the toolkit + offline verifier" },
  { href: "https://verticecriativo.pt/review-gate", label: "Review Gate", desc: "independent recomputable review", external: true },
];

export function TopNav() {
  const path = usePathname();
  const [menu, setMenu] = useState<"audit" | "agents" | null>(null);
  const auditActive  = AUDIT.some((a) => !a.external && path.startsWith(a.href));
  const agentsActive = AGENTS.some((a) => path.startsWith(a.href));

  // Wallet lives in the shared header so a connection carries across every service page.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { open: openWallet } = useWalletModal();

  return (
    <header className="relative border-b border-hairline/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-4 sm:px-6">
        <Link href="/demo" className="inline-flex items-center gap-2.5 font-display font-medium tracking-tight text-paper">
          <AgentMark size={26} spin />
          Recomputable Agents
        </Link>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* The tabs share one raised tray so they read as a group. The wallet and the
              theme toggle stay outside it — they are controls, not navigation. */}
          <div className="neu-rail flex flex-wrap items-center gap-x-0.5 gap-y-0.5 px-1.5 py-1">
          {LINKS.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                  active ? "neu-tab-active text-paper" : "text-gb-muted hover:text-paper"
                }`}
              >
                {"live" in l && (l as { live?: boolean }).live && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                )}
                {l.label}
              </Link>
            );
          })}

          {/* My Agents dropdown — owner-facing surfaces, one entry in the top row */}
          <div className="relative">
            <button
              onClick={() => setMenu((m) => (m === "agents" ? null : "agents"))}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${agentsActive || menu === "agents" ? "neu-tab-active text-paper" : "text-gb-muted hover:text-paper"}`}
            >
              <Bot className="h-3.5 w-3.5" /> My Agents <ChevronDown className={`h-3 w-3 transition-transform ${menu === "agents" ? "rotate-180" : ""}`} />
            </button>
            {menu === "agents" && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" aria-label="close menu" onClick={() => setMenu(null)} />
                <div className="absolute left-0 z-20 mt-3 w-64 rounded-2xl border border-hairline/10 bg-deepink/95 p-2 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] backdrop-blur">
                  {AGENTS.map((a) => (
                    <Link
                      key={a.href}
                      /* carry the address so /top-up auto-fills, as the chat's credit link does */
                      href={a.href === "/top-up" && address ? `/top-up/?address=${address}` : a.href}
                      onClick={() => setMenu(null)}
                      className="block rounded-xl px-3 py-2.5 hover:bg-elevate/[0.04]"
                    >
                      <p className="text-[13px] text-paper">{a.label}</p>
                      <p className="text-[11px] text-gb-muted">{a.desc}</p>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Audit dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenu((m) => (m === "audit" ? null : "audit"))}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${auditActive || menu === "audit" ? "neu-tab-active text-brassLight" : "text-brassLight/80 hover:text-brassLight"}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Audit <ChevronDown className={`h-3 w-3 transition-transform ${menu === "audit" ? "rotate-180" : ""}`} />
            </button>
            {menu === "audit" && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" aria-label="close menu" onClick={() => setMenu(null)} />
                <div className="absolute right-0 z-20 mt-3 w-64 rounded-2xl border border-hairline/10 bg-deepink/95 p-2 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] backdrop-blur">
                  {AUDIT.map((a) =>
                    a.external ? (
                      <a key={a.href} href={a.href} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(null)}
                        className="flex items-start gap-2 rounded-xl px-3 py-2.5 hover:bg-elevate/[0.04]">
                        <div>
                          <p className="flex items-center gap-1 text-[13px] text-paper">{a.label} <ExternalLink className="h-3 w-3 text-gb-muted" /></p>
                          <p className="text-[11px] text-gb-muted">{a.desc}</p>
                        </div>
                      </a>
                    ) : (
                      <Link key={a.href} href={a.href} onClick={() => setMenu(null)}
                        className="block rounded-xl px-3 py-2.5 hover:bg-elevate/[0.04]">
                        <p className="text-[13px] text-paper">{a.label}</p>
                        <p className="text-[11px] text-gb-muted">{a.desc}</p>
                      </Link>
                    )
                  )}
                </div>
              </>
            )}
          </div>

          </div>

          {/* Wallet — connect once, stay connected while navigating between services */}
          <span className="hidden h-4 w-px bg-elevate/12 sm:inline-block" aria-hidden />
          {!mounted ? null : !address ? (
            <button
              onClick={openWallet}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/90 transition-colors hover:text-brassLight"
            >
              <Wallet className="h-3.5 w-3.5" /> Connect
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={openWallet}
                title="Wallet · account"
                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-emerald-400/80 transition-colors hover:text-emerald-300"
              >
                {/* ~10 chars of wide-tracked mono is far wider than the word "Connect",
                    which is why only the CONNECTED header wrapped to two lines. Below xl
                    it collapses to the icon; the title still names the account. */}
                <Wallet className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden xl:inline">{address.slice(0, 6)}…{address.slice(-4)}</span>
              </button>
              <button
                onClick={() => disconnect()}
                title="Disconnect"
                aria-label="Disconnect wallet"
                className="inline-flex items-center text-gb-muted transition-colors hover:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Light/dark — far right, after the wallet. */}
          <ThemeToggle className="shrink-0" />
        </nav>
      </div>
    </header>
  );
}
