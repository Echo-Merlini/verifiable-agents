"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { VerticeMark } from "@/components/VerticeMark";

// Lightweight top bar for the marketplace surfaces, matching the /demo header. The
// wallet lives inline in each page's own flow (buy / connect), so this is nav only.
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Demo" },
  { href: "/mint", label: "Mint" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/conformance", label: "Gate" },
  { href: "/A2A", label: "A2A" },
  { href: "/console", label: "Console" },
];

export function TopNav() {
  const path = usePathname();
  return (
    <header className="border-b border-white/[0.06]">
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
          <Link
            href="/verify"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80 hover:text-brassLight"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Verify
          </Link>
        </nav>
      </div>
    </header>
  );
}
