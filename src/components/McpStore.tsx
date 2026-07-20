"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useWriteContract, useSwitchChain, useChainId, usePublicClient } from "wagmi";
import { Sparkles, Wallet, Loader2, Check, ExternalLink, Lock, ShieldCheck } from "lucide-react";
import { useWalletModal } from "@/hooks/useWalletModal";
import { McpLogo } from "@/components/McpLogo";
import { fetchPremiumMcps, fetchEntitlement, tagPillClass, type PremiumMcp, type MarketAgent } from "@/lib/marketplace";

// MCPEntitlementRegistry.buy(address registry, uint256 tokenId, bytes32 mcpId) payable
const ENTITLEMENT_ABI = [
  {
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [
      { name: "registry", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "mcpId", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

const EXPLORER: Record<number, string> = { 1: "https://etherscan.io", 11155111: "https://sepolia.etherscan.io", 84532: "https://sepolia.basescan.org" };

function fmtPrice(wei: string) {
  try { return `${formatEther(BigInt(wei || "0"))} ETH`; } catch { return "—"; }
}

function CapabilityCard({ mcp, agents }: { mcp: PremiumMcp; agents: MarketAgent[] }) {
  const { address, isConnected } = useAccount();
  const { open: openWallet } = useWalletModal();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [equipping, setEquipping] = useState(false);
  const [agentRef, setAgentRef] = useState<string>(agents[0] ? `${agents[0].registry}:${agents[0].agentId}` : "");
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const live = Boolean(mcp.contract); // contract deployed + address configured
  const selected = useMemo(() => {
    const [reg, id] = agentRef.split(":");
    return { registry: reg, tokenId: id };
  }, [agentRef]);
  const explorer = EXPLORER[mcp.chainId] ?? EXPLORER[1];

  // Reflect current entitlement for the selected agent.
  useEffect(() => {
    if (!live || !selected.registry || !selected.tokenId) { setEntitled(null); return; }
    fetchEntitlement(selected.registry, selected.tokenId, mcp.slug).then((e) => setEntitled(e?.entitled ?? null));
  }, [live, selected.registry, selected.tokenId, mcp.slug, txHash]);

  const buy = useCallback(async () => {
    setErr(null);
    if (!isConnected || !address) { openWallet(); return; }
    if (!live || !mcp.contract) { setErr("Not live yet — launching on mainnet."); return; }
    if (!selected.registry || !selected.tokenId) { setErr("Pick an agent to equip."); return; }
    try {
      setBusy(true);
      if (chainId !== mcp.chainId) { setBusyMsg("Switching network…"); await switchChainAsync({ chainId: mcp.chainId }); }
      setBusyMsg("Confirm in wallet…");
      const hash = await writeContractAsync({
        address: mcp.contract as `0x${string}`,
        abi: ENTITLEMENT_ABI,
        functionName: "buy",
        args: [selected.registry as `0x${string}`, BigInt(selected.tokenId), mcp.mcpId as `0x${string}`],
        value: BigInt(mcp.price),
        chainId: mcp.chainId,
      });
      setBusyMsg("Attaching capability…");
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      setTxHash(hash);
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || "Purchase failed.");
    } finally {
      setBusy(false);
      setBusyMsg("");
    }
  }, [isConnected, address, live, mcp, selected, chainId, switchChainAsync, writeContractAsync, publicClient, openWallet]);

  return (
    <div className="liquid-glass flex flex-col rounded-2xl p-4 ring-1 ring-brassLight/40 shadow-[0_0_18px_-6px_rgba(224,162,76,0.35)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/30 ring-2 ring-brassLight/60">
          <McpLogo card={{ id: mcp.slug, label: mcp.label, logo: mcp.logo, icon: mcp.icon, fill: mcp.fill } as any} className="h-6 w-6" fill />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold">{mcp.label}</h3>
          <p className="text-xs text-zinc-500">{mcp.tagline}</p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-zinc-400">{mcp.description}</p>

      {mcp.tags && mcp.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {mcp.tags.map((t) => (
            <span key={t} className={tagPillClass(t)}>{t}</span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="font-mono">{fmtPrice(mcp.price)}</span>
        <span>{mcp.registered ? "registered on-chain" : live ? "not registered yet" : "launching on mainnet"}</span>
      </div>

      {/* Equip flow — pinned to the bottom so buttons align across cards */}
      <div className="mt-auto border-t border-white/[0.06] pt-3">
        {txHash ? (
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <Check className="h-4 w-4" /> Attached to agent #{selected.tokenId}
            <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-brassLight hover:underline">
              tx <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : !equipping ? (
          <button
            onClick={() => setEquipping(true)}
            disabled={!live}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brass/90 px-3 py-2 text-sm font-medium text-white transition enabled:hover:bg-brass disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-zinc-500"
          >
            {live ? <><Sparkles className="h-4 w-4" /> Equip an agent</> : <><Lock className="h-4 w-4" /> Launching on mainnet</>}
          </button>
        ) : (
          <div className="space-y-2">
            <label className="block text-[11px] uppercase tracking-wider text-zinc-500">Equip which agent</label>
            <select
              value={agentRef}
              onChange={(e) => setAgentRef(e.target.value)}
              className="w-full rounded-lg bg-black/30 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/[0.08] focus:outline-none focus:ring-brass/40"
            >
              {agents.map((a) => (
                <option key={`${a.registry}:${a.agentId}`} value={`${a.registry}:${a.agentId}`}>
                  {a.name || `Agent #${a.agentId}`} (#{a.agentId})
                </option>
              ))}
            </select>
            {entitled && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" /> This agent already holds the capability.
              </div>
            )}
            <button
              onClick={buy}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brass/90 px-3 py-2 text-sm font-medium text-white transition enabled:hover:bg-brass disabled:opacity-60"
            >
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {busyMsg || "Working…"}</>
                : !isConnected ? <><Wallet className="h-4 w-4" /> Connect &amp; buy · {fmtPrice(mcp.price)}</>
                : <><Sparkles className="h-4 w-4" /> Buy · {fmtPrice(mcp.price)}</>}
            </button>
            <p className="text-[10px] leading-relaxed text-zinc-600">
              Your own wallet signs — non-custodial. The entitlement binds to the agent NFT and is carried with the token on transfer.
            </p>
          </div>
        )}
        {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
      </div>
    </div>
  );
}

export function McpStore({ agents }: { agents: MarketAgent[] }) {
  const [mcps, setMcps] = useState<PremiumMcp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPremiumMcps().then((list) => { setMcps(list); setLoading(false); });
  }, []);

  if (loading || mcps.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="font-display text-xl font-semibold">Premium capabilities</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Specialized MCPs you buy for an agent — the entitlement is written on-chain and{" "}
        <span className="text-zinc-300">carried with the agent NFT</span>. Whoever owns the token holds the capability.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mcps.map((m) => (
          <CapabilityCard key={m.slug} mcp={m} agents={agents} />
        ))}
      </div>
    </section>
  );
}
