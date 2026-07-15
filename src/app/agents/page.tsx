"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ArrowRight, Globe, Bot, Shield, Link2, Activity, Wallet, Send, MessageSquare, Share2, Check, ChevronLeft, ChevronRight, Loader2, Settings } from "lucide-react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { type Address } from "viem";
import { useDisplayName } from "@/hooks/useDisplayName";
import { useWalletModal } from "@/hooks/useWalletModal";
import { NavMenu } from "@/components/NavMenu";
import { AgentChat } from "@/components/AgentChat";
import { CreditsPill } from "@/components/CreditsPill";
import { getAgentAuthNonce, verifyAgentOwner } from "@/lib/api";
import { REGISTRY_CHAIN_ID } from "@/lib/erc8004";

const OWNER_TOKEN_KEY = "ens-kit-owner-token";
const OWNER_ADDR_KEY  = "ens-kit-owner-addr";

const GW_URL      = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const ENS_NAME    = process.env.NEXT_PUBLIC_ENS_NAME    || "dinamic.eth";
const PAGE_NAME   = `agents.${ENS_NAME}`;
const AGENTS_PER_PAGE = 5;

type EnsRecord = { text_records: Record<string, string> };

type Service = { name: string; endpoint: string; version?: string };

type Agent = {
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
  active: boolean;
  created_at: number;
  personality_id?: string;
  linked_ens_name?: string | null;
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(ts: number) {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

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

function ServiceBadge({ name }: { name: string }) {
  const upper = name.toUpperCase();

  const logos: Record<string, { src: string; bg: string }> = {
    ENS: { src: "/logos/ens.png",  bg: "bg-amber-400/10 border-amber-400/20" },
    MCP: { src: "/logos/mcp.svg",  bg: "bg-amber-400/10 border-amber-400/20" },
    A2A: { src: "/logos/a2a.svg",  bg: "bg-amber-400/10 border-amber-400/20" },
    GNS: { src: "/logos/gns.webp", bg: "bg-emerald-400/10 border-emerald-400/20" },
  };

  const entry = logos[upper];
  if (entry) {
    return (
      <span className={`px-2 py-1 rounded-full border flex items-center justify-center ${entry.bg}`}>
        <img src={entry.src} alt={upper} className="h-3 w-auto object-contain" />
      </span>
    );
  }

  return (
    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full border bg-white/8 border-white/10 text-white/40">
      {upper}
    </span>
  );
}

// ── ConnectButton ─────────────────────────────────────────────────────────────
function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { open } = useWalletModal();
  const { disconnect } = useDisconnect();
  const displayName = useDisplayName(address);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-9 w-24 rounded-full liquid-glass animate-pulse" />;

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-xs text-white/70 hover:text-white transition-colors"
        title={address}
      >
        <span className="font-mono">{displayName}</span>
      </button>
    );
  }
  return (
    <button
      onClick={() => open()}
      className="liquid-glass-strong rounded-full px-4 py-2 flex items-center gap-2 text-xs font-medium text-white hover:scale-105 active:scale-95 transition-transform"
    >
      <Wallet className="w-3.5 h-3.5" />
      <span>Connect</span>
    </button>
  );
}

// ── Share button ──────────────────────────────────────────────────────────────
function ShareBtn({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const url = `${GW_URL}/agent/${agent.registry}/${agent.agent_id}`;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClick = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: agent.name, text: agent.description || agent.name, url });
        return;
      } catch {}
    }
    setOpen(p => !p);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("input");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
  };

  const shareOnX = () => {
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(agent.name)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleClick}
        className="p-1 rounded hover:bg-white/10 transition-colors text-white/30 hover:text-white/70"
        title="Share agent"
      >
        <Share2 className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-52 liquid-glass-strong rounded-2xl p-3 flex flex-col gap-1.5 z-50 shadow-xl">
          {/* Agent preview */}
          <div className="flex items-center gap-2 pb-2 mb-0.5 border-b border-white/8">
            {agent.image ? (
              <img src={agent.image} alt={agent.name} className="w-8 h-8 rounded-xl object-cover ring-1 ring-white/15 shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-white/40" />
              </div>
            )}
            <p className="text-xs font-medium text-white leading-tight truncate">{agent.name}</p>
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 text-xs text-white/60 hover:text-white hover:bg-white/8 rounded-xl px-2 py-1.5 transition-colors text-left w-full"
          >
            {copied
              ? <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
              : <Link2 className="w-3.5 h-3.5 shrink-0" />}
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            onClick={shareOnX}
            className="flex items-center gap-2 text-xs text-white/60 hover:text-white hover:bg-white/8 rounded-xl px-2 py-1.5 transition-colors text-left w-full"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </button>
        </div>
      )}
    </div>
  );
}

