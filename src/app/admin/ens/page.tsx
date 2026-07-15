"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { useAuth } from "@/hooks/useAuth";
import { useGatewayEnv } from "@/hooks/useGatewayEnv";
import { useWalletClient } from "wagmi";
import { getRecords, upsertRecord, deleteRecord, getGatewayStatus, getIpfsSettings, saveIpfsSettings, pinCidToPinata, setContenthashOnchain } from "@/lib/api";
import {
  Plus, Trash2, Check, X, ChevronDown, ChevronUp,
  Copy, Globe, AlertCircle, ExternalLink, RefreshCw, Eye, Upload, Key, Link,
} from "lucide-react";

const RESOLVER_CONTRACT = "0xa912dF7bb8b0a531800dF47dCD4cfE9bD533d33a";

const APP_PAGE_NAMES = new Set([
  "dinamic.eth",
  "agents.dinamic.eth",
  "agent.dinamic.eth",
  "chat.dinamic.eth",
  "my-agents.dinamic.eth",
  "use-agent.dinamic.eth",
  "spec.dinamic.eth",
  "feed.dinamic.eth",
  "claim.dinamic.eth",
  "factory.dinamic.eth",
  "top-up.dinamic.eth",
  "profile-edit.dinamic.eth",
  "mint-agent.dinamic.eth",
]);
const COMMON_TEXT_KEYS = [
  // Media
  "avatar", "icon", "video", "banner", "gallery", "card_bg", "media", "media_desc",
  // Actions
  "pfp_button", "pfp_button_2", "url", "agent", "tip", "cal", "donate",
  // Integrations
  "com.twitter", "com.github", "discord", "telegram", "email", "rss",
  // Appearance
  "theme", "layout", "badge", "subtitle",
  // Standard
  "description",
];

