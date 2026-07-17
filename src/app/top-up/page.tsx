"use client";

import { useState, useEffect } from "react";
import {
  useAccount, useDisconnect, usePublicClient, useSendTransaction,
} from "wagmi";
import { useWalletModal } from "@/hooks/useWalletModal";
import { parseEther, formatEther, type Address } from "viem";
import { Zap, Wallet, CheckCircle2, AlertCircle, Loader2, ExternalLink, HelpCircle } from "lucide-react";
import { useDisplayName } from "@/hooks/useDisplayName";
import { NavMenu } from "@/components/NavMenu";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { open }       = useWalletModal();
  const { disconnect } = useDisconnect();
  const displayName    = useDisplayName(address);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-24 rounded-full liquid-glass animate-pulse" />;
  if (isConnected && address) {
    return (
      <button onClick={() => disconnect()}
        className="liquid-glass rounded-full px-4 py-2 text-xs text-paper/70 hover:text-paper transition-colors font-mono">
        {displayName} · disconnect
      </button>
    );
  }
  return (
    <button onClick={() => open()}
      className="rounded-full bg-brass hover:bg-brassLight text-deepink px-4 py-2 flex items-center gap-2 text-xs font-display font-medium transition-colors">
      <Wallet className="w-3.5 h-3.5" />Connect
    </button>
  );
}

