"use client";

import { useState, useEffect, useCallback } from "react";
import { Network, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getGatewayUrl } from "@/hooks/useGatewayEnv";

// Every node's 6 tiers; attestations propagate across the mesh via Chainlink CCIP.
const MESH_TIERS: { key: string; label: string }[] = [
  { key: "signed", label: "signed" }, { key: "erc8004", label: "8004" }, { key: "wyriwe", label: "wyriwe" },
  { key: "erc8281", label: "8281" }, { key: "vni", label: "vni" }, { key: "onChain", label: "on-chain" },
];

export function AttestationMeshPanel() {
  const { token } = useAuth();
  const [data, setData] = useState<{ nodes: any[]; attestationIndex: string | null; nodeRegistry: string | null; chainId: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`${getGatewayUrl()}/admin/mesh/health`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const short = (a?: string | null) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "—");
  const explorer = data?.chainId === 11155111 ? "https://sepolia.etherscan.io" : "https://etherscan.io";
  // Only nodes that report their tier status (a node with no `tiers` block is a lighter
  // peer that doesn't publish the six tiers — tuck it rather than show empty pills).
  const nodes = (data?.nodes ?? []).filter((n) => n.tiers && Object.keys(n.tiers).length > 0);
  const online = nodes.filter((n) => n.online).length;

  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Network className="w-4 h-4 text-gb-accent" />
        <p className="text-sm font-semibold text-slate-100">Attestation Mesh</p>
        <span className="text-[10px] text-gb-muted">{online}/{nodes.length || "…"} online</span>
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1 text-xs text-gb-muted hover:text-slate-300 disabled:opacity-50">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
        </button>
      </div>
      <p className="text-xs text-gb-muted leading-relaxed">
        Every attestation this gateway signs is propagated across the mesh via Chainlink CCIP — no single node is the source of truth. Each node independently satisfies the six tiers, so any node can serve the recompute.
      </p>
      {err && <div className="flex items-start gap-2 text-red-400 text-xs"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {err}</div>}
      {nodes.length > 0 && (
        <div className="space-y-2">
          {nodes.map((n, i) => (
            <div key={i} className="border border-gb-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${n.online ? "bg-emerald-400" : "bg-red-400/60"}`} />
                <span className="font-mono text-xs text-slate-300 truncate">{(n.url || "").replace(/^https?:\/\//, "") || "—"}</span>
                {n.isLocal && <span className="text-[9px] px-1.5 py-0.5 rounded border text-gb-accent border-gb-accent/30 shrink-0">this node</span>}
                {typeof n.records === "number" && <span className="ml-auto text-[10px] text-gb-muted shrink-0">{n.records} records</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MESH_TIERS.map(({ key, label }) => {
                  const ok = n.tiers?.[key];
                  return (
                    <span key={key} className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${ok ? "text-emerald-400 border-emerald-400/30" : "text-gb-muted border-gb-border"}`}>
                      {ok ? "✓" : "·"} {label}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && nodes.length === 0 && !err && <p className="text-xs text-gb-muted">No mesh nodes reporting.</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[10px] text-gb-muted">
        {data?.attestationIndex && <span>AttestationIndex <a href={`${explorer}/address/${data.attestationIndex}`} target="_blank" rel="noreferrer" className="font-mono text-brassLight hover:text-brass">{short(data.attestationIndex)}</a></span>}
        {data?.nodeRegistry && <span>NodeRegistry <a href={`${explorer}/address/${data.nodeRegistry}`} target="_blank" rel="noreferrer" className="font-mono text-brassLight hover:text-brass">{short(data.nodeRegistry)}</a></span>}
        <span>· anchored on mainnet</span>
      </div>
    </div>
  );
}
