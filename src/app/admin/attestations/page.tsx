"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getGatewayUrl } from "@/hooks/useGatewayEnv";
import { ShieldCheck, RefreshCw, Loader2, AlertTriangle, CheckCircle2, Link2, Network, ExternalLink } from "lucide-react";

const IDENTITY_SENTINEL = "8116eec29078e8f57c07077d5e8080a35bde73036581df3abb93755d1b1a16ea";
const L3_EXPLORER = "https://sepolia.basescan.org/tx/";
const RESOLVER_V2 = "0xB300e09e6C4f901409B809e7924CF68A2A429014";
const ETHERSCAN_URL = "https://etherscan.io/address/0xB300e09e6C4f901409B809e7924CF68A2A429014";

interface AttestationRow {
  id: number;
  skill_id: string | null;
  session_id: string | null;
  registry: string | null;
  agent_id: string | null;
  action_type: string;
  raw_input_hash: string | null;
  sanitization_pipeline_hash: string | null;
  input_hash: string | null;
  output_hash: string | null;
  manifest_hash: string | null;
  l4_signature: string | null;
  l3_tx: string | null;
  caller_depth: number;
  error_message: string | null;
  duration_ms: number | null;
  created_at: number;
}

function elapsed(ts: number) {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60)    return s + "s ago";
  if (s < 3600)  return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function short(h: string | null) {
  if (!h) return "—";
  return h.slice(0, 8) + "…";
}

const ACTION_COLORS: Record<string, string> = {
  chat:         "text-gb-accent bg-gb-accentD/20 border-gb-accentD/30",
  tool_call:    "text-amber-300 bg-amber-500/10 border-amber-500/20",
  a2a_call:     "text-amber-300 bg-amber-500/10 border-amber-500/20",
  ccip_resolve: "text-amber-300 bg-amber-500/10 border-amber-500/20",
};

function PipelineBadge({ row }: { row: AttestationRow }) {
  const { sanitization_pipeline_hash, raw_input_hash, input_hash } = row;
  if (!sanitization_pipeline_hash) return <span className="text-[10px] text-gb-muted">—</span>;
  if (sanitization_pipeline_hash === IDENTITY_SENTINEL) {
    return (
      <span
        title={`Identity sentinel — no transformation applied\n${sanitization_pipeline_hash}`}
        className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono cursor-default"
      >
        identity
      </span>
    );
  }
  if (raw_input_hash && input_hash && raw_input_hash !== input_hash) {
    return (
      <span
        title={`Sanitization pipeline applied\n${sanitization_pipeline_hash}`}
        className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono cursor-default"
      >
        <AlertTriangle className="w-3 h-3" /> sanitized
      </span>
    );
  }
  return (
    <span
      title={sanitization_pipeline_hash}
      className="text-[10px] text-gb-muted font-mono cursor-default"
    >
      {short(sanitization_pipeline_hash)}
    </span>
  );
}

function OnchainBadges({ row }: { row: AttestationRow }) {
  return (
    <div className="flex items-center gap-1.5">
      {row.l3_tx ? (
        <a
          href={L3_EXPLORER + row.l3_tx}
          target="_blank"
          rel="noopener noreferrer"
          title={`L3 — ERC-8281 OCP anchor (pre-execution)\n${row.l3_tx}`}
          className="flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono hover:bg-amber-500/20 transition-colors"
        >
          <Link2 className="w-2.5 h-2.5" /> L3
        </a>
      ) : (
        <span className="text-[10px] text-gb-muted/40 px-1.5 py-0.5 rounded border border-gb-border font-mono">L3</span>
      )}
      {row.l4_signature ? (
        <span
          title={`L4 — KYA inference attestation · EIP-712 (ERC-8299 WYRIWE shape)\n${row.l4_signature.slice(0, 20)}…`}
          className="flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono cursor-default"
        >
          <CheckCircle2 className="w-2.5 h-2.5" /> L4
        </span>
      ) : (
        <span className="text-[10px] text-gb-muted/40 px-1.5 py-0.5 rounded border border-gb-border font-mono">L4</span>
      )}
    </div>
  );
}


