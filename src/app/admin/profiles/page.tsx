"use client";

import { useState, useEffect } from "react";
import { useWalletClient } from "wagmi";
import { useAuth } from "@/hooks/useAuth";
import {
  Users, RefreshCw, ExternalLink, Save, Loader2, Check, Info, ChevronRight, Link, AlertCircle, Upload
} from "lucide-react";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

type ProfileRecord = {
  name: string;
  label: string;
  cid: string | null;
  address: string | null;
  updated_at: string;
};

type FeeConfig = {
  feeEth: number;
  feeReceiver: string;
};

// ── Fee Config Card ───────────────────────────────────────────────────────────
function FeeConfigCard({ token }: { token: string }) {
  const [config, setConfig]   = useState<FeeConfig>({ feeEth: 0, feeReceiver: "" });
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [err, setErr]         = useState("");

  useEffect(() => {
    fetch(`${GW_URL}/api/claim/profile-fee`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setConfig({ feeEth: d.feeEth ?? 0, feeReceiver: d.feeReceiver ?? "" }); })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true); setErr("");
    try {
      const r = await fetch(`${GW_URL}/api/claim/profile-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(config),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Publishing Fee</p>
          <p className="text-xs text-white/40 mt-0.5">Charged when users publish their profile to IPFS</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/30">
          <Info className="w-3 h-3" />
          <span>Set to 0 for free</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 block">Fee (ETH)</label>
          <input type="number" step="0.001" min="0" value={config.feeEth}
            onChange={e => { setConfig(c => ({ ...c, feeEth: parseFloat(e.target.value) || 0 })); setSaved(false); }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors"
            placeholder="0.003" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 block">Fee Receiver Address</label>
          <input type="text" value={config.feeReceiver}
            onChange={e => { setConfig(c => ({ ...c, feeReceiver: e.target.value })); setSaved(false); }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono outline-none focus:border-white/30 transition-colors"
            placeholder="0x..." />
        </div>
      </div>
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-sm text-white transition-colors disabled:opacity-50">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Save className="w-3.5 h-3.5" />}
        {saved ? "Saved!" : "Save Fee Config"}
      </button>
    </div>
  );
}

// ── Profile row ───────────────────────────────────────────────────────────────
function ProfileRow({ profile, token, onPublished }: { profile: ProfileRecord; token: string; onPublished?: (label: string, cid: string) => void }) {
  const { data: walletClient } = useWalletClient();
  const { label, address, updated_at } = profile;
  const [cid, setCid]           = useState(profile.cid);
  const [setting, setSetting]   = useState(false);
  const [done, setDone]         = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [err, setErr]           = useState("");

  const shortCid = cid ? `${cid.slice(0, 10)}…${cid.slice(-6)}` : "—";
  const date = updated_at ? new Date(updated_at).toLocaleDateString() : "—";

  const publish = async () => {
    setPublishing(true); setErr("");
    try {
      const r = await fetch(`${GW_URL}/admin/profiles/${label}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Pin failed");
      setCid(d.cid);
      onPublished?.(label, d.cid);
    } catch (e: any) {
      setErr(e.message);
    }
    setPublishing(false);
  };

  const setOnchain = async () => {
    if (!cid || !walletClient) return;
    setSetting(true); setErr("");
    try {
      const r = await fetch(`${GW_URL}/admin/ipfs/set-onchain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cid, name: profile.name }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to build tx");
      await walletClient.sendTransaction({ to: d.to as `0x${string}`, data: d.data as `0x${string}` });
      setDone(true);
    } catch (e: any) {
      setErr(e.message.includes("User rejected") ? "Cancelled" : e.message);
    }
    setSetting(false);
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors">
      <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-mono text-amber-300">{label.slice(0, 2).toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-mono truncate">{label}.dinamic.eth</p>
        {address && <p className="text-[10px] text-white/35 font-mono truncate">{address}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-[10px] font-mono text-white/40">{shortCid}</p>
        <p className="text-[10px] text-white/25">{date}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!cid && (
          <button onClick={publish} disabled={publishing}
            title="Pin profile to IPFS so it resolves via CCIP Read"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[10px] text-emerald-300 transition-colors disabled:opacity-40">
            {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {publishing ? "Pinning…" : "Publish"}
          </button>
        )}
        {cid && !done && (
          <button onClick={setOnchain} disabled={setting || !walletClient}
            title="Set contenthash on-chain (enables Brave / Opera resolution)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-[10px] text-amber-300 transition-colors disabled:opacity-40">
            {setting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />}
            {setting ? "Sending…" : "Set on-chain"}
          </button>
        )}
        {done && <span className="text-[10px] text-green-400 flex items-center gap-1"><Check className="w-3 h-3" />On-chain</span>}
        {err && <span className="text-[10px] text-red-400 truncate max-w-24" title={err}>{err}</span>}
        {cid && (
          <a href={`https://${label}.dinamic.eth.limo`} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/40 hover:text-white/70" title="Open profile">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminProfilesPage() {
  const { token, loading: authLoading } = useAuth();
  const [profiles, setProfiles]     = useState<ProfileRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfiles = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const r = await fetch(`${GW_URL}/api/claim/profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) { const d = await r.json(); setProfiles(d.profiles ?? []); }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { loadProfiles(); }, [token]); // eslint-disable-line

  if (authLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>;

  const withCid    = profiles.filter(p => p.cid);
  const withoutCid = profiles.filter(p => !p.cid);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-white">Profiles</h2>
          <p className="text-xs text-white/40 mt-0.5">{profiles.length} subdomain{profiles.length !== 1 ? "s" : ""} · {withCid.length} published to IPFS</p>
        </div>
        <button onClick={loadProfiles} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-xs text-white/60 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* On-chain info banner */}
      {withCid.length > 0 && (
        <div className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400/70 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200/50 leading-relaxed">
            Profiles resolve via <strong className="text-amber-200/70">CCIP Read immediately</strong> after publishing. The <strong className="text-amber-200/70">Set on-chain</strong> button is optional — it registers the IPFS hash directly in the ENS resolver so browsers like Brave and Opera can resolve it natively. This is a manual step and may take 1–3 days to be actioned.
          </p>
        </div>
      )}

      {/* Published profiles */}
      <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Users className="w-3.5 h-3.5" />
            Published profiles ({withCid.length})
          </div>
          <a href="/profile-edit" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors">
            User editor <ChevronRight className="w-3 h-3" />
          </a>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-4 h-4 animate-spin text-white/30" />
          </div>
        ) : withCid.length === 0 ? (
          <div className="py-10 text-center text-white/25 text-sm">
            No profiles published yet — users publish via /profile-edit
          </div>
        ) : (
          <div>{withCid.map(p => <ProfileRow key={p.label} profile={p} token={token!} />)}</div>
        )}
      </div>

      {/* Unpublished subdomains */}
      {withoutCid.length > 0 && (
        <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-xs text-white/40">Claimed but unpublished ({withoutCid.length})</p>
          </div>
          <div>{withoutCid.map(p => <ProfileRow key={p.label} profile={p} token={token!} />)}</div>
        </div>
      )}

      {/* Fee config */}
      {token && <FeeConfigCard token={token} />}
    </div>
  );
}
