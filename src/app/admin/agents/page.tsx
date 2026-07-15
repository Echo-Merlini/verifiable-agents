"use client";

import { useEffect, useState } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from "wagmi";
import { parseEther, formatEther } from "viem";
import { useAuth } from "@/hooks/useAuth";
import { getAgents, getSkillsByRegistry, createSkill, updateSkill, deleteSkill } from "@/lib/api";
import { timeAgo, shortAddr } from "@/lib/utils";
import {
  ExternalLink, RefreshCw, Bot, Plus, AlertCircle, Loader2, Check,
  RotateCcw, Settings, Trash2, Pencil, Copy, Shield, ArrowRightLeft, Sparkles,
} from "lucide-react";
import { getGatewayUrl } from "@/hooks/useGatewayEnv";
import {
  AGENT_FACTORY_ABI, AGENT_REGISTRY_ABI, FACTORY_ADDRESS, REGISTRY_CHAIN_ID, isZero,
  GENESIS_REGISTRY_ABI, GENESIS_REGISTRY_ADDRESS, GENESIS_CHAIN_ID, GENESIS_PHASE, GENESIS_PHASE_LABEL,
} from "@/lib/erc8004";
import type { Address, Hex } from "viem";

// ── Types ─────────────────────────────────────────────────────────────────────

type AgentService = { name: string; endpoint: string; version?: string };
type AgentEntry = {
  registry: string; agent_id: string; owner_address: string;
  name: string; description: string; image: string;
  source_contract: string; source_token_id: string;
  services: AgentService[]; chain_id: number; active: number; created_at: number;
};

type CollectionEntry = {
  address: Address;
  registry: Address;
  isDelisted: boolean;
};

type Personality = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  enabled: number;
  registry_address: string;
};

const PROVIDERS = ["openai", "anthropic", "groq", "mistral"] as const;
const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  groq: "llama-3.3-70b-versatile",
  mistral: "mistral-small-latest",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gb-border/50 pb-1.5">
      <span className="text-gb-muted">{label}</span>
      <span className="text-slate-100">{value}</span>
    </div>
  );
}

function ServiceBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    MCP: "bg-amber-950/50 text-amber-300 border-amber-500/20",
    A2A: "bg-amber-950/50 text-amber-300 border-amber-500/20",
    ENS: "bg-emerald-950/50 text-emerald-300 border-emerald-500/20",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs border ${colors[name.toUpperCase()] ?? "bg-gb-input text-gb-faint border-gb-border"}`}>
      {name}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-2 text-gb-muted hover:text-slate-100 transition-colors shrink-0"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Factory not deployed banner ───────────────────────────────────────────────

function FactoryPendingBanner() {
  return (
    <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 text-sm">
      <p className="font-medium text-amber-300 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Factory Deployment Pending
      </p>
      <p className="text-amber-400/70 text-xs mt-1 leading-relaxed">
        Deploy <code className="font-mono">AgentIdentityRegistryFactory</code> on mainnet via the{" "}
        <a href="/admin/settings" className="text-amber-300 hover:underline">Settings → ERC-8004 Factory</a>{" "}
        card, then update <code className="font-mono">NEXT_PUBLIC_FACTORY_ADDRESS</code> in{" "}
        <code className="font-mono">.env.local</code>.
      </p>
    </div>
  );
}

// ── Contract Actions (mint price, royalty, transfer) ─────────────────────────

function ContractActions({ registry }: { registry: Address }) {
  const chainId = useChainId();
  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Read current on-chain values
  const { data: onchainMintPrice, refetch: refetchPrice } = useReadContract({
    address: registry, abi: AGENT_REGISTRY_ABI, functionName: "mintPrice",
  });
  const { data: onchainRoyaltyBps, refetch: refetchBps } = useReadContract({
    address: registry, abi: AGENT_REGISTRY_ABI, functionName: "royaltyBps",
  });
  const { data: onchainOwner, refetch: refetchOwner } = useReadContract({
    address: registry, abi: AGENT_REGISTRY_ABI, functionName: "owner",
  });

  const [mintPriceEth, setMintPriceEth] = useState("");
  const [royaltyBpsPct, setRoyaltyBpsPct] = useState("");   // % displayed
  const [royaltyReceiver, setRoyaltyReceiver] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferConfirm, setTransferConfirm] = useState(false);
  const [activeAction, setActiveAction] = useState<"mintPrice" | "royalty" | "transfer" | null>(null);

  useEffect(() => {
    if (confirmed) {
      refetchPrice(); refetchBps(); refetchOwner();
      setActiveAction(null);
      setTransferTo(""); setTransferConfirm(false);
      reset();
    }
  }, [confirmed]);

  const busy = isPending || confirming;

  function sendMintPrice() {
    if (!mintPriceEth) return;
    setActiveAction("mintPrice");
    writeContract({
      address: registry, abi: AGENT_REGISTRY_ABI, functionName: "setMintPrice",
      args: [parseEther(mintPriceEth)],
    });
  }

  function sendRoyalty() {
    if (!royaltyReceiver || !royaltyBpsPct) return;
    setActiveAction("royalty");
    const bps = Math.round(parseFloat(royaltyBpsPct) * 100); // % → BPS
    writeContract({
      address: registry, abi: AGENT_REGISTRY_ABI, functionName: "setRoyalty",
      args: [royaltyReceiver as Address, BigInt(bps)],
    });
  }

  function sendTransfer() {
    if (!transferTo || !transferConfirm) return;
    setActiveAction("transfer");
    writeContract({
      address: registry, abi: AGENT_REGISTRY_ABI, functionName: "transferOwnership",
      args: [transferTo as Address],
    });
  }

  const currentPrice = onchainMintPrice !== undefined
    ? `${formatEther(onchainMintPrice as bigint)} ETH`
    : "—";
  const currentBps = onchainRoyaltyBps !== undefined
    ? `${Number(onchainRoyaltyBps) / 100}%`
    : "—";

  const txErrorMsg = writeError
    ? (writeError as any)?.shortMessage ?? writeError.message.slice(0, 80)
    : null;

  return (
    <div className="space-y-5">
      {/* ── Mint Price ── */}
      <div className="space-y-2">
        <p className="text-xs text-gb-muted uppercase tracking-wide">Mint Price</p>
        <p className="text-[10px] text-gb-muted">Current: <span className="text-gb-faint">{currentPrice}</span></p>
        <div className="flex gap-2">
          <input
            type="number" min="0" step="0.001"
            value={mintPriceEth}
            onChange={e => setMintPriceEth(e.target.value)}
            placeholder="0.01"
            className="flex-1 bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-gb-muted outline-none focus:border-gb-accent transition-colors"
          />
          <span className="flex items-center text-xs text-gb-muted px-2">ETH</span>
          <button
            onClick={sendMintPrice}
            disabled={busy || !mintPriceEth}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gb-accentD hover:bg-gb-accent text-white text-xs disabled:opacity-40 transition-colors"
          >
            {busy && activeAction === "mintPrice" ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {confirming && activeAction === "mintPrice" ? "Confirming…" : "Set Price"}
          </button>
        </div>
        {confirmed && activeAction === null && txHash && (
          <p className="text-[10px] text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Tx confirmed</p>
        )}
      </div>

      {/* ── Royalty ── */}
      <div className="space-y-2">
        <p className="text-xs text-gb-muted uppercase tracking-wide">Royalty</p>
        <p className="text-[10px] text-gb-muted">Current BPS: <span className="text-gb-faint">{currentBps}</span></p>
        <div className="flex gap-2">
          <input
            type="number" min="0" max="100" step="0.1"
            value={royaltyBpsPct}
            onChange={e => setRoyaltyBpsPct(e.target.value)}
            placeholder="5"
            className="w-24 bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-gb-muted outline-none focus:border-gb-accent transition-colors"
          />
          <span className="flex items-center text-xs text-gb-muted px-1">%</span>
          <input
            type="text"
            value={royaltyReceiver}
            onChange={e => setRoyaltyReceiver(e.target.value)}
            placeholder="Receiver 0x…"
            className="flex-1 bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-gb-muted outline-none focus:border-gb-accent transition-colors font-mono"
          />
        </div>
        <button
          onClick={sendRoyalty}
          disabled={busy || !royaltyBpsPct || !royaltyReceiver}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gb-accentD hover:bg-gb-accent text-white text-xs disabled:opacity-40 transition-colors"
        >
          {busy && activeAction === "royalty" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
          {confirming && activeAction === "royalty" ? "Confirming…" : "Set Royalty"}
        </button>
      </div>

      {/* ── Transfer Ownership ── */}
      <div className="space-y-2 border-t border-gb-border pt-4">
        <p className="text-xs text-gb-muted uppercase tracking-wide flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-red-400" /> Transfer Contract Ownership
        </p>
        <p className="text-[10px] text-gb-muted">
          Current owner: <span className="font-mono text-gb-faint">{onchainOwner ? shortAddr(onchainOwner as Address) : "—"}</span>
        </p>
        <input
          type="text"
          value={transferTo}
          onChange={e => setTransferTo(e.target.value)}
          placeholder="New owner 0x…"
          className="w-full bg-gb-input border border-red-900/50 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-gb-muted outline-none focus:border-red-500/60 transition-colors font-mono"
        />
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gb-muted">
          <input
            type="checkbox"
            checked={transferConfirm}
            onChange={e => setTransferConfirm(e.target.checked)}
            className="accent-red-500"
          />
          I understand this is irreversible — I will lose admin control
        </label>
        <button
          onClick={sendTransfer}
          disabled={busy || !transferTo || !transferConfirm}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-900/60 hover:bg-red-800/70 border border-red-700/40 text-red-300 text-xs disabled:opacity-40 transition-colors"
        >
          {busy && activeAction === "transfer" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
          {confirming && activeAction === "transfer" ? "Confirming…" : "Transfer Ownership"}
        </button>
      </div>

      {txErrorMsg && (
        <p className="text-[10px] text-red-400 flex items-start gap-1">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" /> {txErrorMsg}
        </p>
      )}
    </div>
  );
}

// ── Credit metering mode toggle (Community pool ⇄ Wallet-only) ─────────────────

function MeteringToggle({ registry, token }: { registry: Address; token: string }) {
  const [mode, setMode]       = useState<"community" | "wallet" | null>(null);
  const [pool, setPool]       = useState<number | null>(null);
  const [saving, setSaving]   = useState(false);
  const genesisAddr = (process.env.NEXT_PUBLIC_GENESIS_REGISTRY_ADDRESS || "").toLowerCase();
  const isGenesis   = !!genesisAddr && registry.toLowerCase() === genesisAddr;

  async function load() {
    try {
      const r = await fetch(`${getGatewayUrl()}/admin/registries/${registry.toLowerCase()}/credits`,
        { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setMode(d.meteringMode === "wallet" ? "wallet" : "community");
      setPool(typeof d.credits === "number" ? d.credits : 0);
    } catch { setMode("community"); setPool(0); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [registry]);

  async function pick(next: "community" | "wallet") {
    if (isGenesis || saving || next === mode) return;
    setSaving(true);
    try {
      const r = await fetch(`${getGatewayUrl()}/admin/registries/${registry.toLowerCase()}/metering`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (r.ok) setMode(next);
    } finally { setSaving(false); }
  }

  const effective = isGenesis ? "wallet" : mode;

  return (
    <div className="bg-gb-input border border-gb-border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-100">Credit Metering</p>
        {pool !== null && <span className="text-[10px] text-gb-muted font-mono">pool: {pool.toLocaleString()}</span>}
      </div>
      <p className="text-[10px] text-gb-muted">
        {isGenesis
          ? "Self-sourced (genesis) — always wallet-metered. Each agent charges its owner's wallet."
          : "How agents in this collection charge usage. Community pool is shared/subsidized; users can switch to their own wallet in my-agents."}
      </p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        {([["community", "Community pool", "pool-first, subsidized"], ["wallet", "Wallet-only", "each user pays"]] as const).map(([val, title, sub]) => {
          const active = effective === val;
          return (
            <button key={val} disabled={isGenesis || saving} onClick={() => pick(val)}
              className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                active ? "border-gb-accent bg-gb-accent/10" : "border-gb-border hover:border-gb-faint"
              } ${isGenesis ? "opacity-60 cursor-not-allowed" : ""}`}>
              <p className={`text-xs font-medium ${active ? "text-gb-accent" : "text-slate-200"}`}>{title}</p>
              <p className="text-[10px] text-gb-muted mt-0.5">{sub}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Collection Configure Panel ────────────────────────────────────────────────

