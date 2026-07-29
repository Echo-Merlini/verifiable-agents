"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, ChevronDown, ExternalLink } from "lucide-react";
import { VerticeMark } from "@/components/VerticeMark";

// Lightweight top bar for the marketplace surfaces. The trust/proof surfaces are grouped under one
// "Audit" dropdown (stack verify · MCP conformance · reports · review gate) so the header stays clean
// and each is a distinct, sellable offering rather than a loose link.
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Demo" },
  { href: "/mint", label: "Mint" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/A2A", label: "A2A" },
  { href: "/console", label: "Console" },
];

const AUDIT = [
  { href: "/verify", label: "Stack Verify", desc: "recompute a live agent action" },
  { href: "/conformance", label: "MCP Conformance", desc: "recompute our MCPs" },
  { href: "/reports", label: "Audit Reports", desc: "recompute investigations" },
  { href: "/ledger", label: "The Ledger", desc: "public track record · verify offline" },
  { href: "/kit", label: "recompute-kit", desc: "the toolkit + offline verifier" },
  { href: "https://verticecriativo.pt/review-gate", label: "Review Gate", desc: "independent recomputable review", external: true },
];

export function TopNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const auditActive = AUDIT.some((a) => !a.external && path.startsWith(a.href));

  return (
    <header className="relative border-b border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-4 sm:px-6">
        <Link href="/demo" className="inline-flex items-center gap-2.5 font-display font-medium tracking-tight text-paper">
          <VerticeMark size={26} spin />
          Recomputable Agents
        </Link>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {LINKS.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
                  active ? "text-paper" : "text-gb-muted hover:text-paper"
                }`}
              >
                {l.label}
              </Link>
            );
          })}

          {/* Audit dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${auditActive || open ? "text-brassLight" : "text-brassLight/80 hover:text-brassLight"}`}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Audit <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" aria-label="close menu" onClick={() => setOpen(false)} />
                <div className="absolute right-0 z-20 mt-3 w-64 rounded-2xl border border-white/10 bg-deepink/95 p-2 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] backdrop-blur">
                  {AUDIT.map((a) =>
                    a.external ? (
                      <a key={a.href} href={a.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
                        className="flex items-start gap-2 rounded-xl px-3 py-2.5 hover:bg-white/[0.04]">
                        <div>
                          <p className="flex items-center gap-1 text-[13px] text-paper">{a.label} <ExternalLink className="h-3 w-3 text-gb-muted" /></p>
                          <p className="text-[11px] text-gb-muted">{a.desc}</p>
                        </div>
                      </a>
                    ) : (
                      <Link key={a.href} href={a.href} onClick={() => setOpen(false)}
                        className="block rounded-xl px-3 py-2.5 hover:bg-white/[0.04]">
                        <p className="text-[13px] text-paper">{a.label}</p>
                        <p className="text-[11px] text-gb-muted">{a.desc}</p>
                      </Link>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