type GatewayRecord = {
  name: string;
  address?: string;
  contenthash?: string;
  text_records: Record<string, string>;
  updated_at?: number;
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded text-gb-muted hover:text-gb-faint hover:bg-[#1a1a1a] transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Field({
  label, value, onChange, placeholder, mono = true,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-gb-muted uppercase tracking-wide">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className={`w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-zinc-600 outline-none transition-colors ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

// ─── Record card ──────────────────────────────────────────────────────────────

function RecordCard({
  record,
  token,
  onSaved,
  onDeleted,
}: {
  record: GatewayRecord;
  token: string;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(record.address || "");
  const [contenthash, setContenthash] = useState(record.contenthash || "");
  const [textRecords, setTextRecords] = useState<[string, string][]>(
    Object.entries(record.text_records || {})
  );
  const [newKey, setNewKey] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty =
    address !== (record.address || "") ||
    contenthash !== (record.contenthash || "") ||
    JSON.stringify(textRecords) !== JSON.stringify(Object.entries(record.text_records || {}));

  const save = async () => {
    setSaving(true);
    await upsertRecord(token, record.name, {
      address: address || undefined,
      contenthash: contenthash || undefined,
      text_records: Object.fromEntries(textRecords),
    });
    setSaving(false);
    onSaved();
  };

  const remove = async () => {
    if (!confirm(`Delete all records for ${record.name}?`)) return;
    setDeleting(true);
    await deleteRecord(token, record.name);
    onDeleted();
  };

  const addTextRecord = () => {
    const key = newKey === "__custom__" ? customKey.trim() : newKey.trim();
    if (!key) return;
    setTextRecords((prev) => [...prev, [key, newVal]]);
    setNewKey("");
    setCustomKey("");
    setNewVal("");
  };

  const removeTextRecord = (i: number) =>
    setTextRecords((prev) => prev.filter((_, idx) => idx !== i));

  const updateTextRecord = (i: number, field: "key" | "val", value: string) =>
    setTextRecords((prev) =>
      prev.map((kv, idx) => (idx === i ? (field === "key" ? [value, kv[1]] : [kv[0], value]) : kv))
    );

  const summary = [
    record.address && `addr: ${record.address.slice(0, 8)}…`,
    record.contenthash && `content: ${record.contenthash.slice(0, 14)}…`,
    Object.keys(record.text_records || {}).length > 0 &&
      `${Object.keys(record.text_records).length} text record${Object.keys(record.text_records).length !== 1 ? "s" : ""}`,
  ]
    .filter(Boolean)
    .join(" · ") || "empty";

  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gb-input/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-mono text-sm text-gb-accent flex-1 truncate">{record.name}</span>
        <span className="text-xs text-[#444] truncate hidden sm:block">{summary}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gb-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-gb-muted shrink-0" />}
      </div>

      {open && (
        <div className="border-t border-gb-border px-4 py-4 space-y-5">
          {/* Core fields */}
          <div className="grid grid-cols-1 gap-4">
            <Field label="Address" value={address} onChange={setAddress} placeholder="0x…" />
            <Field label="Content Hash" value={contenthash} onChange={setContenthash} placeholder="ipfs://… or bzz://…" />
          </div>

          {/* Text records */}
          <div className="space-y-2">
            <p className="text-[11px] text-gb-muted uppercase tracking-wide">Text Records</p>
            {textRecords.length === 0 && (
              <p className="text-xs text-[#444] italic">No text records yet</p>
            )}
            {textRecords.map(([k, v], i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={k}
                  onChange={(e) => updateTextRecord(i, "key", e.target.value)}
                  placeholder="key"
                  className="w-32 shrink-0 bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-2.5 py-1.5 text-xs font-mono text-gb-faint outline-none"
                />
                <input
                  value={v}
                  onChange={(e) => updateTextRecord(i, "val", e.target.value)}
                  placeholder="value"
                  className="flex-1 bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-2.5 py-1.5 text-xs font-mono text-gb-faint outline-none"
                />
                <button
                  onClick={() => removeTextRecord(i)}
                  className="p-1.5 rounded text-[#444] hover:text-red-400 hover:bg-[#1a1a1a] transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Add text record */}
            <div className="flex gap-2 items-center pt-1">
              <select
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="w-32 shrink-0 bg-gb-input border border-gb-border rounded-lg px-2.5 py-1.5 text-xs text-gb-faint outline-none"
              >
                <option value="">+ key</option>
                {COMMON_TEXT_KEYS.filter((k) => !textRecords.find(([ek]) => ek === k)).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
                <option value="__custom__">custom…</option>
              </select>
              {newKey === "__custom__" && (
                <input
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="key name"
                  autoFocus
                  className="w-28 shrink-0 bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-2.5 py-1.5 text-xs font-mono text-gb-faint outline-none"
                />
              )}
              <input
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTextRecord()}
                placeholder="value"
                className="flex-1 bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-2.5 py-1.5 text-xs font-mono text-gb-faint outline-none"
              />
              <button
                onClick={addTextRecord}
                disabled={!newKey || (newKey === "__custom__" && !customKey.trim())}
                className="p-1.5 rounded bg-[#1a1a1a] hover:bg-zinc-600 disabled:opacity-40 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-gb-faint" />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-gb-border">
            <button
              onClick={remove}
              disabled={deleting}
              className="flex items-center gap-1.5 text-xs text-[#444] hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? "Deleting…" : "Delete name"}
            </button>
            <div className="flex items-center gap-2">
              {dirty && (
                <span className="text-[11px] text-amber-500">Unsaved changes</span>
              )}
              <button
                onClick={save}
                disabled={saving || !dirty}
                className="flex items-center gap-1.5 bg-gb-accentD hover:bg-gb-accent disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add record form ───────────────────────────────────────────────────────────

function AddRecordForm({ token, onSaved }: { token: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contenthash, setContenthash] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await upsertRecord(token, name.trim(), {
      address: address || undefined,
      contenthash: contenthash || undefined,
    });
    setSaving(false);
    setName(""); setAddress(""); setContenthash("");
    setOpen(false);
    onSaved();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full border border-dashed border-gb-border hover:border-gb-accent rounded-xl px-4 py-3 text-sm text-gb-muted hover:text-gb-accent transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add name or subdomain
      </button>
    );
  }

  return (
    <div className="bg-gb-surface border border-gb-accent rounded-xl px-4 py-4 space-y-4">
      <p className="text-sm font-medium text-slate-100">New record</p>
      <Field label="ENS Name" value={name} onChange={setName} placeholder="subdomain.yourname.eth" mono />
      <Field label="Address" value={address} onChange={setAddress} placeholder="0x… (optional)" />
      <Field label="Content Hash" value={contenthash} onChange={setContenthash} placeholder="ipfs://… (optional)" />
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="text-xs text-gb-muted hover:text-gb-faint px-3 py-1.5 transition-colors">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 bg-gb-accentD hover:bg-gb-accent disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {saving ? "Saving…" : "Add"}
        </button>
      </div>
    </div>
  );
}

// ─── Live preview via Enstate ─────────────────────────────────────────────────

function LivePreview() {
  const [name, setName] = useState("dinamic.eth");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = async () => {
    if (!name.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await fetch(`https://enstate.rs/n/${name.trim()}`);
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      setResult(await r.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 text-gb-muted" />
        <p className="text-sm font-semibold">Live Preview</p>
        <span className="text-xs text-[#444] ml-1">— what ENS resolves right now</span>
      </div>
      <div className="flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && preview()}
          placeholder="yourname.eth"
          className="flex-1 bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-zinc-600 outline-none transition-colors"
        />
        <button
          onClick={preview}
          disabled={loading}
          className="flex items-center gap-1.5 bg-gb-accentD hover:bg-gb-accent disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          {loading ? "Loading…" : "Preview"}
        </button>
      </div>
      {error && (
        <div className="flex items-start gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {result && (
        <div className="space-y-2">
          {result.address && (
            <div className="flex items-center justify-between py-2 border-b border-gb-border">
              <span className="text-xs text-gb-muted">address</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-gb-faint">{result.address}</span>
                <CopyButton text={result.address} />
              </div>
            </div>
          )}
          {result.contenthash && (
            <div className="flex items-center justify-between py-2 border-b border-gb-border">
              <span className="text-xs text-gb-muted">contenthash</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-gb-faint truncate max-w-48">{result.contenthash}</span>
                <CopyButton text={result.contenthash} />
              </div>
            </div>
          )}
          {result.records && Object.entries(result.records).map(([k, v]: any) => (
            <div key={k} className="flex items-center justify-between py-2 border-b border-gb-border last:border-0">
              <span className="text-xs text-gb-muted">{k}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gb-faint truncate max-w-56">{v}</span>
                <CopyButton text={v} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Resolver checker ─────────────────────────────────────────────────────────

function ResolverChecker({ publicClient }: { publicClient: any }) {
  const [checkName, setCheckName] = useState("");
  const [result, setResult] = useState<{ resolver: string; isOurs: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    if (!checkName.trim()) return;
    setChecking(true); setError(null); setResult(null);
    try {
      const resolver = await publicClient.getEnsResolver({ name: checkName.trim() });
      setResult({ resolver: resolver || "Not set", isOurs: resolver?.toLowerCase() === RESOLVER_CONTRACT.toLowerCase() });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <input
          value={checkName}
          onChange={(e) => setCheckName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="dinamic.eth"
          className="flex-1 bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-zinc-600 outline-none transition-colors"
        />
        <button
          onClick={check}
          disabled={checking || !checkName.trim()}
          className="bg-gb-accentD hover:bg-gb-accent disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {checking ? "Checking…" : "Check"}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && (
        <div className={`rounded-lg p-3 text-sm ${result.isOurs ? "bg-green-950/40 border border-green-800" : "bg-gb-input border border-gb-border"}`}>
          <p className={result.isOurs ? "text-green-400 font-semibold" : "text-yellow-400 font-semibold"}>
            {result.isOurs ? "✓ Uses this resolver" : "✗ Different resolver"}
          </p>
          <p className="font-mono text-xs text-gb-muted mt-1 break-all">{result.resolver}</p>
        </div>
      )}
    </div>
  );
}

// ─── IPFS Browser Resolution panel ───────────────────────────────────────────

function IpfsRowState() {
  return { loading: false, error: null as string | null, success: null as string | null };
}

function IpfsPanel({ token, records, walletClient }: { token: string; records: GatewayRecord[]; walletClient: any }) {
  const [pinatJwt, setPinatJwt] = useState("");
  const [jwtSet, setJwtSet] = useState(false);
  const [showJwt, setShowJwt] = useState(false);
  const [jwtSuccess, setJwtSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // per-row CID inputs (keyed by name) — pre-filled from gateway DB
  const [cids, setCids] = useState<Record<string, string>>({});
  // per-row tx state
  const [states, setStates] = useState<Record<string, { loading: boolean; error: string | null; success: string | null }>>({});
  // renew CIDs (build + pin pipeline)
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [renewSuccess, setRenewSuccess] = useState<string | null>(null);

  const renewCids = async () => {
    setRenewing(true); setRenewError(null); setRenewSuccess(null);
    try {
      const res = await fetch("http://merlinis-mac-mini.local:7078/publish/pages", { method: "POST", signal: AbortSignal.timeout(660000) });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Build failed");
      const freshCids = d.cids as Record<string, string>;
      setCids(prev => ({ ...prev, ...freshCids }));
      setOpen(true);

      // Auto-apply every SUBDOMAIN record offchain (instant, no gas) so subdomains
      // never drift. Only the root ENS name needs an on-chain contenthash tx.
      const ROOT_NAME = process.env.NEXT_PUBLIC_ENS_NAME || "dinamic.eth";
      const subs = Object.entries(freshCids).filter(([name]) => name !== ROOT_NAME);
      const results = await Promise.allSettled(
        subs.map(([name, cid]) => upsertRecord(token, name, { contenthash: `ipfs://${cid.replace(/^ipfs:\/\//, "")}` }))
      );
      const okCount = results.filter(r => r.status === "fulfilled").length;
      setRenewSuccess(`${Object.keys(freshCids).length} CIDs refreshed · ${okCount}/${subs.length} subdomains auto-updated (offchain). Set the root ${ROOT_NAME} contenthash on-chain below.`);
      setTimeout(() => setRenewSuccess(null), 20000);
    } catch (e: any) {
      setRenewError(e?.message?.includes("fetch") ? "Could not reach publish server (merlinis-mac-mini.local:7078) — is Echo running?" : (e?.message ?? "Unknown error"));
    } finally {
      setRenewing(false);
    }
  };

  // records that are IPFS names (have or might get a contenthash)
  const ipfsRecords = records.filter((r) => r.contenthash || r.name.endsWith(".eth"));

  // sync CID inputs when records load / change
  useEffect(() => {
    setCids((prev) => {
      const next = { ...prev };
      for (const r of ipfsRecords) {
        if (!next[r.name] && r.contenthash) {
          next[r.name] = r.contenthash.replace(/^ipfs:\/\//, "");
        }
      }
      return next;
    });
  }, [records]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getIpfsSettings(token).then((d) => {
      if (d.pinata_jwt === "set") setJwtSet(true);
    }).catch(() => {});
  }, [token]);

  const saveJwt = async () => {
    if (!pinatJwt.trim()) return;
    await saveIpfsSettings(token, { pinata_jwt: pinatJwt.trim() });
    setJwtSet(true); setPinatJwt(""); setShowJwt(false);
    setJwtSuccess("Pinata JWT saved");
    setTimeout(() => setJwtSuccess(null), 3000);
  };

  const setOnchain = async (name: string) => {
    const cid = (cids[name] || "").trim().replace(/^ipfs:\/\//, "");
    if (!cid || !walletClient) return;
    setStates((prev) => ({ ...prev, [name]: { loading: true, error: null, success: null } }));
    try {
      // Update gateway DB first
      await upsertRecord(token, name, { contenthash: `ipfs://${cid}` });
      // Build on-chain calldata (namehash is computed server-side from name)
      const res = await setContenthashOnchain(token, cid, name);
      if (res.error) throw new Error(res.error);
      const hash = await walletClient.sendTransaction({ to: res.to as `0x${string}`, data: res.data as `0x${string}` });
      const short = typeof hash === "string" ? hash.slice(0, 18) + "…" : "sent";
      setStates((prev) => ({ ...prev, [name]: { loading: false, error: null, success: short } }));
      setTimeout(() => setStates((prev) => ({ ...prev, [name]: { loading: false, error: null, success: null } })), 10000);
    } catch (e: any) {
      setStates((prev) => ({ ...prev, [name]: { loading: false, error: e.message, success: null } }));
    }
  };

  const [settingAll, setSettingAll] = useState(false);
  const [settingAllProgress, setSettingAllProgress] = useState<string | null>(null);

  const setAllOnchain = async () => {
    const pending = ipfsRecords.filter(r => (cids[r.name] || "").trim());
    if (!pending.length || !walletClient) return;
    setSettingAll(true);
    for (const record of pending) {
      setSettingAllProgress(`Setting ${record.name} (${pending.indexOf(record) + 1}/${pending.length})…`);
      await setOnchain(record.name);
    }
    setSettingAll(false);
    setSettingAllProgress(null);
  };

  const anyContenthash = ipfsRecords.some((r) => r.contenthash);

  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gb-input/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Upload className="w-4 h-4 text-gb-muted" />
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-100">IPFS Browser Resolution</p>
            <p className="text-xs text-gb-muted mt-0.5">
              {anyContenthash
                ? `${ipfsRecords.filter((r) => r.contenthash).length} name${ipfsRecords.filter((r) => r.contenthash).length !== 1 ? "s" : ""} with contenthash — set each on-chain for Brave / native browser`
                : "No contenthash set — Brave can\'t resolve without an on-chain CID"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {anyContenthash
            ? <span className="text-[10px] px-2 py-0.5 rounded bg-green-950/40 border border-green-800 text-green-400">Ready</span>
            : <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800 text-amber-400">Missing</span>}
          {open ? <ChevronUp className="w-4 h-4 text-gb-muted" /> : <ChevronDown className="w-4 h-4 text-gb-muted" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gb-border px-5 py-5 space-y-5">

          {/* Explanation + Renew button */}
          <div className="bg-gb-input rounded-lg p-4 text-sm text-gb-faint space-y-3">
            <p>Brave and native ENS browsers call <code className="text-gb-accent text-xs bg-black/40 px-1 rounded">contenthash()</code> directly on the resolver — they don&apos;t follow CCIP Read. Each name needs its own on-chain CID so the right page loads.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={renewCids}
                disabled={renewing}
                className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                {renewing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {renewing ? "Building & pinning… (~2 min)" : "Renew CIDs"}
              </button>
              <span className="text-xs text-[#555]">Rebuilds the frontend, pins to Pinata, and auto-fills all CIDs below.</span>
            </div>
            {renewSuccess && <p className="text-xs text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> {renewSuccess}</p>}
            {renewError && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle className="w-3 h-3 shrink-0" /> {renewError}</p>}
          </div>

          {/* Pinata JWT */}
          <div className="space-y-2">
            <p className="text-[11px] text-gb-muted uppercase tracking-wide">Pinata JWT</p>
            {jwtSet && !showJwt ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> JWT configured</span>
                <button onClick={() => setShowJwt(true)} className="text-xs text-gb-muted hover:text-gb-faint transition-colors flex items-center gap-1">
                  <Key className="w-3 h-3" /> Replace
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  value={pinatJwt}
                  onChange={(e) => setPinatJwt(e.target.value)}
                  placeholder="eyJhbGci…"
                  className="flex-1 bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-zinc-600 outline-none transition-colors"
                />
                <button
                  onClick={saveJwt}
                  disabled={!pinatJwt.trim()}
                  className="flex items-center gap-1.5 bg-gb-accentD hover:bg-gb-accent disabled:opacity-40 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors shrink-0"
                >
                  <Check className="w-4 h-4" /> Save
                </button>
              </div>
            )}
            {jwtSuccess && <p className="text-xs text-green-400">{jwtSuccess}</p>}
          </div>

          {/* Per-name rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-gb-muted uppercase tracking-wide">Set Contenthash Per Name</p>
              {ipfsRecords.length > 1 && (
                <button
                  onClick={setAllOnchain}
                  disabled={settingAll || !walletClient || !ipfsRecords.some(r => (cids[r.name] || "").trim())}
                  className="flex items-center gap-1.5 bg-amber-900/40 hover:bg-amber-800/60 border border-amber-700/50 disabled:opacity-40 text-amber-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  title="Sends one tx per name sequentially — MetaMask will prompt for each"
                >
                  {settingAll ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Link className="w-3 h-3" />}
                  {settingAll ? settingAllProgress : `Set All (${ipfsRecords.filter(r => (cids[r.name] || "").trim()).length} txs)`}
                </button>
              )}
            </div>
            {ipfsRecords.length === 0 ? (
              <p className="text-xs text-[#444] italic">No records found — add names in the Records section above first.</p>
            ) : (
              ipfsRecords.map((record) => {
                const state = states[record.name] || { loading: false, error: null, success: null };
                const cid = cids[record.name] || "";
                return (
                  <div key={record.name} className="bg-gb-bg border border-gb-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-gb-accent">{record.name}</span>
                      {state.success && (
                        <span className="text-[10px] text-green-400 flex items-center gap-1">
                          <Check className="w-3 h-3" /> tx: {state.success}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={cid}
                        onChange={(e) => setCids((prev) => ({ ...prev, [record.name]: e.target.value.trim() }))}
                        placeholder="baf… or Qm…"
                        className="flex-1 bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-zinc-600 outline-none transition-colors"
                      />
                      <button
                        onClick={() => setOnchain(record.name)}
                        disabled={state.loading || !cid.trim() || !walletClient}
                        title={!walletClient ? "Connect wallet first" : !cid.trim() ? "Enter a CID first" : `Set contenthash for ${record.name} on-chain`}
                        className="flex items-center gap-1.5 bg-amber-900/40 hover:bg-amber-800/60 border border-amber-700/50 disabled:opacity-40 text-amber-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors shrink-0 whitespace-nowrap"
                      >
                        {state.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
                        {state.loading ? "Sending tx…" : "Set On-chain"}
                      </button>
                    </div>
                    {state.error && (
                      <p className="text-[11px] text-red-400 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {state.error}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}
    </div>
  );
}


// ─── Main page ────────────────────────────────────────────────────────────────

export default function EnsPage() {
  const { token } = useAuth();
  const { env, envKey } = useGatewayEnv();
  const { data: walletClient } = useWalletClient();
  const [records, setRecords] = useState<GatewayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [gwStatus, setGwStatus] = useState<any>(null);
  const [copiedResolver, setCopiedResolver] = useState(false);
  const [tab, setTab] = useState<"pages" | "profiles">("pages");
  const [profileCid, setProfileCid] = useState("");
  const [settingAllProfiles, setSettingAllProfiles] = useState(false);
  const [renewingProfile, setRenewingProfile] = useState(false);
  const [renewProfileError, setRenewProfileError] = useState<string | null>(null);
  const renewProfileCid = async () => {
    setRenewingProfile(true); setRenewProfileError(null);
    try {
      const res = await fetch("http://merlinis-mac-mini.local:7078/publish/profile", { method: "POST", signal: AbortSignal.timeout(660000) });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Build failed");
      setProfileCid(d.cid as string);
    } catch (e: any) {
      setRenewProfileError(e?.message?.includes("fetch") ? "Could not reach publish server — is Echo running?" : (e?.message ?? "Unknown error"));
    } finally {
      setRenewingProfile(false);
    }
  };

  const [profileStates, setProfileStates] = useState<Record<string, { loading: boolean; error: string | null; success: string | null }>>({});

  const setProfileOnchain = async (name: string) => {
    const cid = profileCid.trim().replace(/^ipfs:\/\//, "");
    if (!cid || !walletClient) return;
    setProfileStates(prev => ({ ...prev, [name]: { loading: true, error: null, success: null } }));
    try {
      await upsertRecord(token!, name, { contenthash: `ipfs://${cid}` });
      const res = await setContenthashOnchain(token!, cid, name);
      if (res.error) throw new Error(res.error);
      const hash = await walletClient.sendTransaction({ to: res.to as `0x${string}`, data: res.data as `0x${string}` });
      const short = typeof hash === "string" ? hash.slice(0, 18) + "\u2026" : "sent";
      setProfileStates(prev => ({ ...prev, [name]: { loading: false, error: null, success: short } }));
      setTimeout(() => setProfileStates(prev => ({ ...prev, [name]: { loading: false, error: null, success: null } })), 10000);
    } catch (e: any) {
      setProfileStates(prev => ({ ...prev, [name]: { loading: false, error: e.message, success: null } }));
    }
  };

  const pageRecords = records.filter(r => APP_PAGE_NAMES.has(r.name));
  const profileRecords = records.filter(r => !APP_PAGE_NAMES.has(r.name));

  const publicClient = useMemo(
    () => createPublicClient({ chain: { ...mainnet, id: env.chainId as any }, transport: http(env.rpcUrl) }),
    [env.rpcUrl, env.chainId]
  );

  const fetchRecords = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getRecords(token);
      setRecords((data ?? []).map((r: any) => ({ ...r, text_records: r.text_records || {} })));
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { getGatewayStatus().then(setGwStatus).catch(() => {}); }, [envKey]);

  const copyResolver = () => {
    navigator.clipboard.writeText(RESOLVER_CONTRACT);
    setCopiedResolver(true);
    setTimeout(() => setCopiedResolver(false), 2000);
  };

  return (
    <div className="space-y-8 text-slate-100 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">ENS</h1>
          <p className="text-gb-faint text-sm mt-1">Manage records, resolver, and gateway</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
          envKey === "local" ? "border-amber-700 bg-amber-950/30 text-amber-400" : "border-green-800 bg-green-950/30 text-green-400"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${env.color}`} />
          {env.label}
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 p-1 bg-gb-surface border border-gb-border rounded-xl">
        {(["pages", "profiles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t
                ? "bg-gb-accent text-white"
                : "text-gb-muted hover:text-gb-faint"
            }`}
          >
            {t === "pages" ? "Pages" : `Profiles${profileRecords.length ? ` (${profileRecords.length})` : ""}`}
          </button>
        ))}
      </div>

      {tab === "pages" ? (
        <>
          {/* ── Page Records ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Records</p>
              <button onClick={fetchRecords} className="text-xs text-gb-muted hover:text-gb-faint flex items-center gap-1 transition-colors">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            <p className="text-xs text-gb-muted">
              Each entry is an ENS name served by the gateway. Treated as env vars — update instantly, no gas.
            </p>

            {loading ? (
              <p className="text-gb-muted text-sm py-4 text-center">Loading…</p>
            ) : pageRecords.length === 0 ? (
              <p className="text-[#444] text-sm py-4 text-center">No page records yet. Add one below.</p>
            ) : (
              <div className="space-y-2">
                {pageRecords.map((r) => (
                  <RecordCard
                    key={r.name}
                    record={r}
                    token={token!}
                    onSaved={fetchRecords}
                    onDeleted={fetchRecords}
                  />
                ))}
              </div>
            )}

            <AddRecordForm token={token!} onSaved={fetchRecords} />
          </div>

          {/* ── Live Preview ── */}
          <LivePreview />

          {/* ── IPFS Browser Resolution ── */}
          <IpfsPanel token={token!} records={pageRecords} walletClient={walletClient} />
        </>
      ) : (
        <>
          {/* ── Profile Records ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Profiles</p>
              <button onClick={fetchRecords} className="text-xs text-gb-muted hover:text-gb-faint flex items-center gap-1 transition-colors">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
            <p className="text-xs text-gb-muted">
              User-claimed subdomains. Each needs its own on-chain contenthash so eth.limo serves them correctly — use the profile CID below.
            </p>

            {loading ? (
              <p className="text-gb-muted text-sm py-4 text-center">Loading…</p>
            ) : profileRecords.length === 0 ? (
              <p className="text-[#444] text-sm py-4 text-center">No profiles claimed yet.</p>
            ) : (
              <div className="space-y-2">
                {profileRecords.map((r) => (
                  <RecordCard
                    key={r.name}
                    record={r}
                    token={token!}
                    onSaved={fetchRecords}
                    onDeleted={fetchRecords}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Profile CID panel ── */}
          <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
            <p className="text-sm font-semibold">Profile Page CID</p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gb-muted">Shared IPFS CID for all profile subdomains. Set it on-chain for each profile so eth.limo can serve them.</p>
              <button
                onClick={renewProfileCid}
                disabled={renewingProfile}
                className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gb-surface border border-gb-border hover:border-gb-accent text-slate-300 disabled:opacity-40 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${renewingProfile ? "animate-spin" : ""}`} />
                {renewingProfile ? "Building…" : "Renew Profile CID"}
              </button>
            </div>
            {renewProfileError && <p className="text-xs text-red-400">{renewProfileError}</p>}
            <input
              value={profileCid}
              onChange={e => setProfileCid(e.target.value.replace(/^ipfs:\/\//, ""))}
              placeholder="bafybei… (profile template CID)"
              className="w-full bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
            />
            {profileCid && profileRecords.length > 0 && (
              <>
                <div className="space-y-2">
                  {profileRecords.map(r => {
                    const st = profileStates[r.name] || {};
                    return (
                      <div key={r.name} className="flex items-center justify-between gap-3">
                        <span className="text-xs font-mono text-slate-300 truncate">{r.name}</span>
                        {st.success ? (
                          <span className="text-xs text-green-400 shrink-0">✓ {st.success}</span>
                        ) : st.error ? (
                          <span className="text-xs text-red-400 shrink-0 max-w-[200px] truncate">{st.error}</span>
                        ) : (
                          <button
                            disabled={!walletClient || st.loading}
                            onClick={() => setProfileOnchain(r.name)}
                            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-gb-accentD hover:bg-gb-accent text-white disabled:opacity-40 transition-colors"
                          >{st.loading ? "…" : "Set On-chain"}</button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  disabled={settingAllProfiles || !walletClient}
                  onClick={async () => {
                    setSettingAllProfiles(true);
                    for (const r of profileRecords) {
                      await setProfileOnchain(r.name);
                    }
                    setSettingAllProfiles(false);
                  }}
                  className="w-full py-2 rounded-lg bg-gb-accentD hover:bg-gb-accent text-white text-xs font-medium disabled:opacity-40 transition-colors"
                >{settingAllProfiles ? "Setting…" : `Set All Profiles On-chain (${profileRecords.length} txs)`}</button>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Resolver ── */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold">Resolver Contract</p>
        <div className="flex items-center gap-3 bg-gb-input rounded-lg px-4 py-3">
          <Globe className="w-4 h-4 text-gb-accent shrink-0" />
          <code className="text-amber-300 text-sm font-mono flex-1 break-all">{RESOLVER_CONTRACT}</code>
          <button
            onClick={copyResolver}
            className="flex items-center gap-2 bg-gb-accentD hover:bg-gb-accent px-3 py-1.5 rounded-lg text-sm text-white transition-colors shrink-0"
          >
            {copiedResolver ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedResolver ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="space-y-2 text-sm">
          {[
            { label: "Gateway URL", value: gwStatus?.gateway || env.url },
            { label: "Signer", value: gwStatus?.signer || "—" },
            { label: "RPC", value: env.rpcUrl },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-gb-border last:border-0">
              <span className="text-gb-muted text-xs">{label}</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-gb-faint truncate max-w-64">{value}</span>
                <CopyButton text={value} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <a href={`https://etherscan.io/address/${RESOLVER_CONTRACT}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gb-muted hover:text-gb-faint transition-colors">
            Etherscan <ExternalLink className="w-3 h-3" />
          </a>
          {envKey === "local" && (
            <a href={`http://192.168.68.52:4000/address/${RESOLVER_CONTRACT}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-300 transition-colors">
              Blockscout <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <a href="https://app.ens.domains" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gb-muted hover:text-gb-faint transition-colors">
            ENS Manager <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ── Resolver Checker ── */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold">Resolver Checker</p>
        <p className="text-xs text-gb-muted">Verify that an ENS name is pointed at this resolver — queried against <span className="text-gb-faint">{env.rpc}</span>.</p>
        <ResolverChecker publicClient={publicClient} />
      </div>

    </div>
  );
}
