"use client";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { type Address } from "viem";
import { useWalletModal } from "@/hooks/useWalletModal";
import { Bot, ArrowLeft, Wallet, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { AgentChat } from "@/components/AgentChat";
import { CreditsPill } from "@/components/CreditsPill";
import { usePageRecords } from "@/hooks/usePageRecords";
import { getAgentAuthNonce, verifyAgentOwner } from "@/lib/api";
import { REGISTRY_CHAIN_ID } from "@/lib/erc8004";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const OWNER_TOKEN_KEY = "ens-kit-owner-token";
const OWNER_ADDR_KEY  = "ens-kit-owner-addr";

type Agent = {
  name: string;
  image: string;
  owner: string;
  registry: string;
  agent_id: string;
  description?: string;
};

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

function ChatInner() {
  const params                         = useSearchParams();
  const registry                       = params.get("registry") ?? "";
  const agentId                        = params.get("agentId") ?? "";
  const { address, isConnected }       = useAccount();
  const { signMessageAsync }           = useSignMessage();
  const { open }                       = useWalletModal();
  const [agent, setAgent]              = useState<Agent | null>(null);
  const [loading, setLoading]          = useState(true);
  const [mounted, setMounted]          = useState(false);
  const [expanded, setExpanded]        = useState(false);
  const [authToken, setAuthToken]      = useState<string | null>(null);
  const [signingIn, setSigningIn]      = useState(false);
  const tr                             = usePageRecords("chat.dinamic.eth");
  const videoUrl                       = tr.video;
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typeof window === "undefined" || !address) return;
    const t = sessionStorage.getItem(OWNER_TOKEN_KEY);
    const a = sessionStorage.getItem(OWNER_ADDR_KEY);
    if (t && a && a === address.toLowerCase()) setAuthToken(t); else setAuthToken(null);
  }, [address]);

  async function signInToChat() {
    if (!address) return;
    setSigningIn(true);
    try {
      const nonce = await getAgentAuthNonce();
      const message = createSiweMessage({
        domain: window.location.host, address: address as Address,
        statement: "Sign in to chat with this agent (uses your wallet credits)",
        uri: window.location.origin, version: "1", chainId: REGISTRY_CHAIN_ID, nonce,
      });
      const signature = await signMessageAsync({ message });
      const result = await verifyAgentOwner(message, signature);
      sessionStorage.setItem(OWNER_TOKEN_KEY, result.token);
      sessionStorage.setItem(OWNER_ADDR_KEY, address.toLowerCase());
      setAuthToken(result.token);
    } catch { /* rejected / verify failed */ }
    finally { setSigningIn(false); }
  }

  useEffect(() => {
    if (!registry || !agentId) return;
    fetch(`${GW_URL}/agent/${registry}/${agentId}`)
      .then(r => r.json())
      .then(d => { setAgent(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [registry, agentId]);

  const isOwner = isConnected && address?.toLowerCase() === agent?.owner?.toLowerCase();

  if (!mounted) return <div className="min-h-screen bg-black" />;

  const cardClass = expanded
    ? "fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl"
    : "relative z-10 flex flex-col rounded-2xl border border-white/10 bg-black/80 overflow-hidden w-full max-w-xl mx-auto";

  const cardHeight = expanded ? "" : "h-[600px]";

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center p-4"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      {/* Background — inherited from chat.dinamic.eth / dinamic.eth text records */}
      {videoUrl ? (
        <>
          <video src={videoUrl} autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover z-0" />
          <div className="fixed inset-0 z-0 bg-black/50" />
        </>
      ) : (
        <GradientBg />
      )}

      <div className={`${cardClass} ${cardHeight}`}>

        {/* Card header */}
        <div className="relative z-10 flex items-center gap-3 px-4 py-3 border-b border-white/8 shrink-0">
          <button
            onClick={() => { if (window.history.length > 1) { window.history.back(); } else { window.location.href = "https://agents.dinamic.eth.limo"; } }}
            className="text-white/40 hover:text-white/70 transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>

          {loading ? (
            <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
          ) : agent ? (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/8 shrink-0">
                {agent.image ? (
                  <img src={agent.image} alt={agent.name} className="w-full h-full object-cover" />
                ) : (
                  <Bot className="w-4 h-4 text-white/30 m-2" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                {agent.description ? (
                  <p className="text-[10px] text-white/35 truncate max-w-[260px]">{agent.description}</p>
                ) : isOwner ? (
                  <p className="text-[10px] text-amber-400">Your agent</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/40 flex-1">Agent not found</p>
          )}

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {isConnected && address ? (
              <span className="inline-flex items-center gap-1.5">
                <CreditsPill address={address} registry={registry} />
                <span className="text-[10px] font-mono text-white/30">{address.slice(0,6)}…{address.slice(-4)}</span>
              </span>
            ) : (
              <button onClick={() => open()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/8 hover:bg-white/12 text-white/60 hover:text-white transition-colors">
                <Wallet className="w-3 h-3" /> Connect
              </button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-white/30 hover:text-white/60 transition-colors p-1"
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Card body */}
        <div className="relative z-10 flex-1 flex flex-col px-4 py-3 min-h-0">
          {!registry || !agentId ? (
            <div className="flex-1 flex items-center justify-center text-white/30 text-sm">No agent specified.</div>
          ) : !agent && !loading ? (
            <div className="flex-1 flex items-center justify-center text-white/30 text-sm">Agent not found.</div>
          ) : !isOwner && isConnected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <Bot className="w-10 h-10 text-white/15" />
              <p className="text-sm text-white/40">This agent belongs to another wallet.</p>
              <p className="text-xs text-white/20 font-mono">{agent?.owner}</p>
            </div>
          ) : !isConnected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
              <Bot className="w-10 h-10 text-white/15" />
              <p className="text-sm text-white/50 max-w-xs">Connect the wallet that owns this agent to chat and approve write actions.</p>
              <button onClick={() => open()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-sm transition-colors">
                <Wallet className="w-4 h-4" /> Connect Wallet
              </button>
            </div>
          ) : authToken ? (
            <AgentChat registry={registry} agentId={agentId} ownerAddress={address} authToken={authToken}
              onCreditError={() => { try { sessionStorage.removeItem(OWNER_TOKEN_KEY); } catch {} setAuthToken(null); }}
              compact={false} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
              <Bot className="w-10 h-10 text-white/15" />
              <p className="text-sm text-white/50 max-w-xs">Sign in to chat — this uses your wallet's AI credits.</p>
              <button onClick={signInToChat} disabled={signingIn}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-sm transition-colors disabled:opacity-50">
                {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                {signingIn ? "Signing in…" : "Sign in to chat"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ChatInner />
    </Suspense>
  );
}
