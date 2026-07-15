"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getGatewayUrl } from "@/hooks/useGatewayEnv";
import { ShieldCheck, ShieldX, Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

interface ApprovalRow {
  id: string;
  job_id: string;
  agent_registry: string;
  agent_id: string;
  owner_address: string;
  tx_data: string;
  risk_summary: string;
  status: "pending" | "approved" | "declined";
  reason?: string;
  note?: string;
  created_at: number;
  resolved_at?: number;
}

const DECLINE_REASONS = [
  { value: "user_rejected",         label: "User rejected" },
  { value: "slippage_too_high",      label: "Slippage too high" },
  { value: "contract_unverified",    label: "Contract unverified" },
  { value: "suspicious_destination", label: "Suspicious destination" },
  { value: "amount_too_large",       label: "Amount too large" },
  { value: "unknown",                label: "Other / unknown" },
];

function elapsed(ts: number) {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60)   return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  return Math.floor(s / 3600) + "h ago";
}

function TxCard({ approval, onResolved }: { approval: ApprovalRow; onResolved: () => void }) {
  const { token } = useAuth();
  const [working, setWorking]     = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason]       = useState("user_rejected");
  const [note, setNote]           = useState("");
  const [, tick]                  = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  let txData: { tool?: string; input?: Record<string, unknown> } = {};
  try { txData = JSON.parse(approval.tx_data); } catch {}

  const resolve = async (status: "approved" | "declined") => {
    setWorking(true);
    try {
      const r = await fetch(getGatewayUrl() + "/admin/approvals/" + approval.id + "/resolve", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: status === "declined" ? reason : undefined, note: note || undefined }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      onResolved();
    } catch (e: any) { alert(e.message); }
    setWorking(false);
  };

  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gb-border bg-amber-500/5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-semibold text-amber-300">Awaiting Approval</span>
        </div>
        <span className="text-xs text-gb-muted font-mono">{elapsed(approval.created_at)}</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-gb-muted uppercase tracking-wide text-[10px] font-semibold mb-0.5">Agent</p>
            <p className="text-slate-300 font-mono truncate">{approval.agent_registry ? approval.agent_registry.slice(0,6) + "..." + approval.agent_registry.slice(-4) + " / #" + approval.agent_id : "—"}</p>
          </div>
          <div>
            <p className="text-gb-muted uppercase tracking-wide text-[10px] font-semibold mb-0.5">Owner</p>
            <p className="text-slate-300 font-mono truncate">{approval.owner_address ? approval.owner_address.slice(0,6) + "..." + approval.owner_address.slice(-4) : "—"}</p>
          </div>
        </div>
        <div>
          <p className="text-gb-muted uppercase tracking-wide text-[10px] font-semibold mb-1">Tool</p>
          <span className="inline-block bg-gb-accentD/20 border border-gb-accentD/30 text-gb-accent text-xs px-2.5 py-1 rounded-md font-mono">{txData.tool ?? "unknown"}</span>
        </div>
        {txData.input && Object.keys(txData.input).length > 0 && (
          <div>
            <p className="text-gb-muted uppercase tracking-wide text-[10px] font-semibold mb-1">Parameters</p>
            <pre className="bg-gb-bg border border-gb-border rounded-lg px-3 py-2 text-[10px] text-slate-400 overflow-auto max-h-28 font-mono whitespace-pre-wrap">{JSON.stringify(txData.input, null, 2)}</pre>
          </div>
        )}
        {approval.risk_summary && (
          <div>
            <p className="text-gb-muted uppercase tracking-wide text-[10px] font-semibold mb-1">Risk Summary</p>
            <p className="text-xs text-slate-300 leading-relaxed">{approval.risk_summary}</p>
          </div>
        )}
        {declining && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-slate-300">Decline reason</p>
            <div className="flex flex-wrap gap-1.5">
              {DECLINE_REASONS.map(r => (
                <button key={r.value} onClick={() => setReason(r.value)}
                  className={"text-xs px-2.5 py-1 rounded-full border transition-colors " + (reason === r.value ? "bg-red-500/20 border-red-500/40 text-red-300" : "border-gb-border text-gb-muted hover:text-slate-300")}>
                  {r.label}
                </button>
              ))}
            </div>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="Optional note to agent (explain what to do differently)"
              className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-gb-muted outline-none focus:border-red-500/50" />
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {!declining ? (
            <>
              <button onClick={() => resolve("approved")} disabled={working}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-300 disabled:opacity-40 transition-colors">
                {working ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Approve
              </button>
              <button onClick={() => setDeclining(true)} disabled={working}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 disabled:opacity-40 transition-colors">
                <ShieldX className="w-3.5 h-3.5" /> Decline
              </button>
            </>
          ) : (
            <>
              <button onClick={() => resolve("declined")} disabled={working}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 disabled:opacity-40 transition-colors">
                {working ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldX className="w-3.5 h-3.5" />}
                Confirm Decline
              </button>
              <button onClick={() => { setDeclining(false); setNote(""); }} disabled={working}
                className="text-xs px-4 py-2 rounded-lg border border-gb-border text-gb-muted hover:text-slate-300 transition-colors">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const { token } = useAuth();
  const [tab, setTab]         = useState<"pending" | "history">("pending");
  const [pending, setPending] = useState<ApprovalRow[]>([]);
  const [history, setHistory] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPending = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(getGatewayUrl() + "/admin/approvals/pending", {
        headers: { Authorization: "Bearer " + token },
      });
      setPending(await r.json());
    } catch {}
  }, [token]);

  const loadHistory = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(getGatewayUrl() + "/admin/approvals/all?limit=50", {
        headers: { Authorization: "Bearer " + token },
      });
      setHistory(await r.json());
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadPending();
    const id = setInterval(loadPending, 3000);
    return () => clearInterval(id);
  }, [loadPending]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  const onResolved = () => { loadPending(); loadHistory(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-gb-accent" />
            Transaction Approvals
          </h1>
          <p className="text-xs text-gb-muted mt-0.5">Review and approve write operations requested by AI agents</p>
        </div>
        <button onClick={() => { loadPending(); if (tab === "history") loadHistory(); }}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gb-border text-gb-muted hover:text-slate-300 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex gap-1 bg-gb-surface border border-gb-border rounded-lg p-1 w-fit">
        <button onClick={() => setTab("pending")}
          className={"flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-md transition-colors " + (tab === "pending" ? "bg-gb-accentD text-white" : "text-gb-muted hover:text-slate-300")}>
          <Clock className="w-3.5 h-3.5" />
          Pending
          {pending.length > 0 && (
            <span className="bg-amber-500 text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{pending.length}</span>
          )}
        </button>
        <button onClick={() => setTab("history")}
          className={"text-xs px-4 py-1.5 rounded-md transition-colors " + (tab === "history" ? "bg-gb-accentD text-white" : "text-gb-muted hover:text-slate-300")}>
          History
        </button>
      </div>

      {tab === "pending" && (
        pending.length === 0 ? (
          <div className="text-center py-16 text-gb-muted text-sm space-y-2">
            <ShieldCheck className="w-8 h-8 mx-auto text-gb-border" />
            <p>No pending approvals</p>
            <p className="text-xs">Agent write operations will appear here when triggered.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {pending.map(a => <TxCard key={a.id} approval={a} onResolved={onResolved} />)}
          </div>
        )
      )}

      {tab === "history" && (
        <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gb-muted text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gb-muted text-sm">No resolved approvals yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gb-border text-gb-muted text-xs uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-medium">Status</th>
                    <th className="text-left px-5 py-3 font-medium">Tool</th>
                    <th className="text-left px-5 py-3 font-medium">Agent</th>
                    <th className="text-left px-5 py-3 font-medium">Reason</th>
                    <th className="text-left px-5 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gb-border">
                  {history.map(a => {
                    let txData: { tool?: string } = {};
                    try { txData = JSON.parse(a.tx_data); } catch {}
                    return (
                      <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          {a.status === "approved" ? (
                            <span className="flex items-center gap-1.5 text-xs text-green-400"><CheckCircle2 className="w-3.5 h-3.5" /> Approved</span>
                          ) : a.status === "declined" ? (
                            <span className="flex items-center gap-1.5 text-xs text-red-400"><XCircle className="w-3.5 h-3.5" /> Declined</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs text-amber-400"><Clock className="w-3.5 h-3.5" /> Pending</span>
                          )}
                        </td>
                        <td className="px-5 py-3"><span className="text-xs font-mono text-gb-accent">{txData.tool ?? "—"}</span></td>
                        <td className="px-5 py-3 text-xs text-gb-muted font-mono">{a.agent_registry ? a.agent_registry.slice(0,6) + "…/" + a.agent_id : "—"}</td>
                        <td className="px-5 py-3 text-xs text-gb-muted">{a.reason ?? "—"}{a.note ? " — " + a.note : ""}</td>
                        <td className="px-5 py-3 text-xs text-gb-muted">{elapsed(a.resolved_at ?? a.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
