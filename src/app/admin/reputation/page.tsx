"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Bot, Gauge } from "lucide-react";
import { fetchMarketAgents, type MarketAgent } from "@/lib/marketplace";
import { ReputationBreakdown } from "@/components/ReputationBreakdown";
import { LicensedMcpAudit } from "@/components/LicensedMcpAudit";

// Admin Reputation tab — the owner/auditor view over the recomputable reputation predicate:
// per-agent breakdown (delivered / refunded / stale, Wilson floor, job→agent binding) and the
// licensed-MCP audit. Every figure is recomputed from public chain data via the gateway.
export default function AdminReputationPage() {
  const [agents, setAgents] = useState<MarketAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    fetchMarketAgents().then((list) => {
      setAgents(list);
      setLoading(false);
      if (list.length) setRef(`${list[0].registry}:${list[0].agentId}`);
    });
  }, []);

  const selected = useMemo(() => agents.find((a) => `${a.registry}:${a.agentId}` === ref) ?? null, [agents, ref]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-100">
          <Gauge className="h-5 w-5 text-brassLight" /> Reputation
        </h1>
        <p className="mt-0.5 text-xs text-gb-muted">
          Recomputable reputation per agent — a predicate over public ConsultEscrow settlements, not an opinion.
          Delivered vs refunded, Wilson lower bound, and the recomputable job→agent binding.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gb-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : agents.length === 0 ? (
        <div className="liquid-glass rounded-xl p-6 text-sm text-gb-muted">No agents published yet.</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {agents.map((a) => {
              const r = `${a.registry}:${a.agentId}`;
              const active = r === ref;
              return (
                <button
                  key={r}
                  onClick={() => setRef(r)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
                    active ? "bg-white/[0.08] text-slate-100 ring-1 ring-brass/40" : "bg-white/[0.02] text-gb-muted ring-1 ring-white/[0.05] hover:bg-white/[0.05]"
                  }`}
                >
                  <Bot className="h-3.5 w-3.5" /> {a.name || `#${a.agentId}`}
                  <span className="font-mono text-[10px] text-gb-muted">#{a.agentId}</span>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ReputationBreakdown rep={selected.reputation} />
              <LicensedMcpAudit registry={selected.registry} agentId={selected.agentId} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
