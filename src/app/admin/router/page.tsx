"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getGatewayUrl } from "@/hooks/useGatewayEnv";
import { Network, RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink, Copy, Check, Activity, Share2, GitBranch, Package, Send, Clock, Coins } from "lucide-react";

const RESOLVER_V2  = "0xB300e09e6C4f901409B809e7924CF68A2A429014";
const ETHERSCAN    = `https://etherscan.io/address/${RESOLVER_V2}`;
const L3_EXPLORER  = "https://sepolia.basescan.org/tx/";

const NODES = [
  { label: "ENS Boiler",   role: "gateway", url: "https://gateway.ensub.org",                         signer: "0x85Fa13511D170FBe173761b63D7f8DD4A6f6Bf1A", health: "https://gateway.ensub.org/health" },
  { label: "NAS Node",     role: "router",  url: "https://gateway.gen-plasma.com",                     signer: "0x58766f90eDe2419fEaFd97c28bb0f0dDf951Dc54", health: "https://gateway.gen-plasma.com/health" },
  { label: "Railway Node", role: "router",  url: "https://ccip-router-production.up.railway.app",      signer: "0x2048eADf6b99549DAB0C536Bf52B3A7B9E540F76", health: "https://ccip-router-production.up.railway.app/health" },
  { label: "Damon's Node", role: "router",  url: "https://ccip-router-production-3506.up.railway.app", signer: "0x5e4F655f10bf009b15f76Cc62466e2198fcD54d1", health: "https://ccip-router-production-3506.up.railway.app/health" },
];

type Tier = { signed: boolean; erc8004: boolean; wyriwe: boolean; erc8281?: boolean; ocp?: boolean; vni: boolean; onChain: boolean };
type PeerInfo = { url: string; healthy: boolean; nodeVersion: string | null; signerAddress: string | null; lastSyncAt: number };

type NodeHealth = {
  ok: boolean;
  version?: string;
  signerAddress?: string;
  nodeUrl?: string;
  tiers?: Tier;
  peers?: PeerInfo[];
  records?: number;
  error?: string;
};

type Contribution = { source: string; records: number };

type MeshStatus = {
  configured: boolean;
  registered: boolean;
  registeredUrl: string | null;
  signerAddress: string;
  gatewayUrl: string;
  routers: string[];
  reason?: string;
  error?: string;
};

type AttestationRow = {
  id: number;
  action_type: string;
  input_hash: string | null;
  l4_signature: string | null;
  l3_tx: string | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: number;
};

function elapsed(ts: number) {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60)    return s + "s ago";
  if (s < 3600)  return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

const TIER_BORDER: Record<string, string> = {
  "text-emerald-400": "border-emerald-400/30",
  "text-amber-400": "border-amber-400/30",
  "text-pink-400": "border-pink-400/30",
};