interface McpServer { id: string; name: string; description: string; active: number; }

type PersonalityForm = {
  name: string;
  description: string;
  system_prompt: string;
  provider: string;
  model: string;
};

const emptyForm = (): PersonalityForm => ({
  name: "", description: "", system_prompt: "You are a helpful AI agent.",
  provider: "anthropic", model: DEFAULT_MODELS["anthropic"],
});

function ConfigurePanel({
  registry,
  token,
  onClose,
}: {
  registry: Address;
  token: string;
  onClose: () => void;
}) {
  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // id or "new"
  const [form, setForm] = useState<PersonalityForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [allMcps, setAllMcps] = useState<McpServer[]>([]);
  const [editingMcpIds, setEditingMcpIds] = useState<string[]>([]);

  const mcpUrl = `${getGatewayUrl()}/agent/${registry.toLowerCase()}/`;

  async function load() {
    setLoading(true);
    const [skills, mcpRes] = await Promise.all([
      getSkillsByRegistry(token, registry.toLowerCase()),
      fetch(`${getGatewayUrl()}/admin/mcp-servers`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    setPersonalities(skills ?? []);
    setAllMcps((Array.isArray(mcpRes) ? mcpRes as McpServer[] : []).filter(m => m.active));
    setLoading(false);
  }

  useEffect(() => { load(); }, [registry]);

  function startAdd() {
    setForm(emptyForm());
    setEditingMcpIds([]);
    setEditing("new");
  }

  function startEdit(p: Personality) {
    setForm({
      name: p.name,
      description: p.description,
      system_prompt: p.system_prompt,
      provider: p.provider,
      model: p.model,
    });
    setEditingMcpIds([]);
    fetch(`${getGatewayUrl()}/admin/skills/${p.id}/mcp-servers`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : []).then((mcps: McpServer[]) => {
      setEditingMcpIds(Array.isArray(mcps) ? mcps.map(m => m.id) : []);
    }).catch(() => {});
    setEditing(p.id);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError("");
    let result;
    if (editing === "new") {
      result = await createSkill(token, {
        ...form,
        registry_address: registry.toLowerCase(),
        enabled: true,
        temperature: 0.7,
        max_tokens: 2048,
      });
    } else {
      result = await updateSkill(token, editing!, form);
    }
    setSaving(false);
    if (!result) {
      setSaveError(token ? "Save failed — check gateway logs or API key settings." : "Not authenticated. Sign in to the admin first.");
      return;
    }
    if (editing !== "new") {
      await fetch(`${getGatewayUrl()}/admin/skills/${editing}/mcp-servers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mcp_server_ids: editingMcpIds }),
      }).catch(() => {});
    }
    setEditing(null);
    setSaveError("");
    await load();
  }

  async function remove(id: string) {
    setDeleting(id);
    await deleteSkill(token, id);
    await load();
    setDeleting(null);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-gb-surface border-l border-gb-border h-full overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gb-surface border-b border-gb-border px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gb-muted uppercase tracking-wide">Configure Collection</p>
            <p className="font-mono text-sm text-slate-100">{shortAddr(registry)}</p>
          </div>
          <button onClick={onClose} className="text-gb-muted hover:text-slate-100 text-lg leading-none">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* MCP endpoint */}
          <div className="space-y-2">
            <p className="text-xs text-gb-muted uppercase tracking-wide">MCP Endpoint</p>
            <div className="bg-gb-input border border-gb-border rounded-lg px-3 py-2 flex items-center justify-between text-xs font-mono">
              <span className="text-gb-faint truncate">{mcpUrl}{"{agentId}"}/mcp</span>
              <CopyButton text={mcpUrl} />
            </div>
            <p className="text-[10px] text-gb-muted">
              Each agent&apos;s MCP server lives at <code className="font-mono">/agent/&lt;registry&gt;/&lt;agentId&gt;/mcp</code>
            </p>
          </div>

          {/* Contract actions */}
          <div className="bg-gb-input border border-gb-border rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-100 mb-3">Contract Settings</p>
            <ContractActions registry={registry} />
          </div>

          {/* Credit metering mode */}
          <MeteringToggle registry={registry} token={token} />

          {/* Personalities */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gb-muted uppercase tracking-wide">Personalities</p>
              {editing !== "new" && (
                <button
                  onClick={startAdd}
                  className="flex items-center gap-1.5 text-xs text-gb-accent hover:text-gb-accentD transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Personality
                </button>
              )}
            </div>

            {/* Add form */}
            {editing === "new" && (
              <div className="bg-gb-input border border-gb-accent/40 rounded-lg p-4">
                <PersonalityFormCard
                  form={form}
                  setForm={setForm}
                  onSave={save}
                  onCancel={() => { setEditing(null); setSaveError(""); }}
                  saving={saving}
                  error={saveError}
                  isNew={true}
                />
              </div>
            )}

            {/* List */}
            {loading ? (
              <div className="flex items-center gap-2 text-gb-muted text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading&hellip;
              </div>
            ) : personalities.length === 0 && editing !== "new" ? (
              <div className="bg-gb-input border border-dashed border-gb-border rounded-lg px-4 py-6 text-center text-sm text-gb-muted">
                No personalities yet. Add one to enable AI chat for agents in this collection.
              </div>
            ) : (
              <div className="space-y-2">
                {personalities.map(p => (
                  <div key={p.id} className={`bg-gb-input border rounded-lg transition-colors ${editing === p.id ? "border-gb-accent" : "border-gb-border"}`}>
                    <div className="flex items-start justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-slate-100">{p.name}</p>
                        {p.description && <p className="text-xs text-gb-muted mt-0.5 truncate">{p.description}</p>}
                        <p className="text-[10px] text-gb-faint mt-1 font-mono">{p.provider} · {p.model}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => editing === p.id ? setEditing(null) : startEdit(p)}
                          className="text-gb-muted hover:text-slate-100 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => remove(p.id)}
                          disabled={deleting === p.id}
                          className="text-gb-muted hover:text-red-400 transition-colors disabled:opacity-40"
                          title="Delete"
                        >
                          {deleting === p.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </div>
                    {editing === p.id && (
                      <div className="border-t border-gb-border px-4 pb-4 pt-3">
                        <PersonalityFormCard
                          form={form}
                          setForm={setForm}
                          onSave={save}
                          onCancel={() => { setEditing(null); setSaveError(""); }}
                          saving={saving}
                          error={saveError}
                          isNew={false}
                          availableMcps={allMcps}
                          selectedMcpIds={editingMcpIds}
                          onToggleMcp={(id) => setEditingMcpIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonalityFormCard({
  form, setForm, onSave, onCancel, saving, error, isNew,
  availableMcps = [], selectedMcpIds = [], onToggleMcp,
}: {
  form: PersonalityForm;
  setForm: (f: PersonalityForm | ((prev: PersonalityForm) => PersonalityForm)) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error?: string;
  isNew: boolean;
  availableMcps?: McpServer[];
  selectedMcpIds?: string[];
  onToggleMcp?: (id: string) => void;
}) {
  function field(key: keyof PersonalityForm, value: string) {
    setForm((f: PersonalityForm) => {
      const updated = { ...f, [key]: value };
      if (key === "provider") updated.model = DEFAULT_MODELS[value] ?? "";
      return updated;
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-[10px] text-gb-muted uppercase mb-1">Name *</label>
          <input
            value={form.name}
            onChange={e => field("name", e.target.value)}
            placeholder="e.g. Friendly Goblin"
            className="w-full bg-gb-surface border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-gb-muted outline-none transition-colors"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] text-gb-muted uppercase mb-1">Description</label>
          <input
            value={form.description}
            onChange={e => field("description", e.target.value)}
            placeholder="Short description shown to users"
            className="w-full bg-gb-surface border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-gb-muted outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gb-muted uppercase mb-1">Provider</label>
          <select
            value={form.provider}
            onChange={e => field("provider", e.target.value)}
            className="w-full bg-gb-surface border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm text-slate-100 outline-none transition-colors"
          >
            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gb-muted uppercase mb-1">Model</label>
          <input
            value={form.model}
            onChange={e => field("model", e.target.value)}
            placeholder={DEFAULT_MODELS[form.provider] ?? "model-name"}
            className="w-full bg-gb-surface border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-gb-muted outline-none transition-colors"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] text-gb-muted uppercase mb-1">System Prompt</label>
          <textarea
            value={form.system_prompt}
            onChange={e => field("system_prompt", e.target.value)}
            rows={4}
            className="w-full bg-gb-surface border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-gb-muted outline-none transition-colors resize-none font-mono"
          />
        </div>
      </div>
      {!isNew && availableMcps.length > 0 && (
        <div>
          <label className="block text-[10px] text-gb-muted uppercase mb-2">MCP Servers</label>
          <div className="flex flex-wrap gap-2">
            {availableMcps.map(m => {
              const on = selectedMcpIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onToggleMcp?.(m.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    on
                      ? "bg-gb-accent/20 border-gb-accent text-gb-accent"
                      : "bg-gb-input border-gb-border text-gb-muted hover:border-gb-muted"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {error && (
        <p className="text-xs text-red-400 bg-red-950/20 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-gb-border text-xs text-gb-faint hover:text-slate-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gb-accentD hover:bg-gb-accent text-white text-xs disabled:opacity-40 transition-colors"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {isNew ? "Create" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Collections tab ───────────────────────────────────────────────────────────

// ── Genesis Agents (universal mint) — a self-sourced "collection" with phased pricing ──
function ConfigField({ label, value, setValue, placeholder, onClick, busy }: {
  label: string; value: string; setValue: (v: string) => void; placeholder: string; onClick: () => void; busy: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-gb-muted mb-1">{label}</label>
      <div className="flex gap-2">
        <input value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder}
          className="flex-1 bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-gb-muted outline-none" />
        <button disabled={busy} onClick={onClick} className="px-3 py-1.5 rounded-lg bg-gb-accentD hover:bg-gb-accent text-white text-xs disabled:opacity-40">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Set"}
        </button>
      </div>
    </div>
  );
}

function GenesisCollectionCard({ token }: { token: string }) {
  const registry = GENESIS_REGISTRY_ADDRESS;
  const ready = !isZero(registry);
  const readOpts = { address: registry, abi: GENESIS_REGISTRY_ABI, chainId: GENESIS_CHAIN_ID } as const;
  const { data: phase,          refetch: rPhase } = useReadContract({ ...readOpts, functionName: "phase",          query: { enabled: ready } });
  const { data: publicPrice,    refetch: rPub   } = useReadContract({ ...readOpts, functionName: "publicPrice",    query: { enabled: ready } });
  const { data: allowlistPrice, refetch: rAl    } = useReadContract({ ...readOpts, functionName: "allowlistPrice", query: { enabled: ready } });
  const { data: maxSupply,      refetch: rMax   } = useReadContract({ ...readOpts, functionName: "maxSupply",      query: { enabled: ready } });
  const { data: totalSupply,    refetch: rTot   } = useReadContract({ ...readOpts, functionName: "totalSupply",    query: { enabled: ready } });
  const { data: allowlistRoot,  refetch: rRoot  } = useReadContract({ ...readOpts, functionName: "allowlistRoot",  query: { enabled: ready } });

  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();

  const [open, setOpen] = useState(false);
  const [pub, setPub] = useState("");
  const [al, setAl] = useState("");
  const [cap, setCap] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Base personality (registry-level skill; genesis agents without their own fall back to it)
  const [basePrompt, setBasePrompt] = useState("");
  const [baseSkillId, setBaseSkillId] = useState<string | null>(null);
  const [baseLoaded, setBaseLoaded] = useState(false);
  const [baseSaving, setBaseSaving] = useState(false);

  useEffect(() => {
    if (!open || !ready || baseLoaded) return;
    (async () => {
      try {
        const skills: any = await getSkillsByRegistry(token, registry.toLowerCase());
        const base = Array.isArray(skills) ? skills[0] : null;
        if (base) { setBaseSkillId(base.id); setBasePrompt(base.system_prompt || ""); }
      } catch {}
      setBaseLoaded(true);
    })();
  }, [open, ready, baseLoaded, token, registry]);

  async function saveBasePersonality() {
    setBaseSaving(true); setMsg(null);
    try {
      if (baseSkillId) {
        await updateSkill(token, baseSkillId, { system_prompt: basePrompt });
      } else {
        const created: any = await createSkill(token, {
          name: "Genesis Base",
          description: "Default personality + platform guardrails for Universal Mint agents",
          provider: "anthropic", model: "claude-haiku-4-5-20251001",
          system_prompt: basePrompt, registry_address: registry.toLowerCase(), tools: "[]",
          enabled: true, // else the route stores enabled=0 → hidden from picker + chat fallback
        });
        if (created?.id) setBaseSkillId(created.id);
      }
      setMsg("Base personality saved.");
    } catch (e: any) { setMsg(e?.message || "Save failed"); }
    setBaseSaving(false);
  }

  const refetchAll = () => { rPhase(); rPub(); rAl(); rMax(); rTot(); rRoot(); };

  async function run(label: string, fn: string, args: readonly unknown[]) {
    setMsg(null); setBusy(label);
    try {
      if (chainId !== GENESIS_CHAIN_ID) await switchChainAsync({ chainId: GENESIS_CHAIN_ID });
      const hash = await writeContractAsync({ address: registry, abi: GENESIS_REGISTRY_ABI, functionName: fn as any, args: args as any, chainId: GENESIS_CHAIN_ID });
      setMsg(`${label} sent: ${hash.slice(0, 10)}…`);
      setTimeout(refetchAll, 4000);
    } catch (e: any) { setMsg(e?.shortMessage || e?.message || `${label} failed`); }
    setBusy(null);
  }

  async function syncRoot() {
    setMsg("Fetching allowlist root from gateway…");
    try {
      const r = await fetch(`${getGatewayUrl()}/api/genesis/allowlist-proof?address=0x0000000000000000000000000000000000000001`);
      const d = await r.json();
      if (!d.root) throw new Error("No root returned");
      await run("setAllowlistRoot", "setAllowlistRoot", [d.root as Hex]);
    } catch (e: any) { setMsg(e?.message || "Root sync failed"); }
  }

  if (!ready) return null; // genesis registry not configured → hide

  const phaseNum = Number(phase ?? 0);
  const left = maxSupply !== undefined && (maxSupply as bigint) > 0n
    ? Number((maxSupply as bigint) - (totalSupply ?? 0n)) : null;

  return (
    <div className="bg-gb-surface border border-amber-500/30 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Genesis Agents <span className="text-[10px] text-amber-300/70 uppercase tracking-wide">· Universal Mint</span></p>
            <p className="text-[11px] text-gb-muted font-mono">{shortAddr(registry)} · self-sourced · no NFT required</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gb-muted">
          <span className="px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-200">{GENESIS_PHASE_LABEL[phaseNum]}</span>
          <span>{publicPrice !== undefined ? `${formatEther(publicPrice as bigint)} ETH` : "…"}</span>
          <span>{String(totalSupply ?? 0n)}{left !== null ? ` / ${String(maxSupply)}` : ""} minted</span>
          <button onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gb-border hover:border-gb-muted text-gb-muted hover:text-slate-100 transition-colors">
            <Settings className="w-3.5 h-3.5" /> Configure
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gb-border px-4 py-4 space-y-4 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gb-muted mb-1.5">Phase</p>
            <div className="flex gap-2">
              {(["Closed", "Allowlist", "Public"] as const).map(p => (
                <button key={p} disabled={!!busy} onClick={() => run(`setPhase ${p}`, "setPhase", [GENESIS_PHASE[p]])}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition-colors ${phaseNum === GENESIS_PHASE[p] ? "bg-gb-accentD text-white" : "border border-gb-border text-gb-muted hover:text-slate-100"}`}>{p}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ConfigField label="Public price (ETH)" value={pub} setValue={setPub} placeholder={publicPrice !== undefined ? formatEther(publicPrice as bigint) : "0.03"}
              busy={busy === "setPublicPrice"} onClick={() => run("setPublicPrice", "setPublicPrice", [parseEther(pub || "0")])} />
            <ConfigField label="Allowlist price (ETH)" value={al} setValue={setAl} placeholder={allowlistPrice !== undefined ? formatEther(allowlistPrice as bigint) : "0"}
              busy={busy === "setAllowlistPrice"} onClick={() => run("setAllowlistPrice", "setAllowlistPrice", [parseEther(al || "0")])} />
            <ConfigField label="Max supply (0 = ∞)" value={cap} setValue={setCap} placeholder={maxSupply !== undefined ? String(maxSupply) : "0"}
              busy={busy === "setMaxSupply"} onClick={() => run("setMaxSupply", "setMaxSupply", [BigInt(cap || "0")])} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gb-muted mb-1.5">Allowlist root <span className="text-gb-muted/60">{allowlistRoot ? `· ${(allowlistRoot as string).slice(0, 10)}…` : "· unset"}</span></p>
            <button disabled={!!busy} onClick={syncRoot} className="px-3 py-1.5 rounded-lg border border-gb-border text-gb-muted hover:text-slate-100 text-xs">
              {busy === "setAllowlistRoot" ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : "Sync root from gateway allowlist"}
            </button>
            <p className="text-[10px] text-gb-muted mt-1">Reads GENESIS_ALLOWLIST / data/genesis-allowlist.json and pins its Merkle root on-chain.</p>
          </div>

          <div className="border-t border-gb-border pt-4">
            <p className="text-[10px] uppercase tracking-wide text-gb-muted mb-1.5">
              Base Personality <span className="text-gb-muted/60 normal-case tracking-normal">· every genesis agent without its own personality falls back to this</span>
            </p>
            <textarea
              value={basePrompt}
              onChange={e => setBasePrompt(e.target.value)}
              rows={6}
              placeholder={baseLoaded ? "Base system prompt for all universal-mint agents…" : "Loading…"}
              className="w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-gb-muted outline-none font-mono leading-relaxed" />
            <div className="flex items-center justify-between gap-3 mt-1.5">
              <p className="text-[10px] text-gb-muted">Platform guardrails are <span className="text-amber-300/80">also enforced at the backend</span> on every genesis agent — they apply even if an owner sets a custom personality.</p>
              <button disabled={baseSaving || !baseLoaded} onClick={saveBasePersonality}
                className="px-3 py-1.5 rounded-lg bg-gb-accentD hover:bg-gb-accent text-white text-xs disabled:opacity-40 shrink-0 inline-flex items-center gap-1.5">
                {baseSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}Save personality
              </button>
            </div>
          </div>

          {msg && <p className="text-[11px] text-gb-faint break-all">{msg}</p>}
        </div>
      )}
    </div>
  );
}

function CollectionsTab({ token }: { token: string }) {
  const factoryDeployed = !isZero(FACTORY_ADDRESS);

  const { data: allCollections, isLoading: collectionsLoading, refetch: refetchCollections } =
    useReadContract({
      address: FACTORY_ADDRESS,
      abi: AGENT_FACTORY_ABI,
      functionName: "allCollections",
      query: { enabled: factoryDeployed },
    });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    sourceCollection: "", name: "", symbol: "",
    baseAgentURI: "", registryAdmin: "",
    mintPrice: "0", treasury: "",
    royaltyReceiver: "", royaltyBps: "0",
  });

  const [configuringRegistry, setConfiguringRegistry] = useState<Address | null>(null);

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (confirmed) { setShowForm(false); refetchCollections(); }
  }, [confirmed, refetchCollections]);

  function handleDeploy() {
    if (!form.sourceCollection || !form.name || !form.symbol) return;
    writeContract({
      address: FACTORY_ADDRESS,
      abi: AGENT_FACTORY_ABI,
      functionName: "deployRegistry",
      args: [
        form.sourceCollection as Address,
        {
          name: form.name,
          symbol: form.symbol,
          baseAgentURI: form.baseAgentURI,
          registryAdmin: (form.registryAdmin || "0x0000000000000000000000000000000000000000") as Address,
          mintPrice: BigInt(0),
          treasury: "0x0000000000000000000000000000000000000000" as Address,
          royaltyReceiver: "0x0000000000000000000000000000000000000000" as Address,
          royaltyBps: BigInt(0),
        },
      ],
    });
  }

  return (
    <div className="space-y-4">
      {!factoryDeployed && <FactoryPendingBanner />}

      {/* Genesis Agents — universal self-sourced mint (independent of the factory) */}
      <GenesisCollectionCard token={token} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gb-faint">
          {collectionsLoading ? "Loading…"
            : !allCollections ? "—"
            : `${allCollections.length} collection${allCollections.length !== 1 ? "s" : ""} onboarded`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => refetchCollections()}
            disabled={collectionsLoading || !factoryDeployed}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gb-muted hover:text-slate-100 border border-gb-border hover:border-gb-muted transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${collectionsLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            disabled={!factoryDeployed}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-gb-accentD hover:bg-gb-accent text-white transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            Onboard Collection
          </button>
        </div>
      </div>

      {/* Onboard form */}
      {showForm && (
        <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold">Onboard New Collection</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ["Source Collection Address", "sourceCollection", "0x…", false],
              ["Registry Name", "name", "Pixel Goblins Agents", false],
              ["Symbol", "symbol", "PGA", false],
              ["Base Agent URI", "baseAgentURI", `${getGatewayUrl()}/agent/<registry>/{agentId}`, false],
              ["Registry Admin (blank = factory owner)", "registryAdmin", "0x… or leave blank", false],
            ] as [string, keyof typeof form, string, boolean][]).map(([label, key, placeholder]) => (
              <div key={key} className={key === "baseAgentURI" || key === "sourceCollection" ? "sm:col-span-2" : ""}>
                <label className="block text-xs text-gb-muted mb-1">{label}</label>
                <input
                  type="text"
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-gb-muted outline-none transition-colors"
                />
              </div>
            ))}
          </div>

          <p className="text-[10px] text-gb-muted uppercase tracking-wide">
            Mint price, treasury, and royalties default to free / zero. Update via{" "}
            <code className="font-mono">setMintPrice</code> /{" "}
            <code className="font-mono">setRoyalty</code> on the registry after deployment.
          </p>

          {writeError && (
            <p className="text-red-400 text-xs">{writeError.message}</p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-gb-border text-sm text-gb-faint hover:text-slate-100 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleDeploy}
              disabled={!form.sourceCollection || !form.name || !form.symbol || isPending || confirming}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gb-accentD hover:bg-gb-accent text-white text-sm disabled:opacity-40 transition-colors"
            >
              {(isPending || confirming) && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? "Confirm in wallet…" : confirming ? "Confirming…" : "Deploy Registry"}
            </button>
          </div>
        </div>
      )}

      {/* Collections table */}
      <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
        {collectionsLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gb-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading collections&hellip;
          </div>
        ) : !allCollections || allCollections.length === 0 ? (
          <div className="text-center py-12 text-[#444] text-sm">
            {factoryDeployed ? "No collections onboarded yet." : "Deploy the factory to get started."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gb-border text-gb-muted text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Collection</th>
                <th className="px-4 py-3 text-left">Registry</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gb-border">
              {allCollections.map(addr => (
                <CollectionRow
                  key={addr}
                  address={addr as Address}
                  onRefresh={refetchCollections}
                  onConfigure={setConfiguringRegistry}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {configuringRegistry && (
        <ConfigurePanel
          registry={configuringRegistry}
          token={token}
          onClose={() => setConfiguringRegistry(null)}
        />
      )}
    </div>
  );
}

function CollectionRow({
  address, onRefresh, onConfigure,
}: {
  address: Address;
  onRefresh: () => void;
  onConfigure: (registry: Address) => void;
}) {
  const { data: lookup } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: AGENT_FACTORY_ABI,
    functionName: "lookup",
    args: [address],
    query: { enabled: !isZero(FACTORY_ADDRESS) },
  });

  const registry = lookup?.[0] as Address | undefined;
  const isDelisted = lookup?.[1] ?? false;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash });
  useEffect(() => { if (confirmed) onRefresh(); }, [confirmed, onRefresh]);

  function toggleDelist() {
    writeContract({
      address: FACTORY_ADDRESS,
      abi: AGENT_FACTORY_ABI,
      functionName: isDelisted ? "relist" : "delist",
      args: [address],
    });
  }

  return (
    <tr className="hover:bg-gb-input/50 transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-gb-faint">
        {shortAddr(address)}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gb-faint">
        {registry ? shortAddr(registry) : <span className="text-[#444]">—</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full ${isDelisted
          ? "bg-red-950/40 text-red-400 border border-red-500/20"
          : "bg-green-950/40 text-green-400 border border-green-500/20"}`}>
          {isDelisted ? "Delisted" : "Active"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={toggleDelist}
            disabled={isPending || !registry}
            className="flex items-center gap-1.5 text-xs text-gb-muted hover:text-slate-100 transition-colors disabled:opacity-30"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            {isDelisted ? "Relist" : "Delist"}
          </button>
          <button
            onClick={() => { if (registry) onConfigure(registry); }}
            disabled={!registry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gb-accent/40 text-xs text-gb-accent hover:bg-gb-accent/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={registry ? "Configure personalities & endpoints" : "Loading registry…"}
          >
            <Settings className="w-3.5 h-3.5" />
            Configure
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Step 1 binding cell — recomputable live-ownership verdict + admin block toggle ──
type BindingVerdict = {
  status: "valid" | "invalid" | "unverifiable";
  matchedCase?: string; sourceOwner?: string; reason?: string; blocked?: boolean;
};
function BindingCell({ registry, agentId }: { registry: string; agentId: string }) {
  const { token } = useAuth();
  const [v, setV] = useState<BindingVerdict | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    fetch(`${getGatewayUrl()}/agent/${registry}/${agentId}/binding`)
      .then(r => r.json()).then(setV).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [registry, agentId]);

  if (!v) return <span className="text-[#444] text-xs">…</span>;
  const color =
    v.status === "valid"   ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    v.status === "invalid" ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
                             "text-gb-muted bg-white/5 border-gb-border";
  const label = v.status === "valid" ? `live · ${v.matchedCase}` : v.status === "invalid" ? "not live" : "unverif.";

  const toggle = async (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (!token) return;
    setBusy(true);
    try {
      await fetch(`${getGatewayUrl()}/admin/agents/${registry}/${agentId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ blocked: !v.blocked }),
      });
      await load();
    } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
      <span
        title={v.status === "invalid" ? `${v.reason ?? ""}\nsource owner: ${v.sourceOwner ?? "?"}` : `source owner: ${v.sourceOwner ?? "?"}`}
        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border cursor-default ${color}`}>
        {v.blocked ? "blocked" : label}
      </span>
      <button onClick={toggle} disabled={busy}
        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors disabled:opacity-40 ${
          v.blocked ? "text-red-300 border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
                    : "text-gb-muted border-gb-border hover:text-slate-200"}`}>
        {v.blocked ? "Unblock" : "Block"}
      </button>
    </div>
  );
}

