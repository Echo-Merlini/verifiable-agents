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
import { getAgentAuthNonce, verifyAgentOwner } from "@/lib/api";
import { REGISTRY_CHAIN_ID } from "@/lib/erc8004";
import { DEMO_AGENT } from "@/lib/mcps";

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

function ChatInner() {
  const params                         = useSearchParams();
  const registry                       = params.get("registry") ?? "";
  const agentId                        = params.get("agentId") ?? "";
  // The showcase agent wears the same cover as /demo (overrides its raw on-chain name/image).
  const isDemoAgent = registry.toLowerCase() === DEMO_AGENT.registry.toLowerCase() && agentId === DEMO_AGENT.agentId;
  const { address, isConnected }       = useAccount();
  const { signMessageAsync }           = useSignMessage();
  const { open }                       = useWalletModal();
  const [agent, setAgent]              = useState<Agent | null>(null);
  const [loading, setLoading]          = useState(true);
  const [mounted, setMounted]          = useState(false);
  const [expanded, setExpanded]        = useState(false);
  const [authToken, setAuthToken]      = useState<string | null>(null);
  const [signingIn, setSigningIn]      = useState(false);
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

  if (!mounted) return <div className="min-h-screen bg-deepink" />;

  const cardClass = expanded
    ? "fixed inset-0 z-50 flex flex-col bg-deepink"
    : "relative z-10 flex flex-col liquid-glass rounded-3xl overflow-hidden w-full max-w-xl mx-auto";

  const cardHeight = expanded ? "" : "h-[620px]";

  return (
    <div className="relative min-h-screen bg-deepink text-paper flex flex-col items-center justify-center p-4">
      <div className={`${cardClass} ${cardHeight}`}>

        {/* Card header */}
        <div className="relative z-10 flex items-center gap-3 px-4 py-3 border-b border-white/8 shrink-0">
          <button
            onClick={() => { if (window.history.length > 1) { window.history.back(); } else { window.location.href = "/"; } }}
            className="text-paper/40 hover:text-paper/70 transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>

          {loading ? (
            <Loader2 className="w-4 h-4 text-paper/30 animate-spin" />
          ) : agent ? (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/8 shrink-0">
                {(isDemoAgent ? DEMO_AGENT.image : agent.image) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={isDemoAgent ? DEMO_AGENT.image : agent.image} alt={isDemoAgent ? DEMO_AGENT.name : agent.name} className="w-full h-full object-cover" style={{ imageRendering: "pixelated" }} />
                ) : (
                  <Bot className="w-4 h-4 text-paper/30 m-2" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-display font-medium text-paper truncate">{isDemoAgent ? DEMO_AGENT.name : agent.name}</p>
                {isDemoAgent ? (
                  <p className="text-[10px] text-paper/35 truncate max-w-[260px]">{DEMO_AGENT.ens}</p>
                ) : agent.description ? (
                  <p className="text-[10px] text-paper/35 truncate max-w-[260px]">{agent.description}</p>
                ) : isOwner ? (
                  <p className="text-[10px] text-brassLight">Your agent</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-paper/40 flex-1">Agent not found</p>
          )}

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {isConnected && address ? (
              <span className="inline-flex items-center gap-1.5">
                <CreditsPill address={address} registry={registry} />
                <span className="text-[10px] font-mono text-paper/30">{address.slice(0,6)}…{address.slice(-4)}</span>
              </span>
            ) : (
              <button onClick={() => open()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/8 hover:bg-white/12 text-paper/60 hover:text-paper transition-colors">
                <Wallet className="w-3 h-3" /> Connect
              </button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-paper/30 hover:text-brassLight transition-colors p-1"
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Card body */}
        <div className="relative z-10 flex-1 flex flex-col px-4 py-3 min-h-0">
          {!registry || !agentId ? (
            <div className="flex-1 flex items-center justify-center text-paper/30 text-sm">No agent specified.</div>
          ) : !agent && !loading ? (
            <div className="flex-1 flex items-center justify-center text-paper/30 text-sm">Agent not found.</div>
          ) : !isOwner && isConnected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <Bot className="w-10 h-10 text-paper/15" />
              <p className="text-sm text-paper/40">This agent belongs to another wallet.</p>
              <p className="text-xs text-paper/20 font-mono">{agent?.owner}</p>
            </div>
          ) : !isConnected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
              <Bot className="w-10 h-10 text-paper/15" />
              <p className="text-sm text-paper/50 max-w-xs">Connect the wallet that owns this agent to chat and approve write actions.</p>
              <button onClick={() => open()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brass hover:bg-brassLight text-deepink font-display font-medium text-sm transition-colors">
                <Wallet className="w-4 h-4" /> Connect wallet
              </button>
            </div>
          ) : authToken ? (
            <AgentChat registry={registry} agentId={agentId} ownerAddress={address} authToken={authToken}
              onCreditError={() => { try { sessionStorage.removeItem(OWNER_TOKEN_KEY); } catch {} setAuthToken(null); }}
              compact={false} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
              <Bot className="w-10 h-10 text-paper/15" />
              <p className="text-sm text-paper/50 max-w-xs">Sign in to chat — this uses your wallet&apos;s AI credits.</p>
              <button onClick={signInToChat} disabled={signingIn}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brass hover:bg-brassLight text-deepink font-display font-medium text-sm transition-colors disabled:opacity-50">
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
    <Suspense fallback={<div className="min-h-screen bg-deepink" />}>
      <ChatInner />
    </Suspense>
  );
}
