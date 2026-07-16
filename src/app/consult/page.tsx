"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useWriteContract, useSwitchChain, useChainId, useSendTransaction, usePublicClient, useDisconnect } from "wagmi";
import { formatEther, keccak256, toHex, createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { Bot, Wallet, Loader2, Coins, ShieldCheck, Clock, Check, AlertTriangle, ExternalLink, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { GATEWAY_URL } from "@/lib/erc8004";
import { useWalletModal } from "@/hooks/useWalletModal";
import { AgentChat } from "@/components/AgentChat";
import { DEMO_AGENT } from "@/lib/mcps";

const RKB = (process.env.NEXT_PUBLIC_GENESIS_REGISTRY_ADDRESS || "0x8b5AF3A59f81c7e16617E8Eb824BC6FfB792A2C3").toLowerCase();
const RPC = process.env.NEXT_PUBLIC_MAINNET_RPC || "https://ethereum-rpc.publicnode.com";
type OwnedAgent = { registry: string; agent_id: string; name: string; image: string };

const pub = createPublicClient({ chain: mainnet, transport: http(RPC) });
const TOKENURI_ABI = [{
  type: "function", name: "tokenURI", stateMutability: "view",
  inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "string" }],
}] as const;

// An RKB agent's minted toolset lives in its on-chain tokenURI metadata (mcps[]).
async function fetchAgentMcps(agentId: string): Promise<string[]> {
  try {
    let uri = (await pub.readContract({
      address: RKB as `0x${string}`, abi: TOKENURI_ABI, functionName: "tokenURI", args: [BigInt(agentId)],
    })) as string;
    if (uri.startsWith("ipfs://")) uri = "https://ipfs.io/ipfs/" + uri.slice(7);
    const r = await fetch(uri, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    return Array.isArray(j.mcps) ? j.mcps : [];
  } catch { return []; }
}

// ConsultEscrow.open(bytes32 jobId, address provider, address attestor, uint256 deadline) payable
const ESCROW_ABI = [{
  type: "function", name: "open", stateMutability: "payable",
  inputs: [
    { name: "jobId", type: "bytes32" }, { name: "provider", type: "address" },
    { name: "attestor", type: "address" }, { name: "deadline", type: "uint256" },
  ], outputs: [],
}] as const;

const EXPLORER: Record<number, string> = { 1: "https://etherscan.io", 11155111: "https://sepolia.etherscan.io" };

type PricingBlock = {
  consultPrice?: string; completionWindow?: number; currency?: string;
  escrow?: string | null; escrowChainId?: number | null; minFee?: string;
  payTo?: string | null; attestor?: string | null; treasury?: string | null;
};
type AgentCard = {
  name?: string; description?: string; url?: string;
  pricing?: PricingBlock;
  skills?: { id: string; name: string; description?: string }[];
  supported_interfaces?: { protocol: string; url: string }[];
  trustEndpoints?: { verifyProof?: string; independentNodes?: string[]; selfHostVerifier?: string };
  erc8004?: { registry: string; agentId: string };
};
type Mcp = { id: string; name: string; description?: string };

function fmtHours(s?: number) { if (!s) return "—"; const h = s / 3600; return h >= 1 ? `${h}h` : `${Math.round(s / 60)}m`; }

function ConsultInner() {
  const sp = useSearchParams();
  const urlRegistry = (sp.get("registry") || "").toLowerCase();
  const urlAgentId  = sp.get("agentId") || sp.get("agent_id") || "";
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open: openWallet } = useWalletModal();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [card, setCard]   = useState<AgentCard | null>(null);
  const [mcps, setMcps]   = useState<Mcp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<Record<string, boolean>>({});
  const [busy, setBusy]   = useState(false);
  const [busyMsg, setBusyMsg] = useState("Opening escrow…");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobToken, setJobToken] = useState<string | null>(null);
  const [jobExpiry, setJobExpiry] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [consultErr, setConsultErr] = useState<string | null>(null);
  const [myAgents, setMyAgents] = useState<OwnedAgent[]>([]);
  const [ai, setAi] = useState(0);

  // Keep the wallet's RKB agents in view (the connection persists across /demo → /consult).
  useEffect(() => {
    if (!address) { setMyAgents([]); return; }
    fetch(`${GATEWAY_URL}/agent/owned/${address}`).then((r) => (r.ok ? r.json() : []))
      .then((all: OwnedAgent[]) => { setMyAgents((all || []).filter((a) => a.registry.toLowerCase() === RKB)); setAi(0); })
      .catch(() => setMyAgents([]));
  }, [address]);

  // Active consult target: the selected owned agent when connected, else the URL default.
  const activeOwned = myAgents.length ? myAgents[ai] : null;
  const registry = (activeOwned ? activeOwned.registry : urlRegistry).toLowerCase();
  const agentId  = activeOwned ? activeOwned.agent_id : urlAgentId;
  const cycle = (d: number) => setAi((i) => (i + d + myAgents.length) % myAgents.length);

  // Mask the default hero identity (Bulla Goblin → Eth Global LX Agent '26) unless on an owned agent.
  const isDefaultAgent = !activeOwned && registry === DEMO_AGENT.registry.toLowerCase() && agentId === DEMO_AGENT.agentId;
  const displayName  = isDefaultAgent ? DEMO_AGENT.name : (activeOwned?.name || card?.name || "Agent");
  const displayImage = isDefaultAgent ? DEMO_AGENT.image : (activeOwned?.image || null);

  useEffect(() => {
    if (!registry || !agentId) { setError("Missing ?registry= and ?agentId= in the URL."); setLoading(false); return; }
    (async () => {
      setLoading(true); setError(null);
      try {
        const r = await fetch(`${GATEWAY_URL}/.well-known/agent/${registry}/${agentId}.json`);
        if (!r.ok) throw new Error(r.status === 404 ? "Agent not found." : `HTTP ${r.status}`);
        setCard(await r.json());
        // Full platform catalog (id → name/description).
        const m = await fetch(`${GATEWAY_URL}/agent/public-mcps`).then(x => x.ok ? x.json() : []).catch(() => []);
        const catalog: Mcp[] = Array.isArray(m) ? m : [];
        // Scope to THIS agent's minted toolset for RKB agents; the community default keeps the full catalog.
        let list = catalog;
        if (registry === RKB) {
          const ids = await fetchAgentMcps(agentId);
          const set = new Set(ids);
          list = catalog.filter(x => set.has(x.id));
        }
        setMcps(list);
        setAuthorized(Object.fromEntries(list.map(x => [x.id, true]))); // default: authorize the agent's tools, deselect to scope down
      } catch (e: any) { setError(e?.message ?? String(e)); }
      finally { setLoading(false); }
    })();
  }, [registry, agentId]);

  const pricing = card?.pricing;
  const priceWei = pricing?.consultPrice ?? "0";
  const minFeeWei = pricing?.minFee ?? "0";
  const isPriced = useMemo(() => { try { return BigInt(priceWei) > 0n; } catch { return false; } }, [priceWei]);
  const priceEth = (() => { try { return formatEther(BigInt(priceWei)); } catch { return "0"; } })();
  const minFeeEth = (() => { try { return formatEther(BigInt(minFeeWei)); } catch { return "0"; } })();
  const totalEth = (() => { try { return formatEther(BigInt(priceWei) + BigInt(minFeeWei)); } catch { return priceEth; } })();
  const chosen = Object.entries(authorized).filter(([, v]) => v).map(([k]) => k);

  const escrowChain = pricing?.escrowChainId ?? null;

  async function handleConsult() {
    if (!isConnected || !address) { openWallet(); return; }
    setConsultErr(null); setTxHash(null); setJobId(null);

    // Free agent → no escrow, just a connection. Job-scoped token issuance is slice 4b.
    if (!isPriced) { setConsultErr("This agent is free — direct-connect flow lands in the next slice."); return; }

    const escrow   = pricing?.escrow;
    const provider = pricing?.payTo;
    const attestor = pricing?.attestor;
    const treasury = pricing?.treasury;
    if (!escrow || !provider || !attestor) { setConsultErr("This agent isn't configured for paid consults yet (missing escrow/provider/attestor)."); return; }
    if (minFeeWei !== "0" && !treasury) { setConsultErr("A platform min-fee is set but no treasury address is configured — set it in admin → Settlement."); return; }

    setBusy(true);
    try {
      // Ensure the wallet is on the escrow's chain before signing.
      if (escrowChain && chainId !== escrowChain) {
        setBusyMsg("Switching network…");
        await switchChainAsync({ chainId: escrowChain });
      }
      // Unique per-consult jobId: bind consumer, agent and a nonce.
      const jid = keccak256(toHex(`${address}:${registry}:${agentId}:${Date.now()}:${Math.random()}`));
      const windowSecs = pricing?.completionWindow && pricing.completionWindow > 0 ? pricing.completionWindow : 3600;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + windowSecs);

      // 1. Open the escrow (the refundable stake).
      setBusyMsg("Opening escrow…");
      const hash = await writeContractAsync({
        address: escrow as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "open",
        args: [jid, provider as `0x${string}`, attestor as `0x${string}`, deadline],
        value: BigInt(priceWei),
        ...(escrowChain ? { chainId: escrowChain } : {}),
      });
      setJobId(jid);
      setTxHash(hash);
      // Wait for the open to mine so the gateway can recompute the Job from chain.
      setBusyMsg("Confirming on-chain…");
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });

      // 2. Non-refundable min-fee leg to the platform treasury (only if a fee is set).
      let feeTx: string | undefined;
      if (minFeeWei !== "0" && treasury) {
        setBusyMsg("Paying platform fee…");
        feeTx = await sendTransactionAsync({
          to: treasury as `0x${string}`, value: BigInt(minFeeWei),
          ...(escrowChain ? { chainId: escrowChain } : {}),
        });
      }

      // 3. Ask the gateway to verify the escrow on-chain and mint a job-scoped token.
      setBusyMsg("Issuing job token…");
      const res = await fetch(`${GATEWAY_URL}/agent/consult/job`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: jid, registry, agentId, tools: chosen, ...(feeTx ? { feeTx } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `job token failed (${res.status})`);
      setJobToken(data.token);
      setJobExpiry(data.expiresAt ?? null);
    } catch (e: any) {
      setConsultErr(e?.shortMessage || e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <div className="max-w-xl mx-auto px-6 py-8 space-y-4">
        <div className="flex items-center justify-between pb-2">
          <a href="/" className="font-display font-medium tracking-tight text-paper">Verifiable Agents</a>
          <div className="flex items-center gap-5">
            {!address ? (
              <button onClick={openWallet} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/90 hover:text-brassLight">
                <Wallet className="h-3.5 w-3.5" /> Connect
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-gb-faint">{address.slice(0, 6)}…{address.slice(-4)}</span>
                <button onClick={() => { disconnect(); setMyAgents([]); setAi(0); }} title="Disconnect" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-red-400 transition-colors">
                  <LogOut className="h-3.5 w-3.5" /> Disconnect
                </button>
              </div>
            )}
            <a href="/demo" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Demo</a>
            <a href="/verify" className="font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80 hover:text-brassLight">Verify</a>
          </div>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">Agent-to-agent consult</p>
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-paper/30" /></div>
        ) : error ? (
          <div className="liquid-glass rounded-2xl p-6 text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-brassLight mx-auto" />
            <p className="text-sm text-paper/60">{error}</p>
            <p className="text-[11px] text-paper/30 font-mono">/consult/?registry=0x…&amp;agentId=…</p>
          </div>
        ) : card && (
          <>
            {/* Header */}
            <div className="liquid-glass rounded-3xl p-5">
              {myAgents.length > 1 && (
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/8">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brassLight/80">Your agent · {ai + 1} of {myAgents.length}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => cycle(-1)} aria-label="Previous agent" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => cycle(1)} aria-label="Next agent" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
              <div className="flex gap-4">
                {displayImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={displayImage} alt={displayName} className="w-16 h-16 rounded-2xl object-cover border border-white/10 shrink-0" style={{ imageRendering: "pixelated" }} />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center shrink-0"><Bot className="w-7 h-7 text-paper/25" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="font-display font-medium text-paper text-lg leading-tight truncate">{displayName}</h1>
                  {card.description && !isDefaultAgent && <p className="text-sm text-paper/50 mt-1 line-clamp-3">{card.description}</p>}
                  <div className="flex gap-2 flex-wrap mt-2.5">
                    {isDefaultAgent ? (
                      <span className="liquid-glass rounded-full px-2.5 py-1 text-[10px] font-mono text-paper/30">{DEMO_AGENT.ens}</span>
                    ) : (
                      <>
                        <span className="liquid-glass rounded-full px-2.5 py-1 text-[10px] font-mono text-paper/30">#{agentId}</span>
                        <span className="liquid-glass rounded-full px-2.5 py-1 text-[10px] font-mono text-paper/30">{registry.slice(0, 6)}…{registry.slice(-4)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="liquid-glass rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2"><Coins className="w-4 h-4 text-brassLight" /><p className="text-[10px] uppercase tracking-widest text-paper/40">Consult</p></div>
              {isPriced ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-paper">{priceEth}</span>
                    <span className="text-sm text-paper/40">ETH</span>
                    <span className="ml-auto flex items-center gap-1 text-xs text-paper/40"><Clock className="w-3.5 h-3.5" /> deliver within {fmtHours(pricing?.completionWindow)}</span>
                  </div>
                  <p className="text-[11px] text-paper/40 leading-relaxed">
                    You pay the stake into escrow — the agent is paid on delivery, or you refund after the window. A {minFeeEth} ETH platform fee covers the compute and isn&apos;t refundable.
                  </p>
                  <div className="text-[11px] text-paper/50 bg-black/20 rounded-xl px-3 py-2 flex justify-between">
                    <span>stake {priceEth} + fee {minFeeEth}</span><span className="font-mono">≈ {totalEth} ETH</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-paper/50">This agent is <span className="text-emerald-400">free</span> — no consult payment required.</p>
              )}
            </div>

            {/* Tool-scope selector (approved MCPs only) */}
            {mcps.length > 0 && (
              <div className="liquid-glass rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brassLight" /><p className="text-[10px] uppercase tracking-widest text-paper/40">Authorized tools</p><span className="ml-auto text-[10px] text-paper/25">{chosen.length}/{mcps.length}</span></div>
                <p className="text-[11px] text-paper/35">Only platform-approved tools are available. Authorize the subset this consult may use.</p>
                <div className="space-y-1.5">
                  {mcps.map(m => (
                    <button key={m.id} onClick={() => setAuthorized(a => ({ ...a, [m.id]: !a[m.id] }))}
                      className="w-full flex items-start gap-2.5 text-left liquid-glass rounded-xl px-3 py-2 hover:bg-white/5 transition-colors">
                      <span className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${authorized[m.id] ? "bg-brass/25 border-brassLight/50" : "border-white/20"}`}>
                        {authorized[m.id] && <Check className="w-3 h-3 text-brass" />}
                      </span>
                      <span className="min-w-0">
                        <span className="text-xs text-paper/70 font-medium">{m.name}</span>
                        {m.description && <span className="block text-[10px] text-paper/35 line-clamp-1">{m.description}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action */}
            <button onClick={handleConsult} disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brass hover:bg-brassLight disabled:opacity-40 text-deepink font-display font-medium transition-colors">
              {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> {busyMsg}</>) :
                !isConnected ? (<><Wallet className="w-4 h-4" /> Connect wallet to consult</>) :
                isPriced ? (<><Coins className="w-4 h-4" /> Consult for {priceEth} ETH</>) :
                (<>Connect to this agent</>)}
            </button>
            {isConnected && !txHash && <p className="text-[10px] text-center text-paper/25">paying from {address?.slice(0, 6)}…{address?.slice(-4)}</p>}

            {consultErr && (
              <div className="liquid-glass rounded-xl px-4 py-3 flex items-start gap-2 text-[11px] text-brass/80">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{consultErr}</span>
              </div>
            )}
            {txHash && (
              <div className="liquid-glass rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium"><Check className="w-4 h-4" /> Escrow opened</div>
                <p className="text-[11px] text-paper/40">{priceEth} ETH is locked to <span className="font-mono">{pricing?.payTo?.slice(0,6)}…{pricing?.payTo?.slice(-4)}</span> — released on a valid delivery proof, or refundable to you after the window.</p>
                <div className="text-[10px] font-mono text-paper/30 break-all">job {jobId?.slice(0,10)}…</div>
                <a href={`${EXPLORER[escrowChain ?? 0] ?? "https://etherscan.io"}/tx/${txHash}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-brassLight hover:text-brass">view transaction <ExternalLink className="w-2.5 h-2.5" /></a>
              </div>
            )}
            {jobToken && (
              <div className="liquid-glass rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-brass text-sm font-medium"><ShieldCheck className="w-4 h-4" /> Job token issued</div>
                <p className="text-[11px] text-paper/40">
                  Scoped to this job and {chosen.length} tool{chosen.length === 1 ? "" : "s"}{jobExpiry ? `, valid until ${new Date(jobExpiry * 1000).toLocaleString()}` : ""}. Send it as <span className="font-mono">Authorization: Bearer …</span> to drive the agent for this consult.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[10px] font-mono text-paper/50 bg-black/30 rounded-lg px-3 py-2 truncate">{jobToken}</code>
                  <button onClick={() => { navigator.clipboard.writeText(jobToken); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="text-[11px] text-brassLight hover:text-brass shrink-0 px-2 py-2">{copied ? "copied" : "copy"}</button>
                </div>
              </div>
            )}

            {/* Consult chat — full agent UI (nft cards, buy flow, markdown) via the job token */}
            {jobToken && (
              <div className="liquid-glass rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2"><Bot className="w-4 h-4 text-paper/40" /><p className="text-[10px] uppercase tracking-widest text-paper/40">Consult {displayName}</p></div>
                <AgentChat registry={registry} agentId={agentId} ownerAddress={address} authToken={jobToken} compact />
              </div>
            )}

            {/* Trust surface */}
            {card.trustEndpoints && (
              <p className="text-[10px] text-center text-paper/25 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" /> output independently verifiable ·
                <a href={card.trustEndpoints.verifyProof} className="hover:text-paper/50 inline-flex items-center gap-0.5">verify proof <ExternalLink className="w-2.5 h-2.5" /></a>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function ConsultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ConsultInner />
    </Suspense>
  );
}
