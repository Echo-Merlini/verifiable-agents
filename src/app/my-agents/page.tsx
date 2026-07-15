"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useDisconnect, useSignMessage, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSendTransaction, usePublicClient } from "wagmi";
import { useWalletModal } from "@/hooks/useWalletModal";
import { createSiweMessage } from "viem/siwe";
import { namehash, parseEther, formatEther } from "viem";
import { Bot, Check, ChevronDown, ChevronUp, Globe, Link2, Loader2, LogOut, Pencil, Save, Wallet, Coins } from "lucide-react";
import { getAgentAuthNonce, verifyAgentOwner, getMyAgents, updateMyAgent, getRegistryPersonalities, setEnsip25TextRecord } from "@/lib/api";
import { getGatewayUrl } from "@/hooks/useGatewayEnv";
import { ENS_RESOLVER_ABI, REGISTRY_CHAIN_ID, buildEnsip25TextKey } from "@/lib/erc8004";
import { useOwnedEnsNames } from "@/hooks/useOwnedEnsNames";
import type { Address } from "viem";
import { usePageRecords } from "@/hooks/usePageRecords";
import { NavMenu } from "@/components/NavMenu";

const ENS_PUBLIC_RESOLVER  = "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63" as const;
const OFFCHAIN_PARENT      = process.env.NEXT_PUBLIC_ENS_NAME || "dinamic.eth";

type Service = { name: string; endpoint: string; version?: string };
type AgentRecord = {
  registry: string;
  agent_id: string;
  owner_address: string;
  name: string;
  description: string;
  image: string;
  source_contract: string;
  source_token_id: string;
  services: Service[];
  chain_id: number;
  active: number;
  created_at: number;
};
type EditState = { name: string; description: string; mcpEndpoint: string; a2aEndpoint: string; personalityId: string; customPrompt: string; consultPrice: string; completionHours: string };

// consult_price is stored in wei; the form works in ETH. window is stored in seconds; the form in hours.
const weiToEth   = (w: unknown) => { try { return formatEther(BigInt((w as string) ?? "0")); } catch { return "0"; } };
const ethToWei   = (e: string)  => { try { return (e.trim() ? parseEther(e.trim() as `${number}`) : 0n).toString(); } catch { return "0"; } };
const secToHours = (s: unknown) => String(((Number(s) || 0) / 3600) || "");
const hoursToSec = (h: string)  => Math.round((Number(h) || 0) * 3600);

type PersonalityOption = { id: string; name: string; description: string; provider: string; model: string };

const OWNER_TOKEN_KEY = "ens-kit-owner-token";
const OWNER_ADDR_KEY  = "ens-kit-owner-address";

function shortAddr(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }
function getMcp(s: Service[]) { return s.find(x => x.name === "MCP")?.endpoint ?? ""; }
function getA2a(s: Service[]) { return s.find(x => x.name === "A2A")?.endpoint ?? ""; }
function buildServices(existing: Service[], mcp: string, a2a: string): Service[] {
  const out: Service[] = [];
  if (mcp) out.push({ name: "MCP", endpoint: mcp, version: "2025-06-18" });
  if (a2a) out.push({ name: "A2A", endpoint: a2a, version: "0.3.0" });
  existing.filter(s => s.name !== "MCP" && s.name !== "A2A").forEach(s => out.push(s));
  return out;
}

// ── Background ────────────────────────────────────────────────────────────────
function GradientBg() {
  return (
    <div className="fixed inset-0 z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(99,102,241,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(129,140,248,0.1),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_80%,rgba(79,70,229,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
    </span>
  );
}

function Field({ label, value, onChange, placeholder, textarea = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; textarea?: boolean;
}) {
  const cls = "w-full bg-black/40 border border-white/10 focus:border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors";
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-widest text-white/40">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
          className={`${cls} resize-none`} placeholder={placeholder} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className={cls} placeholder={placeholder} />
      )}
    </div>
  );
}

