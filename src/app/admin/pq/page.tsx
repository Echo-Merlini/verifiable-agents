"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getGatewayUrl } from "@/hooks/useGatewayEnv";
import { KeyRound, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Anchor, Search, Layers, ExternalLink } from "lucide-react";

// The PQ layer is served by the gateway under /pq/* (see gateway src/routes/pq.ts).
// Reads are public + recomputable; the mutating actions (anchor a batch, backfill companions)
// are admin-gated by the same SIWE JWT the rest of admin uses. Nothing here is asserted —
// every panel shows what the gateway returns so it can be recomputed against the primary source.

const BASESCAN = "https://sepolia.basescan.org/tx/";
const short = (s?: string | null, n = 8) => (s ? (s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-6)}` : s) : "—");
const ts = (n?: number | null) => (n ? new Date(n * 1000).toISOString().replace("T", " ").slice(0, 19) + "Z" : "—");

export default function PqAdminPage() {
  const { token } = useAuth();

  // ── fleet anchor epoch ────────────────────────────────────────────────
  const [epoch, setEpoch] = useState<any>(null);
  const [epochLoading, setEpochLoading] = useState(false);
  const [anchoring, setAnchoring] = useState(false);
  const [anchorMsg, setAnchorMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadEpoch = useCallback(async () => {
    setEpochLoading(true);
    try {
      const r = await fetch(`${getGatewayUrl()}/pq/anchor-epoch`, { signal: AbortSignal.timeout(8000) });
      setEpoch(await r.json());
    } catch (e: any) {
      setEpoch({ error: String(e?.message || e) });
    } finally {
      setEpochLoading(false);
    }
  }, []);

  const fireAnchor = async () => {
    if (!token) { setAnchorMsg({ ok: false, text: "Sign in as admin first." }); return; }
    setAnchoring(true); setAnchorMsg(null);
    try {
      const r = await fetch(`${getGatewayUrl()}/pq/anchor-epoch/anchor`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setAnchorMsg({ ok: true, text: `Anchored epoch ${j.anchor_epoch ?? "?"} · ${j.count ?? "?"} bindings · root ${short(j.root)} · tx ${short(j.anchor_tx)}` });
      await loadEpoch();
    } catch (e: any) {
      setAnchorMsg({ ok: false, text: String(e?.message || e) });
    } finally {
      setAnchoring(false);
    }
  };

  // ── enforce self-test ─────────────────────────────────────────────────
  const [enforce, setEnforce] = useState<any>(null);
  const loadEnforce = useCallback(async () => {
    try {
      const r = await fetch(`${getGatewayUrl()}/pq/enforce/selftest`, { signal: AbortSignal.timeout(10000) });
      setEnforce(await r.json());
    } catch (e: any) { setEnforce({ error: String(e?.message || e) }); }
  }, []);

  // ── companion coverage ────────────────────────────────────────────────
  const [coverage, setCoverage] = useState<any>(null);
  const [backfilling, setBackfilling] = useState(false);
  const loadCoverage = useCallback(async () => {
    try {
      const r = await fetch(`${getGatewayUrl()}/pq/companion/coverage?sample=25`, { signal: AbortSignal.timeout(8000) });
      setCoverage(await r.json());
    } catch (e: any) { setCoverage({ error: String(e?.message || e) }); }
  }, []);
  const backfill = async () => {
    if (!token) return;
    setBackfilling(true);
    try {
      await fetch(`${getGatewayUrl()}/pq/companion/backfill?limit=500`, { method: "POST", headers: { Authorization: "Bearer " + token } });
      await loadCoverage();
    } finally { setBackfilling(false); }
  };

  // ── per-agent binding lookup ──────────────────────────────────────────
  const [registry, setRegistry] = useState("0xe91934ab1f6a40cc1bb4cd530feff56dfe524963");
  const [agentId, setAgentId] = useState("1");
  const [binding, setBinding] = useState<any>(null);
  const [bindingLoading, setBindingLoading] = useState(false);
  const lookupBinding = async () => {
    setBindingLoading(true); setBinding(null);
    try {
      const r = await fetch(`${getGatewayUrl()}/pq/agent/${registry}/${agentId}/binding`, { signal: AbortSignal.timeout(8000) });
      setBinding(await r.json());
    } catch (e: any) { setBinding({ error: String(e?.message || e) }); }
    finally { setBindingLoading(false); }
  };

  useEffect(() => { loadEpoch(); loadEnforce(); loadCoverage(); }, [loadEpoch, loadEnforce, loadCoverage]);

  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-gb-surface border border-gb-border rounded-xl p-5 ${className}`}>{children}</div>
  );
  const Kv = ({ k, v, mono = true }: { k: string; v: React.ReactNode; mono?: boolean }) => (
    <div className="flex justify-between gap-4 py-1 border-b border-gb-border/40 last:border-0">
      <span className="text-[11px] text-gb-muted uppercase tracking-wide">{k}</span>
      <span className={`text-xs text-slate-200 text-right ${mono ? "font-mono" : ""}`}>{v}</span>
    </div>
  );

  const anchored = epoch && !epoch.error && epoch.anchor_epoch != null;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <KeyRound className="w-6 h-6 text-violet-400" />
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Post-Quantum</h1>
          <p className="text-xs text-gb-muted font-mono">ERC-8373 · pq_key_binding.v0 · gateway /pq/*</p>
        </div>
        <button onClick={() => { loadEpoch(); loadEnforce(); loadCoverage(); }}
          className="ml-auto flex items-center gap-1.5 text-xs text-gb-muted hover:text-slate-200 border border-gb-border rounded-lg px-3 py-2">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Anchor epoch — the fleet-wide batch */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Anchor className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-100">Anchor epoch</h2>
          <span className="text-[10px] text-gb-muted font-mono ml-1">fleet-wide Merkle batch → record() on-chain</span>
        </div>
        {epochLoading ? (
          <div className="flex items-center gap-2 text-gb-muted text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : epoch?.error ? (
          <p className="text-xs text-red-400 font-mono">gateway: {epoch.error}</p>
        ) : anchored ? (
          <div className="space-y-1">
            <Kv k="epoch" v={epoch.anchor_epoch} />
            <Kv k="bindings" v={epoch.count ?? "—"} />
            <Kv k="root" v={short(epoch.root)} />
            <Kv k="anchor tx" v={epoch.anchor_tx ? <a href={BASESCAN + epoch.anchor_tx} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-1">{short(epoch.anchor_tx)} <ExternalLink className="w-3 h-3" /></a> : "—"} />
            <Kv k="chain" v={epoch.chain_id === 84532 ? "Base Sepolia (84532)" : epoch.chain_id ?? "—"} />
            <Kv k="anchored at" v={ts(epoch.anchored_at)} />
          </div>
        ) : (
          <p className="text-xs text-gb-muted font-mono py-2">No anchor epoch recorded yet.</p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={fireAnchor} disabled={anchoring || !token}
            className="flex items-center gap-2 bg-amber-500/90 hover:bg-amber-500 disabled:opacity-50 text-black text-sm font-semibold rounded-lg px-4 py-2">
            {anchoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Anchor className="w-4 h-4" />}
            {anchoring ? "Anchoring…" : "Anchor now"}
          </button>
          <span className="text-[11px] text-gb-muted">Merkle-roots every current binding + records it on Base Sepolia. Sweeps in any bound since the last batch.</span>
        </div>
        {!token && <p className="text-[11px] text-amber-400 mt-2">Sign in as admin to fire a batch.</p>}
        {anchorMsg && (
          <p className={`mt-3 text-xs font-mono flex items-center gap-2 ${anchorMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
            {anchorMsg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}{anchorMsg.text}
          </p>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Enforcer self-test */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-100">Enforcer self-test</h2>
          </div>
          {!enforce ? (
            <div className="flex items-center gap-2 text-gb-muted text-sm py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : enforce.error ? (
            <p className="text-xs text-red-400 font-mono">{enforce.error}</p>
          ) : (
            <>
              <p className="text-xs text-gb-muted mb-2">The deployed enforcer reproduces the pinned cutoff vectors live.</p>
              <pre className="text-[11px] font-mono text-slate-300 bg-gb-input border border-gb-border rounded-lg p-3 overflow-x-auto max-h-48">{JSON.stringify(enforce, null, 2)}</pre>
              <a href={`${getGatewayUrl()}/pq/enforce/selftest`} target="_blank" rel="noreferrer" className="text-[11px] text-emerald-400 hover:underline mt-2 inline-flex items-center gap-1">/pq/enforce/selftest <ExternalLink className="w-3 h-3" /></a>
            </>
          )}
        </Card>

        {/* Companion coverage */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-slate-100">Companion coverage</h2>
            <span className="text-[10px] text-gb-muted font-mono ml-1">Phase 3</span>
          </div>
          {!coverage ? (
            <div className="flex items-center gap-2 text-gb-muted text-sm py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : coverage.error ? (
            <p className="text-xs text-red-400 font-mono">{coverage.error}</p>
          ) : (
            <pre className="text-[11px] font-mono text-slate-300 bg-gb-input border border-gb-border rounded-lg p-3 overflow-x-auto max-h-40">{JSON.stringify(coverage, null, 2)}</pre>
          )}
          <button onClick={backfill} disabled={backfilling || !token}
            className="mt-3 flex items-center gap-2 border border-gb-border hover:border-gb-accent/40 disabled:opacity-50 text-slate-200 text-xs rounded-lg px-3 py-2">
            {backfilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Backfill companions
          </button>
        </Card>
      </div>

      {/* Per-agent binding lookup */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-slate-300" />
          <h2 className="text-sm font-semibold text-slate-100">Agent binding</h2>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <input value={registry} onChange={e => setRegistry(e.target.value.trim())} placeholder="Registry address…"
            className="bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent flex-1 min-w-[22rem] font-mono" />
          <input value={agentId} onChange={e => setAgentId(e.target.value.trim())} placeholder="Agent ID…"
            className="bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent w-24 font-mono" />
          <button onClick={lookupBinding} disabled={bindingLoading}
            className="flex items-center gap-2 bg-gb-input border border-gb-border hover:border-gb-accent/40 text-slate-200 text-xs rounded-lg px-4 py-2">
            {bindingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Look up
          </button>
        </div>
        {binding && (binding.error ? (
          <p className="text-xs text-red-400 font-mono">{binding.error}</p>
        ) : (
          <div className="space-y-1">
            <Kv k="profile" v={binding.profile ?? "—"} />
            <Kv k="algorithm" v={binding.algorithm ?? "—"} />
            <Kv k="cc (sha256 JCS)" v={short(binding.canonical_content_sha256)} />
            <Kv k="owner" v={short(binding.owner)} />
            <Kv k="owner sig" v={binding.owner_authorization?.signature ? "present" : "—"} />
            <Kv k="key epoch" v={`auth ${binding.owner_authorization?.authorizes_key_epoch ?? "—"} · in-force ${binding.owner_authorization?.in_force_key_epoch ?? "—"}`} />
            <Kv k="anchor" v={binding.anchor
              ? <a href={binding.anchor.anchor_tx ? BASESCAN + binding.anchor.anchor_tx : "#"} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">anchored · {binding.anchor.chain_id === 84532 ? "Base Sepolia" : binding.anchor.chain_id} · {short(binding.anchor.anchor_tx)}</a>
              : <span className="text-amber-400">pending next batch</span>} />
          </div>
        ))}
      </Card>

      <p className="text-[10px] text-gb-muted/70 font-mono">
        Reads are public + recomputable (cc = sha256(JCS(statement)); anchor folds the leaf into a root record()&apos;d on-chain).
        Anchoring + backfill are admin-gated. Nothing here is asserted — recompute each field against the gateway or the chain.
      </p>
    </div>
  );
}