// ── Owner name (resolves ENS / subdomain) ────────────────────────────────────
function OwnerName({ address }: { address: string }) {
  const name = useDisplayName(address);
  return (
    <span className="font-mono text-[10px] text-white/25 truncate max-w-[100px]" title={address}>
      {name}
    </span>
  );
}

// ── Agent card ────────────────────────────────────────────────────────────────
function AgentCard({ agent, isOwn = false, isPfpActive = false, onTogglePfp }: { agent: Agent; isOwn?: boolean; isPfpActive?: boolean; onTogglePfp?: () => void }) {
  const [chatOpen, setChatOpen] = useState(false);
  const serviceNames = agent.services.map(s => s.name);

  // Chat spends the connected wallet's credits — needs a signed-in JWT (cached
  // in sessionStorage by any sign-in on the site, else obtained here on demand).
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

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
    } catch { /* user rejected or verify failed */ }
    finally { setSigningIn(false); }
  }

  return (
    <div className={`liquid-glass-strong rounded-3xl p-5 flex flex-col gap-3 transition-colors ${
      isOwn ? "ring-1 ring-amber-400/30 bg-amber-500/5" : "hover:bg-white/5"
    }`}>
      {/* Avatar + badges */}
      <div className="flex items-start justify-between">
        <div className="relative">
          {agent.image ? (
            <img src={agent.image} alt={agent.name} className="w-12 h-12 rounded-2xl object-cover ring-1 ring-white/15" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white/40" />
            </div>
          )}
          {agent.active && (
            <span className="absolute -bottom-1 -right-1"><LiveDot /></span>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {isOwn && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full border bg-amber-400/10 border-amber-400/20 text-amber-300">
              Owned
            </span>
          )}
          {isOwn && <CreditsPill address={address} registry={agent.registry} />}
          {agent.linked_ens_name && (
            <span title={agent.linked_ens_name}>
              <ServiceBadge name={agent.linked_ens_name.endsWith(`.${ENS_NAME}`) ? "GNS" : "ENS"} />
            </span>
          )}
          {serviceNames.map(s => <ServiceBadge key={s} name={s} />)}
        </div>
      </div>

      {/* Name + description */}
      <div>
        <p className="text-sm font-medium text-white leading-tight">{agent.name || `Agent #${agent.agent_id}`}</p>
        {agent.description && (
          <p className="text-xs text-white/40 mt-0.5 leading-relaxed line-clamp-2">{agent.description}</p>
        )}
      </div>

      {/* Source NFT */}
      <div className="flex items-center gap-1.5">
        <Link2 className="w-3 h-3 text-white/25 shrink-0" />
        <span className="font-mono text-[10px] text-white/30 truncate">
          {shortAddr(agent.source_contract)} #{agent.source_token_id}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-white/6">
        <div className="flex items-center gap-1.5 min-w-0">
          <OwnerName address={agent.owner_address} />
          <ShareBtn agent={agent} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwn && (
            <a href="/my-agents/" title="Manage agent — personality, endpoints, credits"
              className="text-white/30 hover:text-amber-300 transition-colors">
              <Settings className="w-3.5 h-3.5" />
            </a>
          )}
          {isOwn && agent.image && (
            <button
              onClick={onTogglePfp}
              className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 transition-colors"
              title={isPfpActive ? "Remove from hero" : "Set as hero PFP"}
            >
              <div className={`w-7 h-3.5 rounded-full transition-colors flex items-center px-0.5 ${isPfpActive ? "bg-amber-500/50" : "bg-white/10"}`}>
                <div className={`w-2.5 h-2.5 rounded-full bg-white transition-transform duration-200 ${isPfpActive ? "translate-x-3.5" : ""}`} />
              </div>
              <span>PFP</span>
            </button>
          )}
          {isOwn ? (
            <button
              onClick={() => setChatOpen(p => !p)}
              className="flex items-center gap-1.5 text-[10px] text-amber-300/60 hover:text-amber-300 transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              <span>{chatOpen ? "close" : "chat"}</span>
            </button>
          ) : (
            <span className="text-[10px] text-white/20">{timeAgo(agent.created_at)}</span>
          )}
        </div>
      </div>

      {/* Inline chat — own agent only */}
      {isOwn && chatOpen && (authToken
        ? <AgentChat registry={agent.registry} agentId={agent.agent_id} ownerAddress={agent.owner_address} authToken={authToken}
            onCreditError={() => { try { sessionStorage.removeItem(OWNER_TOKEN_KEY); } catch {} setAuthToken(null); }}
            compact={true} />
        : (
          <button onClick={signInToChat} disabled={signingIn}
            className="mt-2 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm inline-flex items-center justify-center gap-2">
            {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            {signingIn ? "Signing in…" : "Sign in to chat (uses your wallet credits)"}
          </button>
        )
      )}
    </div>
  );
}