// ── ENS name selector (auto-detects primary + dinamic.eth subdomain) ──────────
function EnsNameSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { address } = useAccount();
  const { names, loading, parentName } = useOwnedEnsNames(address as Address | undefined);

  if (loading) {
    return (
      <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5">
        <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />
        <span className="text-sm text-white/30">Detecting ENS names…</span>
      </div>
    );
  }

  if (names.length === 0) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="yourname.eth"
        className="w-full bg-black/40 border border-white/10 focus:border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors"
      />
    );
  }

  return (
    <div className="relative">
      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-black/40 border border-white/10 focus:border-white/30 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white outline-none transition-colors appearance-none cursor-pointer"
      >
        <option value="">— Select ENS name —</option>
        {names.map(n => (
          <option key={n} value={n}>
            {n}{n.endsWith(`.${parentName}`) ? " ✦" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Credit source selector (Community pool ⇄ My wallet) ───────────────────────
const OWNER_ABI = [{ type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }] as const;

function CreditSourceCards({ registry }: { registry: string }) {
  const { address: userAddress } = useAccount();
  const regLc = registry.toLowerCase();
  const [mode, setMode]       = useState<"community" | "wallet" | null>(null);
  const [pool, setPool]       = useState<number | null>(null);
  const [wallet, setWallet]   = useState<number | null>(null);
  const [source, setSource]   = useState<"pool" | "wallet">("pool");
  const [treasury, setTreasury] = useState<string>("");
  const [topupEth, setTopupEth] = useState("0.01");
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupMsg, setTopupMsg]   = useState<string | null>(null);
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const { data: ownerAddr } = useReadContract({
    address: registry as Address, abi: OWNER_ABI, functionName: "owner", chainId: REGISTRY_CHAIN_ID,
  });
  const isOwner = !!userAddress && !!ownerAddr && (ownerAddr as string).toLowerCase() === userAddress.toLowerCase();

  const loadBalances = useCallback(async () => {
    try {
      const cr = await fetch(`${getGatewayUrl()}/api/registry/${regLc}/credits`).then(r => r.json());
      setMode(cr.meteringMode === "wallet" ? "wallet" : "community");
      setPool(typeof cr.credits === "number" ? cr.credits : 0);
    } catch { setMode("community"); }
    if (userAddress) {
      try {
        const wr = await fetch(`${getGatewayUrl()}/api/registry/wallet/${userAddress.toLowerCase()}/credits`).then(r => r.json());
        setWallet(typeof wr.credits === "number" ? wr.credits : 0);
      } catch { /* ignore */ }
    }
  }, [regLc, userAddress]);

  useEffect(() => { loadBalances(); }, [loadBalances]);
  useEffect(() => {
    fetch(`${getGatewayUrl()}/api/registry/price`).then(r => r.json())
      .then(d => { if (d.treasury) setTreasury(d.treasury); }).catch(() => {});
    const stored = typeof window !== "undefined" ? localStorage.getItem(`creditSource:${regLc}`) : null;
    if (stored === "wallet" || stored === "pool") setSource(stored);
  }, [regLc]);

  function pick(s: "pool" | "wallet") {
    setSource(s);
    if (typeof window !== "undefined") localStorage.setItem(`creditSource:${regLc}`, s);
  }

  async function topUpPool() {
    if (!treasury || topupBusy) return;
    setTopupBusy(true); setTopupMsg(null);
    try {
      const value = parseEther((topupEth || "0") as `${number}`);
      if (value <= 0n) throw new Error("Enter an amount");
      const hash = await sendTransactionAsync({ to: treasury as Address, value });
      await publicClient?.waitForTransactionReceipt({ hash });
      const res = await fetch(`${getGatewayUrl()}/api/registry/topup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: hash, registryAddress: regLc }),
      }).then(r => r.json());
      if (res.ok || res.creditsGranted) { setTopupMsg(`Added ${res.creditsGranted ?? ""} credits to the pool`); loadBalances(); }
      else setTopupMsg(res.error || "Top-up failed");
    } catch (e: any) { setTopupMsg(e.shortMessage || e.message); }
    finally { setTopupBusy(false); }
  }

  // Wallet-only collections don't use a community pool — no source to pick.
  if (mode === "wallet") return null;

  const card = (active: boolean) =>
    `text-left rounded-xl border px-3 py-2.5 transition-colors ${
      active ? "border-emerald-400/60 bg-emerald-400/10" : "border-white/10 hover:border-white/25"}`;

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-white/30">Credit source for chat</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => pick("pool")} className={card(source === "pool")}>
          <div className="flex items-center gap-1.5 text-white/80"><Coins className="w-3.5 h-3.5" /><span className="text-xs font-medium">Community pool</span></div>
          <p className="text-lg font-bold font-mono text-white mt-0.5">{pool?.toLocaleString() ?? "…"}</p>
          <p className="text-[10px] text-white/40">shared / subsidized</p>
        </button>
        <button onClick={() => pick("wallet")} className={card(source === "wallet")}>
          <div className="flex items-center gap-1.5 text-white/80"><Wallet className="w-3.5 h-3.5" /><span className="text-xs font-medium">My wallet</span></div>
          <p className="text-lg font-bold font-mono text-white mt-0.5">{userAddress ? (wallet?.toLocaleString() ?? "…") : "—"}</p>
          <a href={userAddress ? `/top-up/?address=${userAddress}` : "/top-up/"} onClick={e => e.stopPropagation()}
            className="text-[10px] text-emerald-300 hover:text-emerald-200 underline">Top up wallet</a>
        </button>
      </div>
      <p className="text-[10px] text-white/40">
        {source === "pool"
          ? "Chats spend the community pool first. When it's empty you'll switch to your own credits."
          : "Chats spend your own wallet credits."}
      </p>
      {isOwner && (
        <div className="mt-1 rounded-xl border border-white/10 p-2.5 space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-white/30">Owner · top up community pool</p>
          <div className="flex items-center gap-2">
            <input value={topupEth} onChange={e => setTopupEth(e.target.value)} placeholder="0.01"
              className="w-24 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-white outline-none focus:border-white/30" />
            <span className="text-[10px] text-white/40">ETH</span>
            <button onClick={topUpPool} disabled={topupBusy || !treasury}
              className="ml-auto text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-40 rounded-lg px-3 py-1 transition-colors">
              {topupBusy ? "Paying…" : "Fund pool"}
            </button>
          </div>
          {topupMsg && <p className="text-[10px] text-white/50">{topupMsg}</p>}
        </div>
      )}
    </div>
  );
}

// ── Agent card ────────────────────────────────────────────────────────────────
function AgentCard({ agent, ownerToken, onSaved, onSessionExpired, availableMcps }: {
  agent: AgentRecord; ownerToken: string; onSaved: () => void;
  onSessionExpired: () => void;
  availableMcps: { id: string; name: string; description: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<EditState>({
    name:          agent.name,
    description:   agent.description,
    mcpEndpoint:   getMcp(agent.services),
    a2aEndpoint:   getA2a(agent.services),
    personalityId: (agent as any).personality_id ?? "",
    customPrompt:  (agent as any).custom_prompt ?? "",
    consultPrice:  weiToEth((agent as any).consult_price),
    completionHours: secToHours((agent as any).completion_window),
  });
  const [personalities, setPersonalities] = useState<PersonalityOption[]>([]);
  const [agentMcpIds,   setAgentMcpIds]   = useState<string[]>([]);
  const savedMcpIdsRef = useRef<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");
  const [ensName,   setEnsName]   = useState("");
  const [ensLinked, setEnsLinked] = useState(false);

  const { writeContract: setEnsRecord, data: ensHash, isPending: ensPending, error: ensWriteError } = useWriteContract();
  const { isSuccess: ensConfirmed } = useWaitForTransactionReceipt({ hash: ensHash });
  const [ensApiPending, setEnsApiPending] = useState(false);
  const [ensApiError,   setEnsApiError]   = useState("");

  useEffect(() => {
    if (!ensConfirmed) return;
    setEnsLinked(true);
    // Save linked ENS name in gateway DB so the agent card shows the GNS/ENS badge
    if (ensName.trim() && ownerToken) {
      updateMyAgent(ownerToken, agent.registry, agent.agent_id, { linked_ens_name: ensName.trim() })
        .catch(() => {});
    }
  }, [ensConfirmed]);

  useEffect(() => {
    if (open && personalities.length === 0) {
      getRegistryPersonalities(agent.registry).then(data => {
        if (Array.isArray(data)) setPersonalities(data);
      });
    }
    if (open) {
      fetch(`${getGatewayUrl()}/agent/${agent.registry}/${agent.agent_id}/mcp-assignments`)
        .then(r => r.json()).then(d => { const ids = d.mcp_server_ids ?? []; savedMcpIdsRef.current = ids; setAgentMcpIds(ids); }).catch(() => {});
    }
  }, [open, agent.registry, agent.agent_id]);

  function handleEnsLink() {
    if (!ensName.trim()) return;
    const key = buildEnsip25TextKey(REGISTRY_CHAIN_ID, agent.registry as `0x${string}`, BigInt(agent.agent_id));
    if (ensName.endsWith(`.${OFFCHAIN_PARENT}`)) {
      // dinamic.eth subdomain — set via gateway API, no tx needed
      if (!ownerToken) return;
      setEnsApiPending(true);
      setEnsApiError("");
      setEnsip25TextRecord(ownerToken, key, "1", agent.registry, agent.agent_id)
        .then(d => {
          if (d.ok) setEnsLinked(true);
          else if (d.error === "Unauthorized") onSessionExpired();
          else setEnsApiError(d.error || "Failed");
        })
        .catch(() => setEnsApiError("Request failed"))
        .finally(() => setEnsApiPending(false));
    } else {
      // Native .eth name — on-chain setText on ENS Public Resolver
      setEnsRecord({
        address: ENS_PUBLIC_RESOLVER,
        abi: ENS_RESOLVER_ABI,
        functionName: "setText",
        args: [namehash(ensName.trim()), key, "1"],
      });
    }
  }

  const dirty =
    edit.name          !== agent.name ||
    edit.description   !== agent.description ||
    edit.mcpEndpoint   !== getMcp(agent.services) ||
    edit.a2aEndpoint   !== getA2a(agent.services) ||
    edit.personalityId !== ((agent as any).personality_id ?? "") ||
    edit.customPrompt  !== ((agent as any).custom_prompt ?? "") ||
    edit.consultPrice  !== weiToEth((agent as any).consult_price) ||
    edit.completionHours !== secToHours((agent as any).completion_window) ||
    JSON.stringify([...agentMcpIds].sort()) !== JSON.stringify([...savedMcpIdsRef.current].sort());

  async function handleSave() {
    setSaving(true); setError("");
    const services = buildServices(agent.services, edit.mcpEndpoint, edit.a2aEndpoint);
    const res = await updateMyAgent(ownerToken, agent.registry, agent.agent_id, {
      name: edit.name, description: edit.description, services,
      personality_id: edit.personalityId,
      custom_prompt:  edit.customPrompt,
      consult_price:     ethToWei(edit.consultPrice),
      completion_window: hoursToSec(edit.completionHours),
      mcp_server_ids: agentMcpIds,
    });
    setSaving(false);
    if (res?.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } else if (res?.error === "Unauthorized") {
      onSessionExpired();
    } else {
      setError("Save failed — try signing out and back in.");
    }
  }

  function handleCancel() {
    setEdit({ name: agent.name, description: agent.description,
      mcpEndpoint: getMcp(agent.services), a2aEndpoint: getA2a(agent.services),
      personalityId: (agent as any).personality_id ?? "",
      customPrompt: (agent as any).custom_prompt ?? "",
      consultPrice: weiToEth((agent as any).consult_price),
      completionHours: secToHours((agent as any).completion_window),
    });
    setOpen(false); setError("");
  }

  return (
    <div className="liquid-glass rounded-3xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-4 p-4">
        {agent.image ? (
          <img src={agent.image} alt={agent.name} className="w-14 h-14 rounded-2xl object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6 text-white/30" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{agent.name}</p>
          <p className="text-xs text-white/40 font-mono">#{agent.agent_id} · {shortAddr(agent.source_contract)}</p>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {getMcp(agent.services) && (
              <span className="rounded-full px-2 py-0.5 text-[10px] bg-amber-500/15 border border-amber-500/20 text-amber-300">MCP</span>
            )}
            {getA2a(agent.services) && (
              <span className="rounded-full px-2 py-0.5 text-[10px] bg-amber-500/15 border border-amber-500/20 text-amber-300">A2A</span>
            )}
            {!getMcp(agent.services) && !getA2a(agent.services) && (
              <span className="rounded-full px-2 py-0.5 text-[10px] bg-white/5 border border-white/8 text-white/30">No endpoints</span>
            )}
          </div>
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="shrink-0 liquid-glass rounded-full p-2.5 text-white/40 hover:text-white transition-colors">
          {open ? <ChevronUp className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
        </button>
      </div>

      {/* Collapsed info strip */}
      {!open && (getMcp(agent.services) || getA2a(agent.services)) && (
        <div className="border-t border-white/6 px-4 py-3 space-y-1.5">
          {getMcp(agent.services) && (
            <div className="flex items-center gap-2">
              <Globe className="w-3 h-3 text-white/20 shrink-0" />
              <span className="font-mono text-[10px] text-white/30 truncate">{getMcp(agent.services)}</span>
            </div>
          )}
          {getA2a(agent.services) && (
            <div className="flex items-center gap-2">
              <Link2 className="w-3 h-3 text-white/20 shrink-0" />
              <span className="font-mono text-[10px] text-white/30 truncate">{getA2a(agent.services)}</span>
            </div>
          )}
        </div>
      )}

      {/* Edit panel */}
      {open && (
        <div className="border-t border-white/8 p-5 space-y-4">
          <Field label="Name" value={edit.name} onChange={v => setEdit(e => ({ ...e, name: v }))} />
          <Field label="Description" value={edit.description}
            onChange={v => setEdit(e => ({ ...e, description: v }))} textarea placeholder="What does this agent do?" />

          <div className="h-px bg-white/6" />
          <p className="text-[10px] uppercase tracking-widest text-white/30">Consult Pricing</p>
          <p className="text-[11px] text-white/35 -mt-1">Set a price to make this agent hireable. Callers pay into escrow; you (the agent wallet) are paid on delivery, or they refund after the window. Leave 0 = free / not for hire.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Consult price (ETH)" value={edit.consultPrice}
              onChange={v => setEdit(e => ({ ...e, consultPrice: v }))} placeholder="0.00" />
            <Field label="Completion window (hours)" value={edit.completionHours}
              onChange={v => setEdit(e => ({ ...e, completionHours: v }))} placeholder="24" />
          </div>
          <a
            href={`/consult/?registry=${agent.registry}&agentId=${agent.agent_id}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-amber-300 hover:text-amber-200 transition-colors"
          >
            <Coins className="w-3 h-3" /> Open consult page — preview &amp; share the hireable link ↗
          </a>

          <div className="h-px bg-white/6" />
          <p className="text-[10px] uppercase tracking-widest text-white/30">Service Endpoints</p>

          <Field label="MCP Endpoint" value={edit.mcpEndpoint}
            onChange={v => setEdit(e => ({ ...e, mcpEndpoint: v }))}
            placeholder="https://mcp.myagent.com/" />
          <Field label="A2A Endpoint" value={edit.a2aEndpoint}
            onChange={v => setEdit(e => ({ ...e, a2aEndpoint: v }))}
            placeholder="https://agent.example/.well-known/agent-card.json" />

          <div className="h-px bg-white/6" />
          <p className="text-[10px] uppercase tracking-widest text-white/30">AI Personality</p>

          {personalities.length > 0 ? (
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-white/40">Personality</label>
                <div className="relative">
                  <select
                    value={edit.personalityId}
                    onChange={e => setEdit(prev => ({ ...prev, personalityId: e.target.value }))}
                    className="w-full bg-black/40 border border-white/10 focus:border-white/30 rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">— No personality —</option>
                    {personalities.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.provider})</option>
                    ))}
                  </select>
                </div>
              </div>
              {edit.personalityId && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-white/40">Custom Prompt Override</label>
                  <textarea
                    value={edit.customPrompt}
                    onChange={e => setEdit(prev => ({ ...prev, customPrompt: e.target.value }))}
                    rows={3}
                    placeholder="Leave blank to use the personality's default system prompt"
                    className="w-full bg-black/40 border border-white/10 focus:border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors resize-none font-mono"
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-white/30 leading-relaxed">
              No personalities configured for this collection yet. An admin can add them in the <strong className="text-white/50">Admin → Collections → Configure</strong> panel.
            </p>
          )}

          {availableMcps.length > 0 && (
            <>
              <div className="h-px bg-white/6" />
              <p className="text-[10px] uppercase tracking-widest text-white/30">MCP Tool Servers</p>
              <div className="grid grid-cols-1 gap-2">
                {availableMcps.map(m => {
                  const on = agentMcpIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAgentMcpIds(prev => on ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                      className={`text-left w-full rounded-xl border px-3.5 py-2.5 transition-colors ${
                        on
                          ? "bg-amber-500/10 border-amber-500/30"
                          : "bg-white/[0.03] border-white/8 hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${on ? "bg-amber-400" : "bg-white/20"}`} />
                        <span className={`text-xs font-medium ${on ? "text-amber-300" : "text-white/50"}`}>{m.name}</span>
                      </div>
                      {m.description && (
                        <p className={`text-[11px] leading-relaxed mt-1 ml-3.5 ${on ? "text-amber-200/50" : "text-white/25"}`}>
                          {m.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="h-px bg-white/6" />
          <CreditSourceCards registry={agent.registry} />

          <div className="h-px bg-white/6" />
          <p className="text-[10px] uppercase tracking-widest text-white/30">ENSIP-25 Link</p>
          <p className="text-[11px] text-white/30 leading-relaxed -mt-2">
            Link this agent to a <strong className="text-white/50">.eth name you own</strong>.{" "}
            Native <span className="font-mono">.eth</span> names set an on-chain text record;{" "}
            <span className="font-mono">*.{OFFCHAIN_PARENT}</span> subdomains update the gateway instantly — no transaction needed.
          </p>
          {ensLinked ? (
            <div className="flex items-center gap-2 text-green-400 text-xs">
              <Check className="w-3.5 h-3.5" />
              ENSIP-25 record set on {ensName}
            </div>
          ) : (
            <EnsNameSelect value={ensName} onChange={setEnsName} />
          )}
          {!ensLinked && (
            <>
              <button
                onClick={handleEnsLink}
                disabled={ensPending || ensApiPending || !ensName.trim()}
                className="w-full liquid-glass-strong rounded-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.01] transition-transform"
              >
                {(ensPending || ensApiPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                {ensApiPending ? "Saving…" : ensPending ? "Confirm in wallet…" : "Set ENSIP-25 Text Record"}
              </button>
              {ensWriteError && (
                <p className="text-xs text-red-400">
                  {(ensWriteError.message.includes("denied") || ensWriteError.message.includes("rejected"))
                    ? "Rejected — press the button again to retry."
                    : ensWriteError.message.slice(0, 120)}
                </p>
              )}
              {ensApiError && (
                <p className="text-xs text-red-400">{ensApiError}</p>
              )}
            </>
          )}

          {error && (
            <p className="text-xs text-red-400 border border-red-500/20 bg-red-500/5 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={handleCancel}
              className="liquid-glass rounded-full px-5 py-2.5 text-sm text-white/60 hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={handleSave}
              disabled={saving || !dirty || !edit.name}
              className="flex-1 liquid-glass-strong rounded-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] transition-transform">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" />
               : saved ? <Check className="w-4 h-4 text-green-400" />
               : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MyAgentsPage() {
  const { address, isConnected } = useAccount();
  const { open }                 = useWalletModal();
  const { disconnect }           = useDisconnect();
  const { signMessageAsync }     = useSignMessage();

  const tr       = usePageRecords("my-agents.dinamic.eth");
  const icon     = tr.icon;
  const avatar   = tr.avatar;
  const cardBg   = tr.card_bg;
  const videoUrl = tr.video;

  const [mounted,      setMounted]      = useState(false);
  const [ownerToken,   setOwnerToken]   = useState<string | null>(null);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  const [agents,       setAgents]       = useState<AgentRecord[]>([]);
  const [availableMcps, setAvailableMcps] = useState<{ id: string; name: string; description: string }[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [signingIn,    setSigningIn]    = useState(false);
  const [signError,    setSignError]    = useState("");

  useEffect(() => {
    setMounted(true);
    const token = sessionStorage.getItem(OWNER_TOKEN_KEY);
    const addr  = sessionStorage.getItem(OWNER_ADDR_KEY);
    if (token && addr) { setOwnerToken(token); setOwnerAddress(addr); }
  }, []);

  const fetchAgents = useCallback(async (addr: string) => {
    setLoading(true);
    const [data, mcpData] = await Promise.all([
      getMyAgents(addr),
      fetch(`${getGatewayUrl()}\/agent\/public-mcps`).then(r => r.json()).catch(() => []),
    ]);
    setAgents(Array.isArray(data) ? data : []);
    if (Array.isArray(mcpData)) setAvailableMcps(mcpData);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (ownerToken && ownerAddress) fetchAgents(ownerAddress);
  }, [ownerToken, ownerAddress, fetchAgents]);

  // Clear session when wallet disconnects or switches address
  useEffect(() => {
    if (!mounted) return;
    if (!isConnected || (ownerAddress && address?.toLowerCase() !== ownerAddress)) {
      sessionStorage.removeItem(OWNER_TOKEN_KEY);
      sessionStorage.removeItem(OWNER_ADDR_KEY);
      setOwnerToken(null); setOwnerAddress(null); setAgents([]);
    }
  }, [isConnected, address, mounted, ownerAddress]);

  async function handleSignIn() {
    if (!address) return;
    setSigningIn(true); setSignError("");
    try {
      const nonce = await getAgentAuthNonce();
      const message = createSiweMessage({
        domain:    window.location.host,
        address:   address as Address,
        statement: "Sign in to manage your ERC-8004 agents",
        uri:       window.location.origin,
        version:   "1",
        chainId:   1,
        nonce,
      });
      const signature = await signMessageAsync({ message });
      const result = await verifyAgentOwner(message, signature);
      sessionStorage.setItem(OWNER_TOKEN_KEY, result.token);
      sessionStorage.setItem(OWNER_ADDR_KEY, address.toLowerCase());
      setOwnerToken(result.token);
      setOwnerAddress(address.toLowerCase());
    } catch (e: any) {
      setSignError(e.message || "Sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }

  function handleSignOut() {
    sessionStorage.removeItem(OWNER_TOKEN_KEY);
    sessionStorage.removeItem(OWNER_ADDR_KEY);
    setOwnerToken(null); setOwnerAddress(null); setAgents([]);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col font-display">
      <NavMenu currentPath="my-agents" />

      {videoUrl ? (
        <>
          <video src={videoUrl} autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover z-0" />
          <div className="fixed inset-0 z-0 bg-black/50" />
        </>
      ) : (
        <GradientBg />
      )}

      {/* Nav */}
      <div className="relative z-10 px-5 py-4 flex items-center justify-between border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white/70" />
          </div>
          <div>
            <span className="text-sm font-semibold text-white">My Agents</span>
            <span className="ml-2 text-[10px] text-white/30 font-mono">agent.dinamic.eth</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mounted && ownerToken && (
            <button onClick={handleSignOut}
              className="liquid-glass rounded-full px-3 py-2 flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors">
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          )}
          {mounted && isConnected && address ? (
            <button onClick={() => disconnect()}
              className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
              <LiveDot />
              <span className="font-mono">{shortAddr(address)}</span>
            </button>
          ) : mounted && (
            <button onClick={() => open()}
              className="liquid-glass-strong rounded-full px-5 py-2.5 flex items-center gap-2 text-sm font-medium text-white hover:scale-105 transition-transform">
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 flex flex-col flex-1 max-w-3xl mx-auto w-full px-5 py-8">

        {/* Not connected */}
        {mounted && !isConnected && (
          <div className="flex-1 flex items-center justify-center min-h-[70vh]">
            <div className="liquid-glass-strong rounded-3xl p-10 max-w-sm w-full text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-white/8 border border-white/10 flex items-center justify-center">
                <Bot className="w-7 h-7 text-white/40" />
              </div>
              <div>
                <h1 className="text-2xl font-medium tracking-[-0.04em] text-white mb-2">Manage Your Agents</h1>
                <p className="text-sm text-white/40 leading-relaxed">
                  Connect your wallet to view and configure your ERC-8004 agent identities.
                </p>
              </div>
              <button onClick={() => open()}
                className="w-full liquid-glass-strong rounded-full py-3 flex items-center justify-center gap-3 text-sm font-medium text-white hover:scale-105 transition-transform">
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            </div>
          </div>
        )}

        {/* Connected but not signed in */}
        {mounted && isConnected && !ownerToken && (
          <div className="flex-1 flex items-center justify-center min-h-[70vh]">
            <div className="liquid-glass-strong rounded-3xl p-10 max-w-sm w-full text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Bot className="w-7 h-7 text-amber-400/70" />
              </div>
              <div>
                <h2 className="text-xl font-medium text-white mb-2">Prove Ownership</h2>
                <p className="text-sm text-white/40 leading-relaxed">
                  Sign a message with your wallet to authenticate. No gas required — this is just a signature.
                </p>
              </div>
              {signError && (
                <p className="text-xs text-red-400 border border-red-500/20 bg-red-500/5 rounded-xl px-3 py-2">{signError}</p>
              )}
              <button onClick={handleSignIn} disabled={signingIn}
                className="w-full liquid-glass-strong rounded-full py-3 flex items-center justify-center gap-3 text-sm font-medium text-white disabled:opacity-40 hover:scale-[1.02] transition-transform">
                {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                {signingIn ? "Waiting for signature…" : "Sign In with Wallet"}
              </button>
            </div>
          </div>
        )}

        {/* Signed in — agent list */}
        {mounted && isConnected && ownerToken && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-medium tracking-[-0.04em] text-white">My Agents</h1>
                <p className="text-xs text-white/30 mt-1 font-mono">{shortAddr(ownerAddress!)}</p>
              </div>
              <a href="/agent"
                className="liquid-glass rounded-full px-4 py-2 text-xs text-white/50 hover:text-white transition-colors">
                + Bridge NFT
              </a>
            </div>

            {loading && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="liquid-glass rounded-3xl p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 rounded-full bg-white/5" />
                      <div className="h-3 w-1/2 rounded-full bg-white/4" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && agents.length === 0 && (
              <div className="liquid-glass-strong rounded-3xl p-12 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white/20" />
                </div>
                <div>
                  <p className="text-white/50 font-medium">No agents yet</p>
                  <p className="text-sm text-white/30 mt-1">Bridge an NFT to register your first ERC-8004 agent identity.</p>
                </div>
                <a href="/agent"
                  className="inline-flex items-center gap-2 liquid-glass rounded-full px-5 py-2.5 text-sm text-white/60 hover:text-white transition-colors">
                  Go to Bridge →
                </a>
              </div>
            )}

            {!loading && agents.map(agent => (
              <AgentCard
                key={`${agent.registry}-${agent.agent_id}`}
                agent={agent}
                ownerToken={ownerToken!}
                onSaved={() => fetchAgents(ownerAddress!)}
                onSessionExpired={() => {
                  sessionStorage.removeItem(OWNER_TOKEN_KEY);
                  sessionStorage.removeItem(OWNER_ADDR_KEY);
                  setOwnerToken(null); setOwnerAddress(null); setAgents([]);
                }}
                availableMcps={availableMcps}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
