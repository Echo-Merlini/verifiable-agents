"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getGatewayUrl } from "@/hooks/useGatewayEnv";
import { shortAddr, timeAgo } from "@/lib/utils";
import {
  Zap, RefreshCw, Plus, Minus, ExternalLink, Loader2,
  CheckCircle2, AlertCircle, Copy, Check, Settings2,
} from "lucide-react";

type RegistryRow = {
  registry_address: string;
  collection_address: string;
  name: string;
  chain_id: number;
  credits: number;
  total_granted: number;
  activated_tx: string;
  created_at: number;
  updated_at: number;
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-gb-muted hover:text-slate-300 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function CreditBadge({ credits }: { credits: number }) {
  const color =
    credits === 0 ? "bg-red-500/15 text-red-400 border-red-500/20" :
    credits < 100 ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
    "bg-green-500/15 text-green-400 border-green-500/20";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono font-medium ${color}`}>
      <Zap className="w-2.5 h-2.5" />
      {credits.toLocaleString()}
    </span>
  );
}

export default function CreditsPage() {
  const { token } = useAuth();
  const [registries, setRegistries]   = useState<RegistryRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [topupAddr, setTopupAddr]     = useState("");
  const [topupAmt, setTopupAmt]       = useState("1000");
  const [setAddr, setSetAddr]         = useState("");
  const [setAmt, setSetAmt]           = useState("");
  const [working, setWorking]         = useState(false);
  const [message, setMessage]         = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [activateTx, setActivateTx]   = useState("");
  const [activateReg, setActivateReg] = useState("");
  const [priceWei,   setPriceWei]     = useState("");
  const [treasury,   setTreasury]     = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  const gw = () => getGatewayUrl();

  // Wallet credits state
  const [wallets,       setWallets]       = useState<{owner_address:string;credits:number;total_granted:number;updated_at:number}[]>([]);
  const [walletTopAddr, setWalletTopAddr] = useState("");
  const [walletTopAmt,  setWalletTopAmt]  = useState("1000");
  const [walletSetAddr, setWalletSetAddr] = useState("");
  const [walletSetAmt,  setWalletSetAmt]  = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${gw()}/admin/registries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setRegistries(Array.isArray(data) ? data : []);
    } catch {}
    try {
      const r2 = await fetch(`${gw()}/admin/wallet-credits`, { headers: { Authorization: `Bearer ${token}` } });
      const d2 = await r2.json();
      setWallets(Array.isArray(d2) ? d2 : []);
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`${gw()}/admin/credits/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.priceWei) setPriceWei(d.priceWei); if (d.treasury) setTreasury(d.treasury); })
      .catch(() => {});
  }, [token]);

  const flash = (type: "ok" | "err", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  async function doTopup() {
    if (!topupAddr || !topupAmt) return;
    setWorking(true);
    try {
      const r = await fetch(`${gw()}/admin/registries/${topupAddr.toLowerCase()}/topup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ credits: Number(topupAmt) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      flash("ok", `Added ${topupAmt} credits → balance: ${d.newBalance.toLocaleString()}`);
      setTopupAddr(""); setTopupAmt("1000");
      load();
    } catch (e: any) { flash("err", e.message); }
    setWorking(false);
  }

  async function doSet() {
    if (!setAddr || setAmt === "") return;
    setWorking(true);
    try {
      const r = await fetch(`${gw()}/admin/registries/${setAddr.toLowerCase()}/set-credits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ credits: Number(setAmt) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      flash("ok", `Set credits to ${Number(setAmt).toLocaleString()} for ${shortAddr(setAddr)}`);
      setSetAddr(""); setSetAmt("");
      load();
    } catch (e: any) { flash("err", e.message); }
    setWorking(false);
  }

  async function doActivate() {
    if (!activateTx || !activateReg) return;
    setWorking(true);
    try {
      const r = await fetch(`${gw()}/api/registry/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: activateTx, registryAddress: activateReg }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (d.alreadyActivated) flash("ok", "Already activated — no change.");
      else flash("ok", `Activated! Granted ${d.creditsGranted.toLocaleString()} credits.`);
      setActivateTx(""); setActivateReg("");
      load();
    } catch (e: any) { flash("err", e.message); }
    setWorking(false);
  }

  async function doWalletTopup() {
    if (!walletTopAddr || !walletTopAmt) return;
    setWorking(true);
    try {
      const r = await fetch(`${gw()}/admin/wallet-credits/${walletTopAddr.toLowerCase()}/topup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ credits: Number(walletTopAmt) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      flash("ok", `Added ${walletTopAmt} credits to ${walletTopAddr.slice(0,8)}… → balance: ${d.newBalance}`);
      setWalletTopAddr(""); setWalletTopAmt("1000");
      load();
    } catch (e: any) { flash("err", e.message); }
    setWorking(false);
  }

  async function doWalletSet() {
    if (!walletSetAddr || walletSetAmt === "") return;
    setWorking(true);
    try {
      const r = await fetch(`${gw()}/admin/wallet-credits/${walletSetAddr.toLowerCase()}/set`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ credits: Number(walletSetAmt) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      flash("ok", `Set wallet ${walletSetAddr.slice(0,8)}… to ${Number(walletSetAmt).toLocaleString()} credits`);
      setWalletSetAddr(""); setWalletSetAmt("");
      load();
    } catch (e: any) { flash("err", e.message); }
    setWorking(false);
  }

  async function savePrice() {
    if (!priceWei) return;
    setSavingPrice(true);
    try {
      const r = await fetch(`${gw()}/admin/credits/settings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ priceWei, ...(treasury ? { treasury } : {}) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      flash("ok", "Price settings saved");
    } catch (e: any) { flash("err", e.message); }
    setSavingPrice(false);
  }

  const totalCredits = registries.reduce((s, r) => s + (r.credits || 0), 0);
  const totalGranted = registries.reduce((s, r) => s + (r.total_granted || 0), 0);
  const zeroCount    = registries.filter(r => (r.credits || 0) === 0).length;

  // A self-sourced (genesis) registry meters against WALLET credits, not its
  // own pool — funding it means topping up the owner's wallet, not the registry.
  const GENESIS_ADDR = (process.env.NEXT_PUBLIC_GENESIS_REGISTRY_ADDRESS || "").toLowerCase();
  const isGenesis = (addr: string) => !!GENESIS_ADDR && addr?.toLowerCase() === GENESIS_ADDR;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Credits
          </h1>
          <p className="text-gb-muted text-sm mt-0.5">
            AI usage credits, deducted on each chat message. Two rails:{" "}
            <span className="text-slate-300">wallet credits</span> (per user) are checked{" "}
            <span className="text-slate-300">first</span>, then the{" "}
            <span className="text-slate-300">registry pool</span> (per collection) as fallback.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-gb-muted hover:text-slate-300 border border-gb-border rounded-lg px-3 py-1.5 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Flash message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm ${
          message.type === "ok"
            ? "bg-green-500/10 border-green-500/20 text-green-300"
            : "bg-red-500/10 border-red-500/20 text-red-300"
        }`}>
          {message.type === "ok"
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle   className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Price settings */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-1.5">
          <Settings2 className="w-3.5 h-3.5 text-amber-400" />
          Credit Price Settings
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-gb-muted font-medium">Price per credit (wei)</label>
            <input value={priceWei} onChange={e => setPriceWei(e.target.value)}
              placeholder="10000000000000"
              className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent" />
            {priceWei && (() => { try { const e = Number(BigInt(priceWei)) / 1e18; return <p className="text-[10px] text-gb-muted mt-0.5">{e} ETH = 1 credit · {(e * 1000).toFixed(6)} ETH = 1k credits</p>; } catch { return null; } })()}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gb-muted font-medium">Treasury address</label>
            <input value={treasury} onChange={e => setTreasury(e.target.value)}
              placeholder="0x…"
              className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent" />
          </div>
          <button onClick={savePrice} disabled={savingPrice || !priceWei}
            className="bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/20 text-amber-300 text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
            {savingPrice ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Save Settings
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total credits remaining", value: totalCredits.toLocaleString(), color: "text-amber-400" },
          { label: "Total credits ever granted", value: totalGranted.toLocaleString(), color: "text-slate-300" },
          { label: "Registries at zero", value: zeroCount.toString(), color: zeroCount > 0 ? "text-red-400" : "text-green-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gb-surface border border-gb-border rounded-xl p-4">
            <p className="text-gb-muted text-xs mb-1">{label}</p>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Actions row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Top-up */}
        <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-green-400" />
            Add Credits
          </p>
          <input
            value={topupAddr}
            onChange={e => setTopupAddr(e.target.value)}
            placeholder="Registry address 0x…"
            className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
          />
          <input
            value={topupAmt}
            onChange={e => setTopupAmt(e.target.value)}
            placeholder="Credits to add"
            type="number"
            min="1"
            className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
          />
          <button
            onClick={doTopup}
            disabled={working || !topupAddr || !topupAmt}
            className="w-full bg-green-600/20 hover:bg-green-600/30 border border-green-500/20 text-green-300 text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-40"
          >
            {working ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
            Add Credits
          </button>
        </div>

        {/* Override */}
        <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5 text-amber-400" />
            Set Credits (Override)
          </p>
          <input
            value={setAddr}
            onChange={e => setSetAddr(e.target.value)}
            placeholder="Registry address 0x…"
            className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
          />
          <input
            value={setAmt}
            onChange={e => setSetAmt(e.target.value)}
            placeholder="New balance"
            type="number"
            min="0"
            className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
          />
          <button
            onClick={doSet}
            disabled={working || !setAddr || setAmt === ""}
            className="w-full bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/20 text-amber-300 text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-40"
          >
            {working ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
            Set Balance
          </button>
        </div>

        {/* Manual activate */}
        <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Manual Activate
          </p>
          <input
            value={activateTx}
            onChange={e => setActivateTx(e.target.value)}
            placeholder="Deploy tx hash 0x…"
            className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
          />
          <input
            value={activateReg}
            onChange={e => setActivateReg(e.target.value)}
            placeholder="Registry address 0x…"
            className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
          />
          <button
            onClick={doActivate}
            disabled={working || !activateTx || !activateReg}
            className="w-full bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/20 text-amber-300 text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-40"
          >
            {working ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
            Activate via Tx
          </button>
        </div>

      </div>

      {/* Wallet action cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Add wallet credits */}
        <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-green-400" />
            Add Wallet Credits
          </p>
          <input
            value={walletTopAddr}
            onChange={e => setWalletTopAddr(e.target.value)}
            placeholder="Wallet address 0x…"
            className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
          />
          <input
            value={walletTopAmt}
            onChange={e => setWalletTopAmt(e.target.value)}
            placeholder="Credits to add" type="number" min="1"
            className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
          />
          <button
            onClick={doWalletTopup}
            disabled={working || !walletTopAddr || !walletTopAmt}
            className="w-full bg-green-600/20 hover:bg-green-600/30 border border-green-500/20 text-green-300 text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {working ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Add Credits
          </button>
        </div>
        {/* Set wallet credits */}
        <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5 text-amber-400" />
            Set Wallet Credits (Override)
          </p>
          <input
            value={walletSetAddr}
            onChange={e => setWalletSetAddr(e.target.value)}
            placeholder="Wallet address 0x…"
            className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
          />
          <input
            value={walletSetAmt}
            onChange={e => setWalletSetAmt(e.target.value)}
            placeholder="New balance" type="number" min="0"
            className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
          />
          <button
            onClick={doWalletSet}
            disabled={working || !walletSetAddr || walletSetAmt === ""}
            className="w-full bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/20 text-amber-300 text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {working ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Set Balance
          </button>
        </div>
      </div>

      {/* Wallet credits table */}
      <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gb-border">
          <p className="text-sm font-semibold text-slate-200">Wallet Credits ({wallets.length})</p>
          <p className="text-[11px] text-gb-muted mt-0.5">Per-user balance — deducted first on every chat, and the <span className="text-slate-300">only</span> rail that funds self-sourced (genesis) agents. To fund one, top up the <span className="text-slate-300">owner's wallet</span>, not the registry.</p>
        </div>
        {wallets.length === 0 ? (
          <div className="text-center py-8 text-gb-muted text-sm">No wallet top-ups yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gb-border text-gb-muted text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Wallet</th>
                  <th className="text-left px-5 py-3 font-medium">Credits</th>
                  <th className="text-left px-5 py-3 font-medium">Total Granted</th>
                  <th className="text-left px-5 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gb-border">
                {wallets.map(w => (
                  <tr key={w.owner_address} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-slate-300">
                      <div className="flex items-center gap-1.5">
                        {shortAddr(w.owner_address)}
                        <CopyBtn text={w.owner_address} />
                        <a href={`https://etherscan.io/address/${w.owner_address}`} target="_blank" rel="noreferrer" className="text-gb-muted hover:text-slate-300"><ExternalLink className="w-3 h-3" /></a>
                      </div>
                    </td>
                    <td className="px-5 py-3"><CreditBadge credits={w.credits ?? 0} /></td>
                    <td className="px-5 py-3 font-mono text-xs text-gb-muted">{(w.total_granted ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-xs text-gb-muted">{timeAgo(w.updated_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => { setWalletTopAddr(w.owner_address); setWalletTopAmt("1000"); }}
                        className="text-xs text-gb-muted hover:text-green-400 border border-gb-border hover:border-green-500/30 rounded-lg px-2.5 py-1 transition-colors">+ Top up</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registry table */}
      <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gb-border">
          <p className="text-sm font-semibold text-slate-200">
            Registries ({registries.length})
          </p>
          <p className="text-[11px] text-gb-muted mt-0.5">Per-collection pool — funds bridged-collection agents (used as fallback after wallet credits). A <span className="text-amber-300">per-wallet metered</span> registry (self-sourced / genesis) does <span className="text-slate-300">not</span> draw from its pool — fund the owner's wallet above.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gb-muted" />
          </div>
        ) : registries.length === 0 ? (
          <div className="text-center py-12 text-gb-muted text-sm">No registries yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gb-border text-gb-muted text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Registry</th>
                  <th className="text-left px-5 py-3 font-medium">Collection</th>
                  <th className="text-left px-5 py-3 font-medium">Credits</th>
                  <th className="text-left px-5 py-3 font-medium">Total Granted</th>
                  <th className="text-left px-5 py-3 font-medium">Activation Tx</th>
                  <th className="text-left px-5 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gb-border">
                {registries.map((reg) => (
                  <tr key={reg.registry_address} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-slate-300">
                      <div className="flex items-center gap-1.5">
                        {shortAddr(reg.registry_address)}
                        <CopyBtn text={reg.registry_address} />
                        <a href={`https://etherscan.io/address/${reg.registry_address}`} target="_blank" rel="noreferrer"
                          className="text-gb-muted hover:text-slate-300">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        {isGenesis(reg.registry_address) && (
                          <span title="Self-sourced (genesis) — agents meter against wallet credits, not this pool. Fund the owner's wallet."
                            className="ml-0.5 px-1.5 py-0.5 rounded text-[9px] font-sans font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20 whitespace-nowrap">
                            per-wallet metered
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gb-muted">
                      {reg.collection_address ? (
                        <div className="flex items-center gap-1.5">
                          {shortAddr(reg.collection_address)}
                          <CopyBtn text={reg.collection_address} />
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <CreditBadge credits={reg.credits ?? 0} />
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gb-muted">
                      {(reg.total_granted ?? 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gb-muted">
                      {reg.activated_tx ? (
                        <div className="flex items-center gap-1.5">
                          {reg.activated_tx.slice(0, 10)}…
                          <a href={`https://etherscan.io/tx/${reg.activated_tx}`} target="_blank" rel="noreferrer"
                            className="text-gb-muted hover:text-slate-300">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : <span className="text-amber-500/60 text-[11px]">not activated</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-gb-muted">
                      {timeAgo(reg.updated_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => { setTopupAddr(reg.registry_address); setTopupAmt("1000"); }}
                        className="text-xs text-gb-muted hover:text-green-400 border border-gb-border hover:border-green-500/30 rounded-lg px-2.5 py-1 transition-colors"
                      >
                        + Top up
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