type GwTier = { signed?: boolean; erc8004?: boolean; wyriwe?: boolean; ocp?: boolean; vni?: boolean; onChain?: boolean };
function TierPill({ active, label, color }: { active?: boolean; label: string; color: string }) {
  return <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${active ? color + " border-current/30" : "text-gb-muted/40 border-gb-border"}`}>{label}</span>;
}
function SpecPanel() {
  const [tiers, setTiers] = useState<GwTier | null>(null);
  useEffect(() => {
    fetch("https://gateway.ensub.org/health", { signal: AbortSignal.timeout(6000) })
      .then(r => r.json()).then(d => setTiers(d.tiers ?? null)).catch(() => {});
  }, []);
  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl px-5 py-4 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2 shrink-0">
        <Network className="w-4 h-4 text-gb-accent" />
        <span className="text-xs font-semibold text-slate-100">Infrastructure</span>
      </div>
      <div className="flex items-center gap-1.5 bg-gb-bg rounded-lg px-3 py-1.5">
        <span className="text-[11px] font-mono text-gb-faint">{RESOLVER_V2.slice(0,10) + "..." + RESOLVER_V2.slice(-6)}</span>
        <a href={ETHERSCAN_URL} target="_blank" rel="noopener noreferrer" className="text-gb-muted hover:text-gb-accent"><ExternalLink className="w-3 h-3" /></a>
      </div>
      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">3 signers</span>
      {tiers && (
        <div className="flex flex-wrap gap-1">
          <TierPill active={tiers.signed}  label="signed"          color="text-emerald-400" />
          <TierPill active={tiers.vni}     label="ERC-8294 VNI"    color="text-amber-400" />
          <TierPill active={tiers.erc8004} label="ERC-8004"        color="text-amber-400" />
          <TierPill active={tiers.wyriwe}  label="ERC-8299 WYRIWE" color="text-amber-400" />
          <TierPill active={tiers.ocp}     label="ERC-8281 OCP"    color="text-pink-400" />
        </div>
      )}
    </div>
  );
}

export default function AttestationsPage() {
  const { token } = useAuth();
  const [rows, setRows]               = useState<AttestationRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [actionType, setActionType]   = useState("");
  const [registry, setRegistry]       = useState("");
  const [agentId, setAgentId]         = useState("");

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setPage(1);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (actionType) params.set("actionType", actionType);
      if (registry)   params.set("registry",   registry);
      if (agentId)    params.set("agentId",     agentId);
      const r = await fetch(getGatewayUrl() + "/admin/attestations?" + params.toString(), {
        headers: { Authorization: "Bearer " + token },
      });
      setRows(await r.json());
    } catch {}
    setLoading(false);
  }, [token, actionType, registry, agentId]);

  useEffect(() => { load(); }, [load]);

  const anchored = rows.filter(r => r.l3_tx).length;
  const signed   = rows.filter(r => r.l4_signature).length;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows   = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <SpecPanel />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-gb-accent" />
            Execution Attestations
          </h1>
          <p className="text-xs text-gb-muted mt-0.5">
            Hash-based audit log — chat, tool calls, A2A, CCIP. L3 = OCP on-chain commitment · L4 = EIP-712 agent signature
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gb-border text-gb-muted hover:text-slate-300 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={actionType} onChange={e => setActionType(e.target.value)}
          className="bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-gb-accent">
          <option value="">All types</option>
          <option value="chat">chat</option>
          <option value="tool_call">tool_call</option>
          <option value="a2a_call">a2a_call</option>
          <option value="ccip_resolve">ccip_resolve</option>
        </select>
        <input value={registry} onChange={e => setRegistry(e.target.value)}
          placeholder="Registry address…"
          className="bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent w-52" />
        <input value={agentId} onChange={e => setAgentId(e.target.value)}
          placeholder="Agent ID…"
          className="bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent w-28" />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {(["chat", "tool_call", "a2a_call", "ccip_resolve"] as const).map(t => (
          <div key={t} onClick={() => setActionType(t === actionType ? "" : t)}
            className="bg-gb-surface border border-gb-border rounded-xl px-4 py-3 cursor-pointer hover:border-gb-accent/40 transition-colors">
            <p className="text-[10px] text-gb-muted uppercase tracking-wide mb-1">{t}</p>
            <p className="text-lg font-semibold text-slate-100">{rows.filter(r => r.action_type === t).length}</p>
          </div>
        ))}
        <div className="bg-gb-surface border border-amber-500/20 rounded-xl px-4 py-3">
          <p className="text-[10px] text-amber-400 uppercase tracking-wide mb-1">L3 anchored</p>
          <p className="text-lg font-semibold text-slate-100">{anchored}</p>
        </div>
        <div className="bg-gb-surface border border-amber-500/20 rounded-xl px-4 py-3">
          <p className="text-[10px] text-amber-400 uppercase tracking-wide mb-1">L4 signed</p>
          <p className="text-lg font-semibold text-slate-100">{signed}</p>
        </div>
      </div>

      {/* Conformance legend — each field maps to the recompute-kit recipe that verifies it.
          Spine hashes are keccak256(utf8) so an external auditor can recompute them green. */}
      <div className="bg-gb-surface border border-emerald-500/20 rounded-xl px-4 py-3 mb-4">
        <p className="text-[10px] text-emerald-400 uppercase tracking-wide mb-2">
          Composition-note conformance — verifiable via recompute-kit
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-gb-muted font-mono">
          <span><span className="text-slate-300">Raw input</span> = keccak256(utf8(query)) → <span className="text-emerald-400">wyriwe/raw</span></span>
          <span><span className="text-slate-300">Pipeline</span> → <span className="text-amber-300">wyriwe/pipeline</span></span>
          <span><span className="text-slate-300">Output</span> = keccak256(utf8(reply)) → spine</span>
          <span><span className="text-slate-300">L3</span> = OCP record(inputHash) → <span className="text-amber-400">8263/precedence</span></span>
          <span><span className="text-slate-300">L4</span> = EIP-712 KYA attestation → <span className="text-amber-400">8275/reputation</span></span>
        </div>
        <p className="text-[10px] text-gb-muted/70 mt-2 font-mono">
          Spine = keccak256(utf8) per §5 Step 3. Recompute any entry: point the wired recompute-kit MCP at the preimage.
        </p>
      </div>

      {/* Table */}
      <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gb-muted text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-gb-muted text-sm">No attestations yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gb-border text-gb-muted text-[10px] uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Agent</th>
                  <th className="text-left px-4 py-3 font-medium">Raw input</th>
                  <th className="text-left px-4 py-3 font-medium">Input</th>
                  <th className="text-left px-4 py-3 font-medium">Pipeline</th>
                  <th className="text-left px-4 py-3 font-medium">Output</th>
                  <th className="text-left px-4 py-3 font-medium">On-chain</th>
                  <th className="text-left px-4 py-3 font-medium">Error</th>
                  <th className="text-left px-4 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gb-border">
                {pageRows.map(row => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${ACTION_COLORS[row.action_type] ?? "text-gb-muted border-gb-border"}`}>
                        {row.action_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-gb-muted font-mono">
                      {row.registry
                        ? row.registry.slice(0, 6) + "…/" + (row.agent_id ?? "?")
                        : row.skill_id ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-gb-muted font-mono" title={row.raw_input_hash ?? ""}>
                      {short(row.raw_input_hash)}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-gb-muted font-mono" title={row.input_hash ?? ""}>
                      {short(row.input_hash)}
                    </td>
                    <td className="px-4 py-2.5">
                      <PipelineBadge row={row} />
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-gb-muted font-mono" title={row.output_hash ?? ""}>
                      {short(row.output_hash)}
                    </td>
                    <td className="px-4 py-2.5">
                      <OnchainBadges row={row} />
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-red-400 max-w-[120px] truncate">
                      {row.error_message ?? ""}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-gb-muted whitespace-nowrap">
                      {elapsed(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gb-border">
            <span className="text-[11px] text-gb-muted">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-[11px] px-3 py-1.5 rounded-lg border border-gb-border text-gb-muted hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >← Back</button>
              <span className="text-[11px] text-gb-muted font-mono">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-[11px] px-3 py-1.5 rounded-lg border border-gb-border text-gb-muted hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
