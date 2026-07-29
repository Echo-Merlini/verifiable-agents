"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { formatEther, type Hex } from "viem";
import { Tag, Loader2, Check, ExternalLink, AlertCircle } from "lucide-react";
import {
  AGENT_MARKET_ABI, AGENT_MARKET_ADDRESS, AGENT_MARKET_CHAIN_ID, agentMarketConfigured,
  fetchActiveListings, fetchMarketConfig, fetchMarketStats,
} from "@/lib/agentMarketEscrow";

const explorer = AGENT_MARKET_CHAIN_ID === 1 ? "https://etherscan.io" : "https://sepolia.etherscan.io";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function AgentMarketAdmin() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [cfg, setCfg] = useState<{ owner: string; treasury: string; feeBps: number } | null>(null);
  const [stats, setStats] = useState<{ sales: number; volume: bigint; fees: bigint } | null>(null);
  const [active, setActive] = useState(0);
  const [feeInput, setFeeInput] = useState("");
  const [treasInput, setTreasInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const c = await fetchMarketConfig();
    setCfg(c);
    if (c) { setFeeInput(String(c.feeBps)); setTreasInput(c.treasury); }
    setStats(await fetchMarketStats());
    setActive((await fetchActiveListings()).length);
  }, []);
  useEffect(() => { if (agentMarketConfigured) load(); }, [load]);

  if (!agentMarketConfigured) {
    return (
      <div className="liquid-glass rounded-xl p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Tag className="h-4 w-4" /> Agent market contract</h2>
        <p className="mt-1 text-xs text-amber-300">Not deployed yet — deploy <span className="font-mono">AgentMarketEscrow</span> in the Deploy tab, then set <code className="bg-gb-input px-1 rounded">NEXT_PUBLIC_AGENT_MARKET_ESCROW</code>.</p>
      </div>
    );
  }

  const isOwner = !!cfg && !!address && cfg.owner.toLowerCase() === address.toLowerCase();
  const ensureChain = async () => { if (chainId !== AGENT_MARKET_CHAIN_ID) await switchChainAsync({ chainId: AGENT_MARKET_CHAIN_ID }); };
  const run = async (key: string, fn: () => Promise<Hex>) => {
    setErr(null); setBusy(key);
    try { await ensureChain(); const h = await fn(); if (publicClient) await publicClient.waitForTransactionReceipt({ hash: h }); await load(); }
    catch (e: any) { setErr(e?.shortMessage || e?.message || "Transaction failed"); }
    finally { setBusy(null); }
  };

  const setFee = () => {
    const bps = Number(feeInput);
    if (!Number.isInteger(bps) || bps < 0 || bps > 1000) { setErr("Fee must be 0–1000 bps (≤ 10%)"); return; }
    run("fee", () => writeContractAsync({ address: AGENT_MARKET_ADDRESS as Hex, abi: AGENT_MARKET_ABI, functionName: "setFeeBps", args: [BigInt(bps)], chainId: AGENT_MARKET_CHAIN_ID }));
  };
  const setTreas = () => {
    const t = treasInput.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(t)) { setErr("Enter a valid treasury address"); return; }
    run("treas", () => writeContractAsync({ address: AGENT_MARKET_ADDRESS as Hex, abi: AGENT_MARKET_ABI, functionName: "setTreasury", args: [t as Hex], chainId: AGENT_MARKET_CHAIN_ID }));
  };

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gb-faint">{label}</p>
      <p className="mt-0.5 font-display text-sm text-slate-100">{value}</p>
    </div>
  );

  return (
    <div className="liquid-glass space-y-4 rounded-xl p-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Tag className="h-4 w-4" /> Agent market contract</h2>
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gb-muted">
          <a href={`${explorer}/address/${AGENT_MARKET_ADDRESS}`} target="_blank" rel="noreferrer" className="font-mono text-brassLight hover:underline">{AGENT_MARKET_ADDRESS}</a>
          <ExternalLink className="h-3 w-3 text-gb-faint" />
        </p>
      </div>

      {/* stats — recomputed from the event log */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Listed now" value={String(active)} />
        <Stat label="Sales" value={stats ? String(stats.sales) : "…"} />
        <Stat label="Volume" value={stats ? `${formatEther(stats.volume)} ETH` : "…"} />
        <Stat label="Fees taken" value={stats ? `${formatEther(stats.fees)} ETH` : "…"} />
      </div>

      {/* config */}
      <div className="grid grid-cols-1 gap-1 font-mono text-[11px] text-gb-muted sm:grid-cols-3">
        <span>owner <span className="text-slate-300">{cfg ? short(cfg.owner) : "…"}</span></span>
        <span>treasury <span className="text-slate-300">{cfg ? short(cfg.treasury) : "…"}</span></span>
        <span>fee <span className="text-brassLight">{cfg ? `${(cfg.feeBps / 100).toFixed(2)}%` : "…"}</span></span>
      </div>

      {err && <p className="flex items-center gap-1.5 text-[12px] text-red-400"><AlertCircle className="h-3.5 w-3.5" />{err}</p>}

      {isOwner ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-gb-muted">Protocol fee (bps)</label>
            <div className="mt-1 flex items-center gap-1.5">
              <input value={feeInput} onChange={(e) => setFeeInput(e.target.value)} inputMode="numeric"
                className="w-full rounded-lg bg-gb-input border border-gb-border px-3 py-2 text-sm text-slate-200 focus:border-brassLight/50 focus:outline-none" />
              <button onClick={setFee} disabled={!!busy}
                className="inline-flex items-center gap-1 rounded-lg bg-brass px-3 py-2 text-[12px] font-medium text-deepink hover:bg-brassLight disabled:opacity-40">
                {busy === "fee" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Set
              </button>
            </div>
            <p className="mt-1 text-[10px] text-gb-faint">= {(Number(feeInput || "0") / 100).toFixed(2)}% per sale · applies to future sales; each sale's actual fee is in its Sold event.</p>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-gb-muted">Treasury</label>
            <div className="mt-1 flex items-center gap-1.5">
              <input value={treasInput} onChange={(e) => setTreasInput(e.target.value)} placeholder="0x…"
                className="w-full rounded-lg bg-gb-input border border-gb-border px-3 py-2 font-mono text-[12px] text-slate-200 focus:border-brassLight/50 focus:outline-none" />
              <button onClick={setTreas} disabled={!!busy}
                className="inline-flex items-center gap-1 rounded-lg bg-brass px-3 py-2 text-[12px] font-medium text-deepink hover:bg-brassLight disabled:opacity-40">
                {busy === "treas" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Set
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-gb-faint">
          {cfg ? <>Connect as the owner (<span className="font-mono text-gb-muted">{short(cfg.owner)}</span>) to change the fee or treasury.</> : "Loading contract config…"}
        </p>
      )}
    </div>
  );
}