function TierBadge({ active, label, color }: { active: boolean; label: string; color: string }) {
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
      active ? `${color} ${TIER_BORDER[color] ?? "border-current/20"}` : "text-gb-muted/40 border-gb-border"
    }`}>
      {label}
    </span>
  );
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded text-gb-muted hover:text-slate-300 transition-colors shrink-0">
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function NodeCard({ node, health, loading }: { node: typeof NODES[0]; health: NodeHealth | null; loading: boolean }) {
  const tiers = health?.tiers;
  const isUp  = health?.ok === true;
  const noHealth = !node.health;

  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {noHealth ? (
              <AlertCircle className="w-3.5 h-3.5 text-gb-muted/40 shrink-0" />
            ) : loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gb-muted shrink-0" />
            ) : isUp ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            )}
            <p className="text-sm font-semibold text-slate-100 truncate">{node.label}</p>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 whitespace-nowrap ${
              node.role === "gateway"
                ? "text-amber-400 border-amber-400/30"
                : "text-amber-400 border-amber-400/30"
            }`}>{node.role}</span>
            {health?.version && <span className="text-[10px] text-gb-muted font-mono shrink-0">v{health.version}</span>}
          </div>
          <p className="text-[11px] text-gb-muted font-mono mt-0.5 truncate">{node.url || "url pending"}</p>
        </div>
        {node.url && (
          <a href={node.url} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded text-gb-muted hover:text-slate-300 transition-colors shrink-0">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {tiers && (
        <div className="flex flex-wrap gap-1.5">
          <TierBadge active={tiers.signed}  label="signed"          color="text-emerald-400" />
          <TierBadge active={tiers.vni}     label="ERC-8294 VNI"    color="text-amber-400" />
          <TierBadge active={tiers.erc8004} label="ERC-8004"        color="text-amber-400" />
          <TierBadge active={tiers.wyriwe}  label="ERC-8299 WYRIWE" color="text-amber-400" />
          <TierBadge active={!!(tiers.erc8281 ?? tiers.ocp)} label="ERC-8281 OCP" color="text-pink-400" />
          <TierBadge active={tiers.onChain} label="on-chain"        color="text-amber-400" />
        </div>
      )}

      {health && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gb-bg rounded-lg px-3 py-2">
            <p className="text-[10px] text-gb-muted uppercase tracking-wide">Records</p>
            <p className="text-base font-semibold text-slate-100 mt-0.5">{health.records ?? "—"}</p>
          </div>
          <div className="bg-gb-bg rounded-lg px-3 py-2">
            <p className="text-[10px] text-gb-muted uppercase tracking-wide">Mesh peers</p>
            <p className="text-base font-semibold text-slate-100 mt-0.5">{health.peers?.length ?? "—"}</p>
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] text-gb-muted uppercase tracking-wide mb-1">Signer</p>
        <div className="flex items-center gap-1.5 bg-gb-bg rounded-lg px-3 py-2">
          <span className="text-[11px] text-gb-faint font-mono flex-1 break-all">{node.signer}</span>
          <CopyBtn value={node.signer} />
        </div>
      </div>

      {health?.peers && health.peers.filter(p => p.healthy || p.lastSyncAt > 0).length > 0 && (
        <div>
          <p className="text-[10px] text-gb-muted uppercase tracking-wide mb-1.5">Peer sync</p>
          <div className="space-y-1">
            {health.peers.filter(p => p.healthy || p.lastSyncAt > 0).map(p => (
              <div key={p.url} className="flex items-center justify-between text-[11px] text-gb-muted">
                <span className="font-mono truncate max-w-[200px]">{p.url.replace(/^https?:\/\//, "")}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.healthy
                    ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    : <AlertCircle  className="w-2.5 h-2.5 text-amber-400" />}
                  <span>{p.lastSyncAt ? elapsed(p.lastSyncAt) : "never"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {health?.error && <p className="text-xs text-red-400">{health.error}</p>}
    </div>
  );
}

export default function RouterPage() {
  const { token } = useAuth();
  const [healths, setHealths]           = useState<(NodeHealth | null)[]>([null, null, null, null]);
  const [loading, setLoading]           = useState(true);
  const [contributions, setContribs]    = useState<Contribution[]>([]);
  const [attestations, setAttestations] = useState<AttestationRow[]>([]);
  const [logsLoading, setLogsLoading]   = useState(false);
  const [copiedResolver, setCopiedResolver] = useState(false);
  const [meshStatus, setMeshStatus]     = useState<MeshStatus | null>(null);
  const [joining, setJoining]           = useState(false);
  const [joinResult, setJoinResult]     = useState<{ ok: boolean; message: string } | null>(null);
  const [selectedRouter, setSelectedRouter]   = useState<string>("");
  const [snapshotStatus, setSnapshotStatus]   = useState<"pending" | "signed" | "submitted" | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(
      NODES.map(async (n) => {
        if (!n.health) return null;
        try {
          const r = await fetch(n.health, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) return { ok: false, error: `HTTP ${r.status}` } as NodeHealth;
          return await r.json() as NodeHealth;
        } catch (e: any) {
          return { ok: false, error: e.message ?? "unreachable" } as NodeHealth;
        }
      })
    );
    setHealths(results);
    setLoading(false);
  }, []);

  const fetchLocalData = useCallback(async () => {
    if (!token) return;
    setLogsLoading(true);
    try {
      const period = Math.floor(Math.floor(Date.now() / 1000) / 604800);
      const [contribRes, attestRes, meshRes, snapRes] = await Promise.all([
        fetch(`${getGatewayUrl()}/contributions`),
        fetch(`${getGatewayUrl()}/admin/attestations?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getGatewayUrl()}/admin/mesh/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${getGatewayUrl()}/contributions/snapshot?period=${period}`),
      ]);
      if (contribRes.ok) {
        const d = await contribRes.json();
        setContribs(d.contributions ?? []);
      }
      if (attestRes.ok) {
        const rows = await attestRes.json();
        setAttestations(Array.isArray(rows) ? rows : []);
      }
      if (meshRes.ok) {
        const s = await meshRes.json() as MeshStatus;
        setMeshStatus(s);
        if (s.routers?.length && !selectedRouter) setSelectedRouter(s.routers[0]);
      }
      if (snapRes.ok) {
        const snap = await snapRes.json();
        setSnapshotStatus(snap.status ?? null);
      }
    } finally {
      setLogsLoading(false);
    }
  }, [token, selectedRouter]);

  const submitJoinRequest = async () => {
    if (!token || !selectedRouter) return;
    setJoining(true);
    setJoinResult(null);
    try {
      const res = await fetch(`${getGatewayUrl()}/admin/mesh/join-request`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ routerUrl: selectedRouter }),
      });
      const d = await res.json() as any;
      setJoinResult({ ok: res.ok, message: d.message ?? d.error ?? "Unknown response" });
    } catch (e: any) {
      setJoinResult({ ok: false, message: e.message });
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchLocalData(); }, [fetchLocalData]);
  useEffect(() => {
    const id = setInterval(() => { fetchAll(); fetchLocalData(); }, 60_000);
    return () => clearInterval(id);
  }, [fetchAll, fetchLocalData]);

  const refresh = () => { fetchAll(); fetchLocalData(); };

  const allUp         = healths.filter((_, i) => NODES[i].health).every(h => h?.ok);
  const upCount       = healths.filter((h, i) => NODES[i].health && h?.ok).length;
  const healthedNodes = NODES.filter(n => n.health).length;
  const gatewaysUp    = healths.filter((h, i) => NODES[i].role === "gateway" && h?.ok).length;
  const routersUp     = healths.filter((h, i) => NODES[i].role === "router"  && h?.ok).length;
  const gatewayTotal  = NODES.filter(n => n.role === "gateway").length;
  const routerTotal   = NODES.filter(n => n.role === "router").length;
  const totalRecs  = healths.reduce((s, h) => s + (h?.records ?? 0), 0);
  const totalPeers = Math.max(...healths.map(h => h?.peers?.length ?? 0));
  const localContrib = contributions.reduce((s, c) => s + c.records, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Network className="w-5 h-5 text-gb-accent" />
            CCIP Router Network
          </h1>
          <p className="text-xs text-gb-muted mt-0.5">
            EIP-3668 gateway mesh — multi-signer resolver · peer sync · attestation pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          {meshStatus && (
            <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-medium ${
              meshStatus.registered
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
            }`}>
              {meshStatus.registered
                ? <CheckCircle2 className="w-3 h-3" />
                : <AlertCircle className="w-3 h-3" />}
              {meshStatus.registered ? "Registered" : "Unregistered"}
            </span>
          )}
          <button onClick={refresh} disabled={loading || logsLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gb-border text-gb-muted hover:text-slate-300 disabled:opacity-50 transition-colors">
            {(loading || logsLoading) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`bg-gb-surface border rounded-xl px-4 py-3 ${allUp ? "border-emerald-500/20" : "border-amber-500/20"}`}>
          <p className={`text-[10px] uppercase tracking-wide mb-1 ${allUp ? "text-emerald-400" : "text-amber-400"}`}>Network</p>
          <p className="text-lg font-semibold text-slate-100">{upCount} / {healthedNodes}</p>
          <p className="text-[10px] text-gb-muted mt-0.5">{gatewaysUp}/{gatewayTotal} gateway · {routersUp}/{routerTotal} routers</p>
        </div>
        <div className="bg-gb-surface border border-gb-border rounded-xl px-4 py-3">
          <p className="text-[10px] text-gb-muted uppercase tracking-wide mb-1">Records (total)</p>
          <p className="text-lg font-semibold text-slate-100">{loading ? "…" : totalRecs}</p>
        </div>
        <div className="bg-gb-surface border border-gb-border rounded-xl px-4 py-3">
          <p className="text-[10px] text-gb-muted uppercase tracking-wide mb-1">Mesh peers</p>
          <p className="text-lg font-semibold text-slate-100">{loading ? "…" : totalPeers}</p>
        </div>
        <div className="bg-gb-surface border border-emerald-500/20 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-emerald-400 uppercase tracking-wide">Local contributions</p>
            {snapshotStatus && (
              <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-mono ${
                snapshotStatus === "submitted" ? "text-emerald-400 border-emerald-400/30" :
                snapshotStatus === "signed"    ? "text-amber-400 border-amber-400/30" :
                                                 "text-gb-muted border-gb-border"
              }`}>
                {snapshotStatus === "pending" ? <Clock className="w-2.5 h-2.5" /> : <Coins className="w-2.5 h-2.5" />}
                {snapshotStatus}
              </span>
            )}
          </div>
          <p className="text-lg font-semibold text-slate-100">{logsLoading ? "…" : localContrib}</p>
        </div>
      </div>

      {/* Resolver card */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">OffchainResolver v2</p>
          <a href={ETHERSCAN} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-gb-accent hover:underline">
            Etherscan <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex items-center gap-1.5 bg-gb-bg rounded-lg px-3 py-2.5">
          <span className="text-[12px] font-mono text-gb-faint flex-1 break-all">{RESOLVER_V2}</span>
          <button onClick={() => { navigator.clipboard.writeText(RESOLVER_V2); setCopiedResolver(true); setTimeout(() => setCopiedResolver(false), 2000); }}
            className="p-1.5 rounded text-gb-muted hover:text-slate-300 transition-colors shrink-0">
            {copiedResolver ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {NODES.filter(n => n.health).map(n => (
            <div key={n.signer} className="flex items-center gap-2 bg-gb-bg rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gb-muted">{n.label}</p>
                <p className="text-[10px] font-mono text-gb-faint truncate">{n.signer.slice(0, 10)}…{n.signer.slice(-6)}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gb-muted">
          <span className="text-emerald-400">dinamic.eth</span> resolves via any of the authorized nodes —
          if one is down the ENS client automatically falls back to the next URL.
        </p>
      </div>

      {/* Join Mesh onboarding — shown when not yet registered or not configured */}
      {meshStatus && (!meshStatus.configured || !meshStatus.registered) && (
        <div className="bg-gb-surface border border-amber-500/20 rounded-xl p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Network className="w-4 h-4 text-amber-400" />
                Join the CCIP Router Mesh
              </p>
              <p className="text-xs text-gb-muted mt-0.5">
                {meshStatus.configured
                  ? "Your node is configured but not yet registered in NodeRegistry."
                  : meshStatus.reason ?? "Complete setup to join the mesh."}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <a href="https://github.com/Echo-Merlini/ens-dynamic-kit" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-gb-border text-gb-muted hover:text-slate-300 transition-colors">
                <GitBranch className="w-3 h-3" /> GitHub
              </a>
              <a href="https://www.npmjs.com/package/ccip-router" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-gb-border text-gb-muted hover:text-slate-300 transition-colors">
                <Package className="w-3 h-3" /> npm
              </a>
            </div>
          </div>

          {/* Setup steps */}
          <div className="space-y-2">
            <p className="text-[10px] text-gb-muted uppercase tracking-wide">Setup checklist</p>
            {[
              { label: "Set GATEWAY_PRIVATE_KEY", done: meshStatus.configured, detail: "EIP-191 signing key — generate a fresh wallet" },
              { label: "Set GATEWAY_URL",         done: !!(meshStatus.gatewayUrl), detail: "Your node's public URL (must be reachable by mesh peers)" },
              { label: "Set CCIP_ROUTER_URLS",    done: meshStatus.routers?.length > 0, detail: "Comma-separated list of known router nodes to sync with" },
              { label: "Register in NodeRegistry",done: meshStatus.registered, detail: "Submit a join request — a router admin approves and calls NodeRegistry.register()" },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3 bg-gb-bg rounded-lg px-3 py-2.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold ${
                  step.done ? "bg-emerald-500/20 text-emerald-400" : "bg-gb-border text-gb-muted"
                }`}>
                  {step.done ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                </div>
                <div>
                  <p className={`text-xs font-medium ${step.done ? "text-emerald-400 line-through decoration-emerald-400/50" : "text-slate-300"}`}>{step.label}</p>
                  <p className="text-[11px] text-gb-muted mt-0.5">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Join request submission */}
          {meshStatus.configured && !meshStatus.registered && meshStatus.routers?.length > 0 && (
            <div className="space-y-3 border-t border-gb-border pt-4">
              <p className="text-[10px] text-gb-muted uppercase tracking-wide">Submit join request</p>
              <p className="text-[11px] text-gb-muted">
                Your node will sign its URL with <span className="font-mono text-gb-faint">{meshStatus.signerAddress?.slice(0, 10)}…</span> and submit to the selected router.
                A mesh admin will approve and register you in NodeRegistry.
              </p>
              <div className="flex gap-2">
                <select
                  value={selectedRouter}
                  onChange={e => setSelectedRouter(e.target.value)}
                  className="flex-1 bg-gb-bg border border-gb-border rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-gb-accent"
                >
                  {meshStatus.routers.map(r => (
                    <option key={r} value={r}>{r.replace(/^https?:\/\//, "")}</option>
                  ))}
                </select>
                <button
                  onClick={submitJoinRequest}
                  disabled={joining || !selectedRouter}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gb-accent text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
                >
                  {joining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {joining ? "Sending…" : "Request to join"}
                </button>
              </div>
              {joinResult && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                  joinResult.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                }`}>
                  {joinResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                  {joinResult.message}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Node cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {NODES.map((node, i) => (
          <NodeCard key={node.signer} node={node} health={healths[i]} loading={loading} />
        ))}
      </div>

      {/* Local node panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Contributions breakdown */}
        <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-gb-accent" />
            <p className="text-sm font-semibold text-slate-100">Contributions</p>
            <span className="text-[10px] text-gb-muted ml-auto">local node</span>
          </div>
          {logsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-gb-muted" />
            </div>
          ) : contributions.length === 0 ? (
            <p className="text-xs text-gb-muted py-4 text-center">No contributions yet</p>
          ) : (
            <div className="space-y-2">
              {contributions.map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-gb-bg rounded-lg px-3 py-2">
                  <span className="text-[11px] font-mono text-gb-muted truncate max-w-[160px]">
                    {c.source === "local" ? "this node" : c.source.replace(/^https?:\/\//, "")}
                  </span>
                  <span className="text-sm font-semibold text-slate-100 shrink-0">{c.records}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent attestation log */}
        <div className="lg:col-span-2 bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gb-accent" />
            <p className="text-sm font-semibold text-slate-100">Recent Attestations</p>
            <span className="text-[10px] text-gb-muted ml-auto">last 50</span>
          </div>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-gb-muted" />
            </div>
          ) : (
            <div className="overflow-y-auto max-h-80 space-y-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
              {attestations.length === 0 ? (
                <p className="text-xs text-gb-muted py-6 text-center">No attestations yet</p>
              ) : attestations.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gb-bg hover:bg-gb-border/30 transition-colors">
                  {/* L4 / L3 status */}
                  <div className="flex gap-1 shrink-0">
                    <span className={`text-[9px] font-mono px-1 py-0.5 rounded border ${
                      a.l4_signature ? "text-emerald-400 border-emerald-400/30" : "text-gb-muted/40 border-gb-border"
                    }`}>L4</span>
                    <span className={`text-[9px] font-mono px-1 py-0.5 rounded border ${
                      a.l3_tx ? "text-pink-400 border-pink-400/30" : "text-gb-muted/40 border-gb-border"
                    }`}>L3</span>
                  </div>
                  {/* Action type */}
                  <span className="text-[10px] text-gb-muted font-mono shrink-0 w-20 truncate">{a.action_type}</span>
                  {/* Input hash */}
                  <span className="text-[10px] font-mono text-gb-faint flex-1 truncate">
                    {a.input_hash ? a.input_hash.slice(0, 12) + "…" : "—"}
                  </span>
                  {/* L3 link */}
                  {a.l3_tx && (
                    <a href={`${L3_EXPLORER}${a.l3_tx}`} target="_blank" rel="noopener noreferrer"
                      className="text-gb-muted hover:text-slate-300 shrink-0">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {/* Duration */}
                  {a.duration_ms != null && (
                    <span className="text-[10px] text-gb-muted/60 shrink-0">{a.duration_ms}ms</span>
                  )}
                  {/* Timestamp */}
                  <span className="text-[10px] text-gb-muted/60 shrink-0">{elapsed(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
