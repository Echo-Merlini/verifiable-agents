"use client";

import { TopNav } from "@/components/TopNav";
import Link from "next/link";
import { ArrowRight, ScrollText } from "lucide-react";

// Audit Reports index — recomputable investigation reports, each a case study anyone can re-derive.
const REPORTS = [
  { href: "/reports/0g-teeml", title: "Is 0G TeeML actually enclave-executed?",
    tag: "0G · TEE", body: "Relay vs genuine enclave — the full chain of a live 0G mainnet inference, recomputed in your browser down to Intel's pinned root." },
  { href: "/reports/ens-write-mcp", title: "Can you trust an MCP that writes to ENS for you?",
    tag: "ENS · MCP", body: "Non-custodial + recompute-first: the calldata the MCP builds is byte-identical to the public ENS rules — re-derive it live." },
];

export default function ReportsIndex() {
  return (
    <main className="min-h-screen bg-deepink text-paper">
      <TopNav />
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
        <a href="https://verticecriativo.pt/audit" className="text-sm text-gb-muted hover:text-paper transition-colors">← Audit</a>
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80">Audit Reports</p>
        <h1 className="mt-4 font-display font-medium tracking-tightest text-4xl sm:text-5xl">
          Investigations you can <span className="brass-text">re-derive.</span>
        </h1>
        <p className="mt-4 text-gb-muted max-w-xl">
          Each report is a case study that recomputes its own claims — no trust in the finding, or in us. This is the
          deliverable format for a Vértice audit.
        </p>

        <div className="mt-10 space-y-3">
          {REPORTS.map((r) => (
            <Link key={r.href} href={r.href}
              className="group flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-brassLight/30">
              <div className="flex gap-4">
                <ScrollText className="mt-0.5 h-5 w-5 shrink-0 text-brassLight/80" />
                <div>
                  <p className="font-display text-lg text-paper">{r.title}</p>
                  <p className="mt-1 text-[13px] text-gb-muted">{r.body}</p>
                  <span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-wider text-slate/50">{r.tag}</span>
                </div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-brassLight/60 group-hover:text-brassLight" />
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
