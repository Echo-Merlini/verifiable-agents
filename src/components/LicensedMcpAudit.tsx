"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, HelpCircle, Loader2, Lock } from "lucide-react";
import { fetchMcpAudit, type McpAudit, type AuditVerdict } from "@/lib/marketplace";

const EXPLORER: Record<number, string> = { 1: "https://etherscan.io", 84532: "https://sepolia.basescan.org" };

const VERDICT: Record<AuditVerdict, { text: string; dot: string; label: string }> = {
  clean:     { text: "text-emerald-300", dot: "bg-emerald-400", label: "licensed" },
  violation: { text: "text-rose-300",    dot: "bg-rose-400",    label: "unlicensed" },
  unknown:   { text: "text-amber-200",   dot: "bg-amber-300",   label: "unknown" },
};

// The least-privilege audit: did the agent invoke only MCP capabilities it was entitled to?
// Recomputed from the action log + on-chain isEntitled — a control the owner or any auditor
// can re-run. This is the compliance face of the same primitive the marketplace store sells.
export function LicensedMcpAudit({ registry, agentId }: { registry: string; agentId: string }) {
  const [audit, setAudit] = useState<McpAudit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchMcpAudit(registry, agentId).then((a) => { if (alive) { setAudit(a); setLoading(false); } });
    return () => { alive = false; };
  }, [registry, agentId]);

  if (loading) {
    return (
      <div className="liquid-glass flex items-center gap-2 rounded-2xl p-5 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Recomputing licensed-MCP audit…
      </div>
    );
  }
  if (!audit) {
    return (
      <div className="liquid-glass rounded-2xl p-5 text-sm text-zinc-400">
        Audit unavailable right now — the entitlement contract read failed. Fails closed.
      </div>
    );
  }

  const { summary } = audit;
  const headline: AuditVerdict = summary.violation > 0 ? "violation" : summary.unknown > 0 ? "unknown" : "clean";
  const v = VERDICT[headline];
  const explorer = EXPLORER[audit.recompute.chainId] ?? EXPLORER[1];

  return (
    <div className="liquid-glass rounded-2xl p-5">
      <div className="flex items-start gap-3">
        {headline === "clean" ? <ShieldCheck className={`h-6 w-6 ${v.text}`} />
          : headline === "violation" ? <ShieldAlert className={`h-6 w-6 ${v.text}`} />
          : <HelpCircle className={`h-6 w-6 ${v.text}`} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold">Licensed-MCP audit</h3>
            <Lock className="h-3.5 w-3.5 text-zinc-600" />
          </div>
          <p className={`text-sm ${v.text}`}>
            {headline === "clean" && `All ${summary.actions} action${summary.actions === 1 ? "" : "s"} used only licensed capabilities.`}
            {headline === "violation" && `${summary.violation} action${summary.violation === 1 ? "" : "s"} invoked an unlicensed MCP.`}
            {headline === "unknown" && `${summary.unknown} action${summary.unknown === 1 ? "" : "s"} could not be verified (entitlement unreadable).`}
          </p>
        </div>
        <div className="flex gap-1.5 font-mono text-[11px]">
          <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-emerald-300">{summary.clean}✓</span>
          {summary.violation > 0 && <span className="rounded bg-rose-400/10 px-1.5 py-0.5 text-rose-300">{summary.violation}✕</span>}
          {summary.unknown > 0 && <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-amber-200">{summary.unknown}?</span>}
        </div>
      </div>

      {/* Per-action rows that touched a premium capability (base-only actions are trivially clean) */}
      {(() => {
        const notable = audit.rows.filter((r) => r.premiumUsed.length > 0);
        if (notable.length === 0) {
          return <p className="mt-3 text-[11px] text-zinc-500">No premium capabilities invoked in the last {audit.rows.length} actions — nothing to gate.</p>;
        }
        return (
          <ul className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3">
            {notable.slice(0, 8).map((r) => {
              const rv = VERDICT[r.verdict];
              return (
                <li key={r.id} className="flex items-center gap-2 text-xs">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${rv.dot}`} />
                  <span className="font-mono text-zinc-500">#{r.id}</span>
                  <span className="text-zinc-400">{r.actionType}</span>
                  <span className="ml-auto flex flex-wrap items-center justify-end gap-1">
                    {r.premiumUsed.map((u, i) => (
                      <span key={i} className={`font-mono text-[10px] ${VERDICT[u.entitled === false ? "violation" : u.entitled === null ? "unknown" : "clean"].text}`}>
                        {u.tool}
                      </span>
                    ))}
                    <span className={`ml-1 text-[10px] uppercase tracking-wider ${rv.text}`}>{rv.label}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        );
      })()}

      <p className="mt-4 border-t border-white/[0.06] pt-3 font-mono text-[10px] leading-relaxed text-zinc-500">
        recompute: {audit.recompute.method}
        {audit.recompute.contract && (
          <> · <a href={`${explorer}/address/${audit.recompute.contract}`} target="_blank" rel="noreferrer" className="text-brassLight hover:underline">registry</a></>
        )}
      </p>
    </div>
  );
}