function AgentCardSkeleton() {
  return (
    <div className="liquid-glass rounded-3xl p-5 flex flex-col gap-3">
      <div className="w-12 h-12 rounded-2xl bg-white/5 animate-pulse" />
      <div className="space-y-1.5">
        <div className="h-3.5 w-2/3 rounded-full bg-white/5 animate-pulse" />
        <div className="h-2.5 w-full rounded-full bg-white/4 animate-pulse" />
      </div>
      <div className="h-2 w-1/2 rounded-full bg-white/4 animate-pulse" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const [agents, setAgents]   = useState<Agent[] | null>(null);
  const [error, setError]     = useState(false);
  const [myAgents, setMyAgents]           = useState<Agent[]>([]);
  const [featuredPfpKey, setFeaturedPfpKey] = useState<string | null>(null);
  const [tr, setTr]           = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(0);

  const { address, isConnected } = useAccount();

  // Fetch ENS text records (page-level, inherited from parent)
  useEffect(() => {
    async function load() {
      try {
        const [pageRes, parentRes] = await Promise.all([
          fetch(`${GW_URL}/record/${encodeURIComponent(PAGE_NAME)}`),
          fetch(`${GW_URL}/record/${encodeURIComponent(ENS_NAME)}`),
        ]);
        const page   = pageRes.ok   ? await pageRes.json()   : { text_records: {} };
        const parent = parentRes.ok ? await parentRes.json() : { text_records: {} };
        setTr({ ...parent.text_records, ...page.text_records });
      } catch {}
    }
    load();
  }, []);

  // Set favicon from icon record
  useEffect(() => {
    const icon = tr.icon;
    if (!icon) return;
    document.querySelectorAll("link[rel=\'icon\'], link[rel=\'shortcut icon\']").forEach(el => el.remove());
    const link = document.createElement("link");
    link.rel   = "icon";
    link.type  = icon.includes("svg") ? "image/svg+xml" : "image/png";
    link.href  = icon;
    document.head.appendChild(link);
  }, [tr.icon]);

  const fetchAgents = useCallback(async () => {
    try {
      const r = await fetch(`${GW_URL}/agent`);
      if (!r.ok) { setError(true); return; }
      const data = await r.json();
      setAgents(prev => {
        if (prev?.length !== data.length) setCurrentPage(0);
        return data;
      });
      setError(false);
    } catch { setError(true); }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);
  useEffect(() => {
    const t = setInterval(() => fetchAgents(), 10000);
    return () => clearInterval(t);
  }, [fetchAgents]);

  // Load connected wallet's agents
  useEffect(() => {
    if (!isConnected || !address) { setMyAgents([]); setFeaturedPfpKey(null); return; }
    fetch(`${GW_URL}/agent/owned/${address.toLowerCase()}`)
      .then(r => r.ok ? r.json() : [])
      .then((list: Agent[]) => {
        setMyAgents(list);
        if (list.length > 0) setFeaturedPfpKey(k => k ?? `${list[0].registry}-${list[0].agent_id}`);
      })
      .catch(() => setMyAgents([]));
  }, [address, isConnected]);

  const total        = agents?.length ?? 0;
  const active       = agents?.filter(a => a.active).length ?? 0;
  const myAgentKeys  = new Set(myAgents.map(a => `${a.registry}-${a.agent_id}`));

  const sortedAgents = agents
    ? [...agents].sort((a, b) => {
        const aOwn = myAgentKeys.has(`${a.registry}-${a.agent_id}`) ? 0 : 1;
        const bOwn = myAgentKeys.has(`${b.registry}-${b.agent_id}`) ? 0 : 1;
        return aOwn - bOwn;
      })
    : [];
  const totalPages    = sortedAgents.length ? Math.ceil(sortedAgents.length / AGENTS_PER_PAGE) : 0;
  const safePage      = Math.min(currentPage, Math.max(0, totalPages - 1));
  const visibleAgents = sortedAgents.slice(safePage * AGENTS_PER_PAGE, (safePage + 1) * AGENTS_PER_PAGE);
  const featuredAgent = myAgents.find(a => `${a.registry}-${a.agent_id}` === featuredPfpKey) ?? null;

  const icon    = tr.icon;
  const avatar  = tr.avatar;
  const cardBg  = tr.card_bg;
  const videoUrl = tr.video;
  const media   = tr.media;

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col font-display">
      <NavMenu currentPath="agents" />


      {/* ── Background ─────────────────────────────────── */}
      {videoUrl ? (
        <>
          <video src={videoUrl} autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover z-0" />
          <div className="fixed inset-0 z-0 bg-black/50" />
        </>
      ) : (
        <GradientBg />
      )}

      {/* ── Hero header ────────────────────────────────── */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center pt-16 pb-10 px-6 text-center">
        <h1 className="text-6xl lg:text-8xl font-medium tracking-[-0.05em] text-white leading-none mb-5">
          agents<em className="font-serif not-italic text-white/60">.dinamic.eth</em>
        </h1>
        <p className="text-sm lg:text-base text-white/40 font-light max-w-lg leading-relaxed">
          On-chain agent identities bound to NFT collections —<br className="hidden sm:block" />
          trustlessly registered, ENS-discoverable, zero custody.
        </p>

        {/* CTA strip */}
        <div className="mt-8 w-full liquid-glass-strong rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-sm font-medium text-white mb-0.5">Ready to register your agent?</p>
            <p className="text-xs text-white/40">Hold an NFT from an onboarded collection — bridge it in under a minute.</p>
          </div>
          <a
            href="../agent/"
            className="shrink-0 liquid-glass-strong rounded-full px-6 py-2.5 flex items-center gap-2.5 text-sm font-medium text-white hover:scale-105 active:scale-95 transition-transform"
          >
            <span>Open Bridge</span>
            <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center">
              <ArrowRight className="w-3 h-3" />
            </div>
          </a>
        </div>
      </div>

      {/* ── Panels row ─────────────────────────────────── */}
      <div className="relative z-10 flex flex-col lg:flex-row flex-1">

        {/* ── Left Panel ─────────────────────────────────── */}
        <div className="w-full lg:w-[52%] flex flex-col lg:min-h-screen p-4 lg:p-6">
          <div
            className="liquid-glass-strong rounded-3xl flex flex-col lg:flex-1 p-6 lg:p-8 relative overflow-hidden"
            style={cardBg ? { backgroundImage: `url(${cardBg})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            {cardBg && <div className="absolute inset-0 rounded-3xl bg-black/40 backdrop-blur-sm z-0" />}
            <div className="relative z-10 flex flex-col lg:flex-1">

            {/* Nav */}
            <nav className="flex items-center justify-between mb-auto">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center overflow-hidden">
                  {icon ? (
                    <img src={icon} alt="icon" className="w-6 h-6 object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display="none"; }} />
                  ) : (
                    <Bot className="w-4 h-4 text-white/70" />
                  )}
                </div>
                <span className="text-xl font-semibold tracking-tight text-white">Agent Registry</span>
              </div>
              <div className="flex items-center gap-2">
                <ConnectButton />
                <div className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2">
                  <LiveDot />
                  <span className="text-xs text-white/70 font-medium">Live</span>
                </div>
              </div>
            </nav>

            {/* Hero content */}
            <div className="flex flex-col items-start lg:justify-center lg:flex-1 py-8 lg:py-12">

              {/* Icon — shows featured agent PFP, then ENS avatar, then Bot placeholder */}
              <div className="w-16 h-16 rounded-3xl bg-white/8 border border-white/10 flex items-center justify-center overflow-hidden mb-6">
                {featuredAgent?.image ? (
                  <img src={featuredAgent.image} alt={featuredAgent.name} className="w-full h-full object-cover" />
                ) : avatar ? (
                  <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <Bot className="w-7 h-7 text-white/50" />
                )}
              </div>

              <h2 className="text-5xl lg:text-6xl font-medium tracking-[-0.05em] text-white leading-none mb-4">
                agents<br />
                <em className="font-serif text-white/50 not-italic">.dinamic.eth</em>
              </h2>

              <p className="text-white/60 text-base font-light max-w-sm mt-2 mb-8 leading-relaxed">
                NFT holders bridge their collection into a trustless on-chain agent identity.
                Each agent is an ERC-721 NFT with a portable registration file, verifiable services,
                and a bidirectional ENS link via ENSIP-25.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3 mb-8">
                <a
                  href="../agent/"
                  className="liquid-glass-strong rounded-full px-6 py-3 flex items-center gap-3 text-sm font-medium text-white hover:scale-105 active:scale-95 transition-transform"
                >
                  <span>Bridge Your NFT</span>
                  <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </a>
                <a
                  href="../my-agents/"
                  className="liquid-glass rounded-full px-5 py-3 flex items-center gap-2 text-sm text-white/70 hover:text-white hover:scale-105 active:scale-95 transition-all"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Manage Your Agent</span>
                </a>
                <a
                  href="../use-agent/"
                  className="liquid-glass rounded-full px-5 py-3 flex items-center gap-2 text-sm text-white/70 hover:text-white hover:scale-105 active:scale-95 transition-all"
                >
                  <span>Use Your Agent</span>
                </a>
                <a
                  href="https://eips.ethereum.org/EIPS/eip-8004"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="liquid-glass rounded-full px-5 py-3 flex items-center gap-2 text-sm text-white/70 hover:scale-105 active:scale-95 transition-transform"
                >
                  <span>ERC-8004 spec</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                <div className="liquid-glass rounded-full px-4 py-1.5 text-xs text-white/80">ERC-8004</div>
                <div className="liquid-glass rounded-full px-4 py-1.5 text-xs text-white/80">ENSIP-25</div>
                <div className="liquid-glass rounded-full px-4 py-1.5 text-xs text-white/80">ERC-7930</div>
                <div className="liquid-glass rounded-full px-4 py-1.5 text-xs text-white/80">Non-custodial</div>
                <div className="liquid-glass rounded-full px-4 py-1.5 text-xs text-white/80">EIP-712 verified</div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-6">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs tracking-widest uppercase text-white/30">Trustless Agent Registry</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            </div>
            </div>{/* /relative z-10 wrapper */}
          </div>
        </div>

        {/* ── Right Panel ─────────────────────────────────── */}
        <div className="flex flex-col w-full lg:w-[48%] p-4 pt-0 pb-8 lg:p-6 lg:pl-0 lg:pb-6 gap-4">

          {/* Top bar */}
          <div className="liquid-glass rounded-2xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LiveDot />
              <span className="text-xs text-white/60">Agents indexed from gateway</span>
            </div>
            <div className="liquid-glass rounded-full px-3 py-1.5 text-[10px] text-white/50 font-mono">
              {GW_URL.replace("https://", "")}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="liquid-glass rounded-2xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white/70" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/50 mb-0.5">Registered</p>
                <p className="text-sm text-white font-medium">
                  {agents === null ? "—" : `${total} agent${total !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <div className="liquid-glass rounded-2xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-white/70" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/50 mb-0.5">Active</p>
                <p className="text-sm text-white font-medium">
                  {agents === null ? "—" : `${active} online`}
                </p>
              </div>
            </div>
          </div>

          {/* Agents list */}
          <div className="liquid-glass-strong rounded-[2.5rem] lg:flex-1 p-6 flex flex-col gap-4 overflow-auto">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Registered Agents</p>

            {error ? (
              <p className="text-white/30 text-sm">Gateway unreachable</p>
            ) : agents === null ? (
              <div className="grid grid-cols-1 gap-3">
                {[...Array(3)].map((_, i) => <AgentCardSkeleton key={i} />)}
              </div>
            ) : agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white/20" />
                </div>
                <p className="text-white/30 text-sm">No agents registered yet.</p>
                <a
                  href="../agent/"
                  className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors"
                >
                  Be the first — bridge your NFT →
                </a>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3">
                  {visibleAgents.map(agent => {
                    const key = `${agent.registry}-${agent.agent_id}`;
                    const isOwn = myAgentKeys.has(key);
                    return (
                      <AgentCard
                        key={key}
                        agent={agent}
                        isOwn={isOwn}
                        isPfpActive={isOwn && featuredPfpKey === key}
                        onTogglePfp={() => setFeaturedPfpKey(p => p === key ? null : key)}
                      />
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-white/50 hover:text-white/80 disabled:opacity-20 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Prev
                    </button>
                    <span className="text-[10px] text-white/30 tabular-nums">
                      {safePage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-white/50 hover:text-white/80 disabled:opacity-20 transition-colors"
                    >
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom bar */}
          <div className="liquid-glass rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-white/40 uppercase tracking-widest">Name</span>
            <span className="font-mono text-xs text-white/70">agents.dinamic.eth</span>
            <span className="text-[10px] text-white/30">polls every 10s</span>
          </div>
        </div>
      </div>

      {/* ── Feature cards ──────────────────────────────── */}
      <div className="relative z-10 w-full px-4 lg:px-6 pb-10 lg:pb-12">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-[10px] uppercase tracking-widest text-white/30">How it works</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="liquid-glass-strong rounded-3xl p-6 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-white/70" />
            </div>
            <h3 className="text-sm font-medium text-white">Bridge your NFT</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Hold an NFT from an onboarded collection. Call <span className="font-mono text-white/40">registerWithSource</span> — no lock, no transfer. Ownership is checked live at mint time.
            </p>
          </div>

          <div className="liquid-glass-strong rounded-3xl p-6 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white/70" />
            </div>
            <h3 className="text-sm font-medium text-white">Agent identity NFT</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Minting issues an ERC-721 agent identity on-chain. The token URI resolves to a portable registration file declaring your agent's services and endpoints.
            </p>
          </div>

          <div className="liquid-glass-strong rounded-3xl p-6 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-white/70" />
            </div>
            <h3 className="text-sm font-medium text-white">ENS verified via ENSIP-25</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Link your agent to any ENS name with a single <span className="font-mono text-white/40">setText</span> call. The key encodes your registry as an ERC-7930 interoperable address — trustless, bidirectional.
            </p>
          </div>

          <div className="liquid-glass-strong rounded-3xl p-6 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white/70" />
            </div>
            <h3 className="text-sm font-medium text-white">Non-custodial</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              The factory is <span className="font-mono text-white/40">Ownable2Step</span>. Agent wallets use EIP-712 signatures with IERC1271 smart wallet support. Your keys, your agent.
            </p>
          </div>
        </div>

        {/* Under the hood */}
        <div className="mt-6 mb-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-[10px] uppercase tracking-widest text-white/30">Under the hood</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="liquid-glass rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-white/8 text-white/40">ERC-8004</span>
              <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-white/8 text-white/40">ERC-721</span>
            </div>
            <h3 className="text-sm font-medium text-white">Trustless Agent Registry</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              One <span className="font-mono text-white/60">AgentIdentityRegistryFactory</span> deploys a per-collection registry. Each registry is an ERC-721 contract — agent identities are owned, transferable NFTs. The token URI resolves to an ERC-8004 registration JSON declaring the agent's name, description, services (MCP, A2A), and its source NFT link. Services are agnostic to the underlying AI stack — any endpoint can be declared.
            </p>
            <div className="font-mono text-[10px] text-white/25 leading-relaxed border-l border-white/10 pl-3">
              factory.deployRegistry(collection, cfg)<br />
              registry.registerWithSource(tokenId)<br />
              tokenURI → ERC-8004 registration JSON
            </div>
          </div>

          <div className="liquid-glass rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-white/8 text-white/40">ENSIP-25</span>
              <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-white/8 text-white/40">ERC-7930</span>
            </div>
            <h3 className="text-sm font-medium text-white">Bidirectional ENS ↔ Agent linking</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              ENSIP-25 defines a text record convention that links an ENS name to an on-chain agent identity. The key encodes the registry address as an ERC-7930 interoperable binary address — chain type, chain ID, and EVM address packed into a single compact hex string. Any ENS resolver that reads text records can verify the link without trusting a third party. The gateway at <span className="font-mono text-white/60">agents.dinamic.eth</span> serves this page as the canonical landing for the registry.
            </p>
            <div className="font-mono text-[10px] text-white/25 leading-relaxed border-l border-white/10 pl-3">
              key: agent-registration[&lt;ERC-7930&gt;][&lt;agentId&gt;]<br />
              value: &lt;ens-name&gt;<br />
              setText(node, key, value)
            </div>
          </div>
        </div>

        {/* Service types */}
        <div className="mt-6 mb-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-[10px] uppercase tracking-widest text-white/30">Supported service types</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="liquid-glass rounded-3xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1.5 rounded-full border bg-amber-400/10 border-amber-400/20 flex items-center justify-center"><img src="/logos/mcp.svg" alt="MCP" className="h-3.5 w-auto object-contain" style={{filter:"invert(1) sepia(1) saturate(5) hue-rotate(220deg) brightness(1.2)"}} /></span>
              <span className="text-xs text-white/50">Model Context Protocol</span>
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              Anthropic's open protocol for connecting AI models to external tools and data sources. Agents that expose MCP endpoints can be plugged into Claude, Cursor, and any MCP-compatible host.
            </p>
          </div>
          <div className="liquid-glass rounded-3xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1.5 rounded-full border bg-amber-400/10 border-amber-400/20 flex items-center justify-center"><img src="/logos/a2a.svg" alt="A2A" className="h-3.5 w-auto object-contain" style={{filter:"invert(1) sepia(1) saturate(3) hue-rotate(180deg) brightness(1.3)"}} /></span>
              <span className="text-xs text-white/50">Agent-to-Agent</span>
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              Google's Agent-to-Agent protocol for structured inter-agent communication. Enables autonomous multi-agent workflows without a human in the loop at each step.
            </p>
          </div>
          <div className="liquid-glass rounded-3xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1.5 rounded-full border bg-amber-400/10 border-amber-400/20 flex items-center justify-center"><img src="/logos/ens.png" alt="ENS" className="h-3.5 w-auto object-contain" /></span>
              <span className="text-xs text-white/50">ENS Name</span>
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              A linked ENS name for the agent — human-readable, CCIP-Read resolvable. Set via ENSIP-25 text record. Allows agents to be discovered by name, not just registry address.
            </p>
          </div>
        </div>


      </div>
    </div>
  );
}
