"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useAccount, useDisconnect, useWriteContract, useSwitchChain, useChainId, useSendTransaction, usePublicClient } from "wagmi";
import { formatEther, keccak256, toHex } from "viem";
import { Bot, Wallet, Loader2, Coins, ShieldCheck, Clock, Check, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight, LogOut, Lock, ClipboardCheck } from "lucide-react";
import { GATEWAY_URL } from "@/lib/erc8004";
import { useWalletModal } from "@/hooks/useWalletModal";
import { AgentChat } from "@/components/AgentChat";
import { McpLogo } from "@/components/McpLogo";
import { ConsultProofCard } from "@/components/ConsultProofCard";
import { ReputationBadge } from "@/components/ReputationBadge";
import { VerticeMark } from "@/components/VerticeMark";
import { fetchReputation, type Reputation } from "@/lib/marketplace";
import { buildCardsFromIds } from "@/lib/mcps";

// ConsultEscrow.open(bytes32 jobId, address provider, address attestor, uint256 deadline) payable
const ESCROW_ABI = [{
  type: "function", name: "open", stateMutability: "payable",
  inputs: [
    { name: "jobId", type: "bytes32" }, { name: "provider", type: "address" },
    { name: "attestor", type: "address" }, { name: "deadline", type: "uint256" },
  ], outputs: [],
}] as const;

const EXPLORER: Record<number, string> = { 1: "https://etherscan.io", 11155111: "https://sepolia.etherscan.io" };

type Consultable = { registry: string; agentId: string; name: string; description: string; image: string; consultPrice: string; completionWindow: number; consultTools: string[] };
type PricingBlock = {
  escrow?: string | null; escrowChainId?: number | null; minFee?: string;
  payTo?: string | null; attestor?: string | null; treasury?: string | null;
};

function fmtHours(s?: number) { if (!s) return "—"; const h = s / 3600; return h >= 1 ? `${h}h` : `${Math.round(s / 60)}m`; }