export default function TopupPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const { open }       = useWalletModal();
  const publicClient   = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();

  const [priceWei,    setPriceWei]    = useState<bigint | null>(null);
  const [treasury,    setTreasury]    = useState<string>("");
  const [ownerAddr,   setOwnerAddr]   = useState("");
  const [ethInput,    setEthInput]    = useState("0.01");
  const [paying,      setPaying]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [result,      setResult]      = useState<{ txHash: string; credits: number } | null>(null);
  const [walletBal,   setWalletBal]   = useState<number | null>(null);

  // Pre-fill from ?address= or ?wallet= query param, or connected wallet
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const a = params.get("address") || params.get("wallet");
    if (a) setOwnerAddr(a);
  }, []);

  // Auto-fill connected wallet if input is empty
  useEffect(() => {
    if (address && !ownerAddr) setOwnerAddr(address);
  }, [address]);

  // Load price
  useEffect(() => {
    fetch(`${GW_URL}/api/registry/price`)
      .then(r => r.json())
      .then(d => {
        if (d.priceWei) setPriceWei(BigInt(d.priceWei));
        if (d.treasury) setTreasury(d.treasury);
      }).catch(() => {});
  }, []);

  // Load wallet balance when address changes
  useEffect(() => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(ownerAddr)) { setWalletBal(null); return; }
    fetch(`${GW_URL}/api/registry/wallet/${ownerAddr}/credits`)
      .then(r => r.json())
      .then(d => setWalletBal(typeof d.credits === "number" ? d.credits : null))
      .catch(() => {});
  }, [ownerAddr]);

  const ethValue   = (() => { try { return parseEther(ethInput || "0"); } catch { return 0n; } })();
  const creditsEst = priceWei && priceWei > 0n ? Number(ethValue / priceWei) : 0;
  const pricePerK  = priceWei ? Number(formatEther(priceWei * 1000n)) : null;

  const canPay = isConnected && !!treasury && ethValue > 0n && creditsEst >= 1 &&
    /^0x[0-9a-fA-F]{40}$/.test(ownerAddr) && !paying && !result;

  async function handlePay() {
    if (!canPay) return;
    setPaying(true); setError(null);
    try {
      const hash = await sendTransactionAsync({ to: treasury as Address, value: ethValue });
      await publicClient!.waitForTransactionReceipt({ hash });
      const res = await fetch(`${GW_URL}/api/registry/wallet/topup`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ txHash: hash, ownerAddress: ownerAddr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ txHash: hash, credits: data.creditsGranted });
      setWalletBal(b => (b ?? 0) + data.creditsGranted);
    } catch (e: any) {
      setError(e.shortMessage ?? e.message);
    }
    setPaying(false);
  }

  if (!mounted) return <div className="min-h-screen bg-deepink" />;

  return (
    <div className="relative min-h-screen bg-deepink text-paper flex flex-col">
      <NavMenu currentPath="top-up" />

      <div className="relative z-10 flex flex-col items-center justify-start pt-16 pb-20 px-4 min-h-screen">

        <div className="w-full max-w-lg mb-8">
          <a href="/demo" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper transition-colors">← Demo</a>
        </div>

        {/* Hero */}
        <div className="w-full max-w-lg mb-8">
          <h1 className="font-display text-5xl lg:text-7xl font-medium tracking-tightest text-paper leading-none mb-4">
            top<span className="brass-text">up</span>
          </h1>
          <p className="text-sm text-gb-muted leading-relaxed">
            Add AI credits to your wallet. Credits are tied to your address and work
            across every agent you own — on any registry.
          </p>
        </div>

        {/* Info cards */}
        <div className="w-full max-w-lg flex flex-col gap-3 mb-6">
          <div className="liquid-glass rounded-2xl px-5 py-4 flex gap-3">
            <Zap className="w-4 h-4 text-brassLight shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-paper/70 mb-1">Per-wallet credits</p>
              <p className="text-[11px] text-paper/40 leading-relaxed">
                Credits are stored against your wallet address. One top-up covers all agents
                you hold — across all collections and registries. Credits are deducted per AI message.
              </p>
            </div>
          </div>
          <div className="liquid-glass rounded-2xl px-5 py-4 flex gap-3">
            <HelpCircle className="w-4 h-4 text-paper/30 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-paper/50 mb-1">Which address do I use?</p>
              <p className="text-[11px] text-paper/35 leading-relaxed">
                Use the wallet that holds your agent NFTs — the same one you sign in with on{" "}
                <a href="../use-agent/" className="text-brassLight hover:text-brass transition-colors">use-agent</a>.
                Connecting your wallet below auto-fills the address.
              </p>
            </div>
          </div>

          {/* Price strip */}
          {priceWei && (
            <div className="liquid-glass rounded-2xl px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-paper/50 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-brassLight" />
                {pricePerK !== null ? `${pricePerK} ETH` : "…"} per 1,000 credits
              </span>
              {treasury && (
                <span className="text-[10px] font-mono text-paper/25">
                  treasury {treasury.slice(0, 6)}…{treasury.slice(-4)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Main card */}
        <div className="w-full max-w-lg liquid-glass rounded-3xl p-6 lg:p-8 flex flex-col gap-5">

          {result ? (
            <div className="flex flex-col items-center gap-5 py-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <div>
                <p className="text-lg font-display font-semibold text-paper">
                  {result.credits.toLocaleString()} credits added!
                </p>
                {walletBal !== null && (
                  <p className="text-xs text-paper/40 mt-1">
                    Wallet balance: <span className="text-brassLight font-mono">{walletBal.toLocaleString()}</span>
                  </p>
                )}
                <p className="text-[11px] text-paper/30 mt-2 max-w-xs mx-auto">
                  Credits are live across all your agents — start chatting immediately.
                </p>
              </div>
              <a href={`https://etherscan.io/tx/${result.txHash}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-paper/40 hover:text-paper/70 transition-colors">
                View on Etherscan <ExternalLink className="w-3 h-3" />
              </a>
              <div className="flex gap-3 mt-2">
                <a href="../use-agent/"
                  className="rounded-full bg-brass hover:bg-brassLight text-deepink px-5 py-2.5 text-sm font-display font-medium flex items-center gap-2 transition-colors">
                  <Zap className="w-3.5 h-3.5" />Use Agent
                </a>
                <button onClick={() => setResult(null)}
                  className="liquid-glass rounded-full px-5 py-2.5 text-sm text-paper/50 hover:text-paper transition-colors">
                  Top up again
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Wallet address */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-paper/50 uppercase tracking-wide">
                    Your Wallet Address
                  </label>
                  {isConnected && address && ownerAddr.toLowerCase() !== address.toLowerCase() && (
                    <button onClick={() => setOwnerAddr(address)}
                      className="text-[10px] text-brassLight hover:text-brass transition-colors">
                      Use connected wallet
                    </button>
                  )}
                </div>
                <input
                  value={ownerAddr}
                  onChange={e => setOwnerAddr(e.target.value)}
                  placeholder="0x… the wallet that holds your agents"
                  className="w-full bg-black/25 border border-white/10 focus:border-brassLight/50 rounded-xl px-3 py-2.5 text-sm font-mono text-paper/90 placeholder-paper/20 outline-none transition-colors"
                />
                {walletBal !== null && (
                  <p className="text-[11px] text-paper/35 flex items-center gap-1.5">
                    <Zap className="w-2.5 h-2.5" />
                    Current balance:&nbsp;
                    <span className={walletBal === 0 ? "text-red-400" : walletBal < 50 ? "text-brassLight" : "text-emerald-400"}>
                      {walletBal.toLocaleString()} credits
                    </span>
                  </p>
                )}
              </div>

              {/* ETH amount */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-paper/50 uppercase tracking-wide">
                  ETH Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={ethInput}
                    onChange={e => setEthInput(e.target.value)}
                    step="0.001"
                    min="0"
                    className="w-full bg-black/25 border border-white/10 focus:border-brassLight/50 rounded-xl px-3 py-2.5 text-sm font-mono text-paper/90 placeholder-paper/20 outline-none transition-colors pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-paper/30">ETH</span>
                </div>

                <div className="flex gap-2 mt-1">
                  {["0.005", "0.01", "0.05", "0.1"].map(v => (
                    <button key={v} onClick={() => setEthInput(v)}
                      className={`text-[11px] rounded-full px-3 py-1 border transition-colors ${
                        ethInput === v
                          ? "border-brassLight/40 bg-brass/10 text-brassLight"
                          : "border-white/10 text-paper/40 hover:border-white/25 hover:text-paper/60"
                      }`}>
                      {v}
                    </button>
                  ))}
                </div>

                {creditsEst > 0 && (
                  <div className="flex items-center gap-2 mt-2 px-4 py-2.5 rounded-2xl bg-brass/8 border border-brass/20">
                    <Zap className="w-3.5 h-3.5 text-brassLight shrink-0" />
                    <span className="text-sm text-paper/70">
                      You get <span className="font-semibold text-brassLight">{creditsEst.toLocaleString()}</span> credits
                      {walletBal !== null && (
                        <span className="text-paper/35"> · new balance: {(walletBal + creditsEst).toLocaleString()}</span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {!isConnected ? (
                <button onClick={() => open()}
                  className="rounded-2xl bg-brass hover:bg-brassLight text-deepink px-6 py-3 flex items-center justify-center gap-2.5 text-sm font-display font-medium transition-colors">
                  <Wallet className="w-4 h-4" />Connect wallet
                </button>
              ) : (
                <button onClick={handlePay} disabled={!canPay}
                  className="rounded-2xl bg-brass hover:bg-brassLight text-deepink px-6 py-3 flex items-center justify-center gap-2.5 text-sm font-display font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {paying
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
                    : <><Zap className="w-4 h-4" />Pay {ethInput || "0"} ETH · Get {creditsEst.toLocaleString()} credits</>
                  }
                </button>
              )}

              <p className="text-[11px] text-paper/20 text-center leading-relaxed">
                Payment sent to treasury. Credits applied to your wallet address instantly after confirmation.
              </p>
            </>
          )}
        </div>

        {isConnected && !result && (
          <div className="mt-4"><ConnectButton /></div>
        )}
      </div>
    </div>
  );
}