// ── Agents tab ────────────────────────────────────────────────────────────────

function AgentsTab() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<AgentEntry | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(false);
    const data = await getAgents(token);
    if (data === null) setError(true);
    else setAgents(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gb-faint">
          {loading ? "Loading…" : error ? "Gateway unreachable" : `${agents.length} agent${agents.length !== 1 ? "s" : ""} registered`}
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 border border-gb-border hover:border-gb-muted px-3 py-2 rounded-lg text-sm text-gb-muted hover:text-slate-100 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
          Gateway unreachable — check that the gateway is running and the environment switcher points to the correct URL.
        </div>
      )}

      <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gb-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading agents&hellip;
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gb-border text-gb-muted text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-left">Source NFT</th>
                <th className="px-4 py-3 text-left">Binding</th>
                <th className="px-4 py-3 text-left">Owner</th>
                <th className="px-4 py-3 text-left">Services</th>
                <th className="px-4 py-3 text-left">Registered</th>
                <th className="px-4 py-3 text-left">JSON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gb-border">
              {agents.map(a => (
                <tr key={`${a.registry}-${a.agent_id}`}
                  className="hover:bg-gb-input/50 transition-colors cursor-pointer"
                  onClick={() => setSelected(a)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {a.image ? (
                        <img src={a.image} alt={a.name} className="w-9 h-9 rounded-lg object-cover bg-white/5" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-white/20" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-100">{a.name}</p>
                        <p className="text-xs text-gb-muted font-mono">#{a.agent_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gb-faint">
                    {shortAddr(a.source_contract)} #{a.source_token_id}
                  </td>
                  <td className="px-4 py-3">
                    <BindingCell registry={a.registry} agentId={a.agent_id} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gb-faint">{shortAddr(a.owner_address)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {a.services.map(s => <ServiceBadge key={s.name} name={s.name} />)}
                      {a.services.length === 0 && <span className="text-[#444]">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gb-muted text-xs">{timeAgo(a.created_at)}</td>
                  <td className="px-4 py-3">
                    <a href={`${getGatewayUrl()}/agent/${a.registry}/${a.agent_id}`}
                      target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-gb-faint hover:text-gb-accent transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && !loading && !error && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#444] text-sm">
                    No agents registered yet.{" "}
                    <a href="https://agent.dinamic.eth.limo" target="_blank" rel="noopener noreferrer"
                      className="text-gb-accent hover:underline">
                      Bridge an NFT →
                    </a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-40 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md bg-gb-surface border-l border-gb-border h-full overflow-y-auto p-6 space-y-5"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="text-gb-muted hover:text-slate-100">&times;</button>
            </div>
            {selected.image && <img src={selected.image} alt={selected.name} className="w-full rounded-xl object-cover max-h-48" />}
            {selected.description && <p className="text-sm text-gb-faint">{selected.description}</p>}
            <div className="space-y-2 text-xs font-mono">
              <Row label="Agent ID" value={`#${selected.agent_id}`} />
              <Row label="Registry" value={shortAddr(selected.registry)} />
              <Row label="Chain" value={`eip155:${selected.chain_id}`} />
              <Row label="Owner" value={shortAddr(selected.owner_address)} />
              <Row label="Source" value={`${shortAddr(selected.source_contract)} #${selected.source_token_id}`} />
            </div>
            {selected.services.length > 0 && (
              <div>
                <p className="text-xs text-gb-muted uppercase tracking-wide mb-2">Services</p>
                <div className="space-y-2">
                  {selected.services.map(s => (
                    <div key={s.name} className="flex items-center justify-between bg-gb-input rounded-lg px-3 py-2 text-sm">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-gb-faint text-xs font-mono truncate max-w-[200px]">{s.endpoint}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <a href={`${getGatewayUrl()}/agent/${selected.registry}/${selected.agent_id}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 justify-center w-full px-4 py-2.5 rounded-lg border border-gb-border hover:border-gb-accent text-sm transition-colors">
              <ExternalLink className="w-4 h-4" /> View Registration JSON
            </a>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "agents" | "collections";

export default function AgentsPage() {
  const [tab, setTab] = useState<Tab>("agents");
  const { token } = useAuth();

  return (
    <div className="space-y-6 text-slate-100 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6 text-gb-accent" />
          ERC-8004 Agents
        </h1>
        <p className="text-gb-faint text-sm mt-1">
          On-chain agent identities bridged via{" "}
          <a href="https://agent.dinamic.eth.limo" target="_blank" rel="noopener noreferrer"
            className="text-gb-accent hover:underline">agent.dinamic.eth</a>
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gb-input rounded-xl p-1 w-fit">
        {(["agents", "collections"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t ? "bg-gb-surface text-slate-100 shadow-sm" : "text-gb-muted hover:text-slate-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "agents"      && <AgentsTab />}
      {tab === "collections" && <CollectionsTab token={token ?? ""} />}
    </div>
  );
}