export default function A2APage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open: openWallet } = useWalletModal();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [agents, setAgents] = useState<Consultable[]>([]);
  const [idx, setIdx] = useState(0);
  const [toolIdx, setToolIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState<PricingBlock | null>(null);
  const [authorized, setAuthorized] = useState<Record<string, boolean>>({});

  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("Opening escrow…");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobToken, setJobToken] = useState<string | null>(null);
  const [jobExpiry, setJobExpiry] = useState<number | null>(null);
  const [consultErr, setConsultErr] = useState<string | null>(null);

  // Load the published marketplace.
  useEffect(() => {
    fetch(`${GATEWAY_URL}/agent/consultable`).then((r) => (r.ok ? r.json() : []))
      .then((list: Consultable[]) => {
        setAgents(list || []);
        setLoading(false);
        // Deep-link from the marketplace: ?agent=registry:agentId preselects that agent.
        const want = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("agent") : null;
        if (want && list?.length) {
          const i = list.findIndex((a) => `${a.registry}:${a.agentId}` === want);
          if (i >= 0) setIdx(i);
        }
      })
      .catch(() => { setAgents([]); setLoading(false); });
  }, []);

  const active = agents.length ? agents[idx] : null;
  const toolCards = useMemo(() => (active ? buildCardsFromIds(active.consultTools || []) : []), [active]);

  // Recomputable reputation for the agent on the consult card (predicate over escrow settlements).
  const [rep, setRep] = useState<Reputation | null>(null);
  useEffect(() => {
    if (!active) { setRep(null); return; }
    let alive = true;
    setRep(null);
    fetchReputation(active.registry, active.agentId).then((r) => { if (alive) setRep(r); });
    return () => { alive = false; };
  }, [active?.registry, active?.agentId]);

  // Reset the consult session + load escrow pricing when the active agent changes.
  useEffect(() => {
    setTxHash(null); setJobId(null); setJobToken(null); setJobExpiry(null); setConsultErr(null); setPricing(null); setToolIdx(0);
    if (!active) return;
    setAuthorized(Object.fromEntries((active.consultTools || []).map((id) => [id, true])));
    fetch(`${GATEWAY_URL}/.well-known/agent/${active.registry}/${active.agentId}.json`)
      .then((r) => (r.ok ? r.json() : null)).then((card) => setPricing(card?.pricing ?? null)).catch(() => setPricing(null));
  }, [active?.registry, active?.agentId]);

  const priceWei = active?.consultPrice ?? "0";
  const isPriced = useMemo(() => { try { return BigInt(priceWei) > 0n; } catch { return false; } }, [priceWei]);
  const priceEth = (() => { try { return formatEther(BigInt(priceWei)); } catch { return "0"; } })();
  const minFeeWei = pricing?.minFee ?? "0";
  const minFeeEth = (() => { try { return formatEther(BigInt(minFeeWei)); } catch { return "0"; } })();
  const totalEth = (() => { try { return formatEther(BigInt(priceWei) + BigInt(minFeeWei)); } catch { return priceEth; } })();
  const escrowChain = pricing?.escrowChainId ?? null;
  const chosen = Object.entries(authorized).filter(([, v]) => v).map(([k]) => k);

  const cycle = (d: number) => setIdx((i) => (i + d + agents.length) % agents.length);

  const consult = useCallback(async () => {
    if (!active) return;
    if (!isConnected || !address) { openWallet(); return; }
    setConsultErr(null); setTxHash(null); setJobId(null);
    if (!isPriced) { setConsultErr("This agent is free — direct-connect flow lands in the next slice."); return; }

    const escrow = pricing?.escrow, provider = pricing?.payTo, attestor = pricing?.attestor, treasury = pricing?.treasury;
    if (!escrow || !provider || !attestor) { setConsultErr("This agent isn't fully configured for paid consults yet."); return; }
    if (minFeeWei !== "0" && !treasury) { setConsultErr("A platform min-fee is set but no treasury is configured."); return; }

    setBusy(true);
    try {
      if (escrowChain && chainId !== escrowChain) { setBusyMsg("Switching network…"); await switchChainAsync({ chainId: escrowChain }); }
      // Recomputable job→agent binding: jobId COMMITS to this agent —
      // jobId = keccak256(utf8(consumer:registry:agentId:salt)), lowercase addresses. The salt
      // is sent to the gateway (which verifies the commitment) and published, so anyone
      // re-derives jobId and confirms it belongs to this agent. No trusted mapping.
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
      const jid = keccak256(toHex(`${address.toLowerCase()}:${active.registry.toLowerCase()}:${active.agentId}:${salt}`));
      const windowSecs = active.completionWindow && active.completionWindow > 0 ? active.completionWindow : 3600;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + windowSecs);

      setBusyMsg("Opening escrow…");
      const hash = await writeContractAsync({
        address: escrow as `0x${string}`, abi: ESCROW_ABI, functionName: "open",
        args: [jid, provider as `0x${string}`, attestor as `0x${string}`, deadline],
        value: BigInt(priceWei), ...(escrowChain ? { chainId: escrowChain } : {}),
      });
      setJobId(jid); setTxHash(hash);
      setBusyMsg("Confirming on-chain…");
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });

      let feeTx: string | undefined;
      if (minFeeWei !== "0" && treasury) {
        setBusyMsg("Paying platform fee…");
        feeTx = await sendTransactionAsync({ to: treasury as `0x${string}`, value: BigInt(minFeeWei), ...(escrowChain ? { chainId: escrowChain } : {}) });
      }

      setBusyMsg("Issuing job token…");
      const res = await fetch(`${GATEWAY_URL}/agent/consult/job`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: jid, registry: active.registry, agentId: active.agentId, tools: chosen, salt, ...(feeTx ? { feeTx } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `job token failed (${res.status})`);
      setJobToken(data.token); setJobExpiry(data.expiresAt ?? null);
    } catch (e: any) {
      setConsultErr(e?.shortMessage || e?.message || String(e));
    } finally { setBusy(false); }
  }, [active, isConnected, address, isPriced, pricing, minFeeWei, escrowChain, chainId, priceWei, chosen, openWallet, switchChainAsync, writeContractAsync, sendTransactionAsync, publicClient]);

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/demo" className="inline-flex items-center gap-2.5 font-display font-medium tracking-tight text-paper"><VerticeMark size={26} spin />Recomputable Agents</Link>
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
            <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Home</Link>
            <Link href="/demo" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Demo</Link>
            <Link href="/mint" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Mint</Link>
            <Link href="/marketplace" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Marketplace</Link>
            <Link href="/console" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Console</Link>
            <Link href="/verify" className="font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80 hover:text-brassLight">Verify</Link>
            <span className="w-px h-4 bg-white/12" aria-hidden />
            {!address ? (
              <button onClick={openWallet} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/90 hover:text-brassLight">
                <Wallet className="h-3.5 w-3.5" /> Connect
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => disconnect()} title={`${address.slice(0, 6)}…${address.slice(-4)} — disconnect`} aria-label="Disconnect" className="inline-flex items-center text-gb-muted hover:text-red-400 transition-colors">
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">Agent-to-agent marketplace</p>
            <p className="text-sm text-paper/50 mt-1">Consult a live agent — pay into escrow, use it, then recompute its output yourself.</p>
          </div>
          {agents.length > 1 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[10px] text-gb-faint">{idx + 1}/{agents.length}</span>
              <button onClick={() => cycle(-1)} aria-label="Previous agent" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => cycle(1)} aria-label="Next agent" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-paper/30" /></div>
        ) : !active ? (
          <div className="liquid-glass rounded-2xl p-10 text-center mt-6 space-y-2">
            <Bot className="w-7 h-7 text-paper/30 mx-auto" />
            <p className="text-sm text-paper/60">No agents are published for consult yet.</p>
            <p className="text-[12px] text-paper/35">Own a Recompute Kit Bot? <Link href="/consult" className="text-brassLight hover:text-brass">Publish it →</Link></p>
          </div>
        ) : (
          <div className="mt-6 grid md:grid-cols-2 gap-4 items-start">
            {/* Left — chat */}
            <div className="liquid-glass rounded-2xl overflow-hidden h-[560px] flex flex-col">
              {jobToken ? (
                <AgentChat key={`${active.registry}-${active.agentId}-${jobId}`} registry={active.registry} agentId={active.agentId} ownerAddress={address} authToken={jobToken} compact />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10"><Lock className="w-5 h-5 text-paper/40" /></span>
                  <p className="text-sm text-paper/55 max-w-xs">
                    {isPriced ? `Pay ${priceEth} ETH into escrow to start consulting ${active.name}.` : `Connect to start consulting ${active.name}.`}
                  </p>
                  <p className="text-[11px] text-paper/30">The chat unlocks once your escrow job token is issued.</p>
                </div>
              )}
            </div>

            {/* Right — agent card + pay */}
            <div className="space-y-4">
              <div className="liquid-glass rounded-3xl border border-brassLight/30 p-5 flex gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={active.image} alt={active.name} className="w-20 h-20 rounded-2xl object-cover border border-white/10 shrink-0" style={{ imageRendering: "pixelated" }} />
                <div className="flex-1 min-w-0">
                  <h1 className="font-display font-medium text-paper text-xl leading-tight truncate">{active.name}</h1>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ReputationBadge rep={rep} />
                    <Link href={`/console?agent=${encodeURIComponent(`${active.registry}:${active.agentId}`)}`}
                      title="Open this agent's audit trail"
                      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-paper/35 hover:text-brassLight transition-colors">
                      <ClipboardCheck className="h-3 w-3" /> Audit
                    </Link>
                  </div>
                  {active.description && <p className="text-sm text-paper/50 mt-1.5 line-clamp-3">{active.description}</p>}
                </div>
              </div>

              {/* Pricing */}
              <div className="liquid-glass rounded-2xl border border-brassLight/30 p-5 space-y-3">
                <div className="flex items-center gap-2"><Coins className="w-4 h-4 text-brassLight" /><p className="text-[10px] uppercase tracking-widest text-paper/40">Consult</p></div>
                {isPriced ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-paper">{priceEth}</span><span className="text-sm text-paper/40">ETH</span>
                      <span className="ml-auto flex items-center gap-1 text-xs text-paper/40"><Clock className="w-3.5 h-3.5" /> within {fmtHours(active.completionWindow)}</span>
                    </div>
                    <div className="text-[11px] text-paper/50 bg-black/20 rounded-xl px-3 py-2 flex justify-between">
                      <span>stake {priceEth} + fee {minFeeEth}</span><span className="font-mono">≈ {totalEth} ETH</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-paper/50">This agent is <span className="text-emerald-400">free</span> — no consult payment required.</p>
                )}
              </div>

              {/* Available tools (owner-curated) — compact ◀▶ carousel, tap to scope-down */}
              {toolCards.length > 0 && (() => {
                const ti = toolIdx % toolCards.length;
                const t = toolCards[ti];
                return (
                  <div className="liquid-glass rounded-2xl border border-brassLight/30 p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-brassLight" />
                      <p className="text-[10px] uppercase tracking-widest text-paper/40">Available tools</p>
                      <span className="ml-auto text-[10px] text-paper/25">{chosen.length}/{toolCards.length} on</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setToolIdx((i) => (i - 1 + toolCards.length) % toolCards.length)} disabled={toolCards.length < 2}
                        aria-label="Previous tool" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button onClick={() => setAuthorized((a) => ({ ...a, [t.id]: !a[t.id] }))} disabled={!!jobToken}
                        title={authorized[t.id] ? "Included — tap to exclude for this job" : "Excluded — tap to include"}
                        className="flex-1 min-w-0 flex items-center gap-3 text-left rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 hover:bg-white/5 transition-colors disabled:opacity-60">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                          <McpLogo card={t} className="h-5 w-5" fill />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-xs text-paper/80 font-medium">{t.label}</span>
                          <span className="text-[9px] text-paper/30"> · {t.tagline}</span>
                          <span className="block text-[10px] text-paper/40 line-clamp-2 mt-0.5 leading-snug">{t.blurb}</span>
                        </span>
                        <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${authorized[t.id] ? "bg-brass/25 border-brassLight/50" : "border-white/20"}`}>
                          {authorized[t.id] && <Check className="w-3 h-3 text-brass" />}
                        </span>
                      </button>
                      <button onClick={() => setToolIdx((i) => (i + 1) % toolCards.length)} disabled={toolCards.length < 2}
                        aria-label="Next tool" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-1.5">
                      {toolCards.map((_, i) => (
                        <span key={i} className={`h-1 w-1 rounded-full transition-colors ${i === ti ? "bg-brassLight" : "bg-white/15"}`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-paper/30 text-center">Owner-exposed · tap the card to include/exclude for this job</p>
                  </div>
                );
              })()}

              {/* Pay */}
              {!jobToken && (
                <button onClick={consult} disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brass hover:bg-brassLight disabled:opacity-40 text-deepink font-display font-medium transition-colors">
                  {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> {busyMsg}</>) :
                    !isConnected ? (<><Wallet className="w-4 h-4" /> Connect wallet to consult</>) :
                    isPriced ? (<><Coins className="w-4 h-4" /> Consult for {priceEth} ETH</>) :
                    (<>Connect to this agent</>)}
                </button>
              )}
              {isConnected && !txHash && !jobToken && <p className="text-[10px] text-center text-paper/25">paying from {address?.slice(0, 6)}…{address?.slice(-4)}</p>}

              {consultErr && (
                <div className="liquid-glass rounded-xl px-4 py-3 flex items-start gap-2 text-[11px] text-brass/80">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{consultErr}</span>
                </div>
              )}
              {txHash && (
                <div className="liquid-glass rounded-2xl p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium"><Check className="w-4 h-4" /> Escrow opened</div>
                  <p className="text-[11px] text-paper/40">{priceEth} ETH locked — released on a valid delivery proof, refundable after the window.</p>
                  <a href={`${EXPLORER[escrowChain ?? 0] ?? "https://etherscan.io"}/tx/${txHash}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-brassLight hover:text-brass">view transaction <ExternalLink className="w-2.5 h-2.5" /></a>
                </div>
              )}
              {jobToken && jobId && (
                <ConsultProofCard
                  jobId={jobId}
                  gatewayUrl={GATEWAY_URL}
                  onClose={() => { setJobToken(null); setJobId(null); setJobExpiry(null); setTxHash(null); setConsultErr(null); }}
                />
              )}
              {jobToken && (
                <p className="text-[11px] text-center text-paper/40 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-brass" /> Consult live · {chosen.length} tool{chosen.length === 1 ? "" : "s"}{jobExpiry ? ` · until ${new Date(jobExpiry * 1000).toLocaleTimeString()}` : ""}
                </p>
              )}

              <p className="text-[10px] text-center text-paper/25 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" /> every output is independently verifiable · <Link href="/verify" className="text-brassLight/80 hover:text-brassLight">recompute it →</Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
