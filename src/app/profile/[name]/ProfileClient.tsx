"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Globe, Bot, Copy, Check, ExternalLink, Pencil, ChevronLeft, ChevronRight, MessageSquare, Wallet, Share2 } from "lucide-react";
import { NavMenu } from "@/components/NavMenu";
import { useAccount, useDisconnect } from "wagmi";
import { useWalletModal } from "@/hooks/useWalletModal";
import { usePageRecords } from "@/hooks/usePageRecords";

const GW_URL    = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const ENS_NAME  = process.env.NEXT_PUBLIC_ENS_NAME   || "dinamic.eth";
const CHAT_BASE = process.env.NEXT_PUBLIC_CHAT_BASE  || "https://chat.dinamic.eth.limo";

type Service = { name: string; endpoint: string; version?: string };
type Agent = {
  registry: string; agent_id: string; owner_address: string;
  name: string; description: string; image: string;
  services: Service[]; active: boolean; personality_id?: string;
  linked_ens_name?: string | null;
};

// Generic "has tools" indicator. The specific per-agent tool list is owner-only
// (gateway gates /mcp-assignments behind the edit JWT); publicly we only surface
// whether the agent has any tools, never which — that list is an attack surface.
function ToolPills({ registry, agentId }: { registry: string; agentId: string }) {
  const [hasMcps, setHasMcps] = useState(false);

  useEffect(() => {
    fetch(`${GW_URL}/agent/${registry}/${agentId}/has-mcps`)
      .then(r => r.json())
      .then(d => setHasMcps(Boolean(d.has_mcps)))
      .catch(() => setHasMcps(false));
  }, [registry, agentId]);

  if (!hasMcps) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      <span
        title="This agent has connected MCP tools"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border text-amber-400/90 bg-amber-400/10 border-amber-400/20"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
        MCP tools
      </span>
    </div>
  );
}

function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }

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

function IconX() {
  return <svg className="w-3.5 h-3.5 text-white/50" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
}
function IconGitHub() {
  return <svg className="w-3.5 h-3.5 text-white/50" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>;
}
function IconTelegram() {
  return <svg className="w-3.5 h-3.5 text-white/50" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard.writeText(text); } catch {
      const el = document.createElement("input"); el.value = text;
      document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-white/30 hover:text-white/70 transition-colors">
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function ShareBtn({ url, title }: { url: string; title: string }) {
  const [shared, setShared] = useState(false);
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); } catch {
        const el = document.createElement("input"); el.value = url;
        document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el);
      }
      setShared(true); setTimeout(() => setShared(false), 2000);
    }
  };
  return (
    <button onClick={share} title="Share profile" className="text-white/30 hover:text-white/70 transition-colors">
      {shared ? <Check className="w-3 h-3 text-green-400" /> : <Share2 className="w-3 h-3" />}
    </button>
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
  if (entry) return (
    <span className={`px-2 py-1 rounded-full border flex items-center justify-center ${entry.bg}`}>
      <img src={entry.src} alt={upper} className="h-3 w-auto object-contain" />
    </span>
  );
  return <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full border bg-white/8 border-white/10 text-white/40">{upper}</span>;
}

function AgentCard({ agent, isOwner }: { agent: Agent; isOwner: boolean }) {
  return (
    <div className="liquid-glass-strong rounded-3xl p-5 flex flex-col gap-3">
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
          {agent.linked_ens_name && (
            <span title={agent.linked_ens_name}>
              <ServiceBadge name={agent.linked_ens_name.endsWith(`.${ENS_NAME}`) ? "GNS" : "ENS"} />
            </span>
          )}
          {agent.services.map(s => <ServiceBadge key={s.name} name={s.name} />)}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-white leading-tight">{agent.name || `Agent #${agent.agent_id}`}</p>
        {agent.description && (
          <p className="text-xs text-white/40 mt-0.5 leading-relaxed line-clamp-3">{agent.description}</p>
        )}
        <ToolPills registry={agent.registry} agentId={agent.agent_id} />
      </div>
      <div className="flex items-center gap-3 mt-auto">
        {isOwner && (
          <a
            href={`${CHAT_BASE}/?registry=${agent.registry}&agentId=${agent.agent_id}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] text-emerald-400/80 hover:text-emerald-400 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Chat</span>
          </a>
        )}
        <a
          href={`https://dinamic.eth.limo/use-agent/?agent=${agent.agent_id}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[10px] text-amber-300/80 hover:text-amber-300 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Use Agent</span>
        </a>
        <a
          href={`${GW_URL}/agent/${agent.registry}/${agent.agent_id}`}
          target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-white/25 hover:text-white/50 transition-colors"
        >
          ERC-8004
        </a>
      </div>
    </div>
  );
}

export default function ProfileClient({ name }: { name: string }) {
  const embedded = typeof window !== "undefined" ? (window as any).__PROFILE__ as Record<string, string> | null : null;
  const detectedLabel = typeof window !== "undefined"
    ? window.location.hostname.replace(`.${ENS_NAME}.limo`, "").replace(`.${ENS_NAME}`, "").split(".")[0]
    : "";
  const label   = (!name || name === "_") ? (embedded?.label ?? detectedLabel) : (name ?? "");
  const ensName = label ? `${label}.${ENS_NAME}` : ENS_NAME;

  const tr = usePageRecords(ensName);
  const [parentIcon, setParentIcon] = useState("");
  const { address: connectedAddress } = useAccount();
  const { open } = useWalletModal();
  const { disconnect } = useDisconnect();

  const [record, setRecord]     = useState<{ address?: string } | null>(
    embedded?.address ? { address: embedded.address } : null
  );
  const [agents, setAgents]     = useState<Agent[] | null>(null);
  const [agentPage, setAgentPage] = useState(0);
  const [notFound, setNotFound] = useState(false);

  const AGENTS_PER_PAGE = 5;


  useEffect(() => {
    fetch(`${GW_URL}/record/${encodeURIComponent(ENS_NAME)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.text_records?.icon) setParentIcon(d.text_records.icon); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!label || embedded) return;
    fetch(`${GW_URL}/record/${encodeURIComponent(ensName)}`)
      .then(r => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
      .then(d => { if (d) setRecord(d); })
      .catch(() => setNotFound(true));
  }, [ensName, label]);

  useEffect(() => {
    const addr = record?.address;
    if (!addr) { setAgents([]); return; }
    fetch(`${GW_URL}/agent/owned/${addr.toLowerCase()}`)
      .then(r => r.ok ? r.json() : [])
      .then((list: Agent[]) => setAgents(list))
      .catch(() => setAgents([]));
  }, [record?.address]);

  const isProfileOwner = connectedAddress && record?.address && connectedAddress.toLowerCase() === record.address.toLowerCase();
  const icon    = parentIcon || tr.icon;
  const avatar  = tr.avatar;
  const cardBg  = tr.card_bg;
  const videoUrl = tr.video;
  const desc    = tr.description || "";
  const url     = tr.url;
  const twitter = tr["com.twitter"] || tr["twitter"];
  const github  = tr["com.github"]  || tr["github"];
  const telegram = tr["telegram"];
  const badge   = tr["badge"];
  const pfpButtonRaw    = tr["pfp_button"];
  const pfpButtonUrl    = pfpButtonRaw?.includes("|") ? pfpButtonRaw.split("|").slice(1).join("|") : pfpButtonRaw;
  const pfpButtonLabel  = pfpButtonRaw?.includes("|") ? pfpButtonRaw.split("|")[0] : "Visit";
  const pfpButton2Raw   = tr["pfp_button_2"];
  const pfpButton2Url   = pfpButton2Raw?.includes("|") ? pfpButton2Raw.split("|").slice(1).join("|") : pfpButton2Raw;
  const pfpButton2Label = pfpButton2Raw?.includes("|") ? pfpButton2Raw.split("|")[0] : "More";

  const twitterHandle  = twitter?.replace(/https?:\/\/(www\.)?(twitter|x)\.com\/?@?/, "").replace(/^@/, "");
  const githubHandle   = github?.replace(/https?:\/\/(www\.)?github\.com\/?/, "").replace(/^\//, "");
  const telegramHandle = telegram?.replace(/https?:\/\/(www\.)?t\.me\/?/, "").replace(/^@/, "");

  if (notFound) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 font-display">
      <GradientBg />
      <div className="relative z-10 text-center">
        <p className="text-white/40 text-lg mb-2">Profile not found</p>
        <p className="text-white/25 text-sm font-mono">{ensName}</p>
        <a href="/" className="mt-6 inline-block text-xs text-white/40 hover:text-white/70 transition-colors">← Back</a>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col font-display">
      <NavMenu baseUrl={`https://${ENS_NAME}.limo`} />

      {/* Background */}
      {videoUrl ? (
        <>
          <video src={videoUrl} autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover z-0" />
          <div className="fixed inset-0 z-0 bg-black/50" />
        </>
      ) : <GradientBg />}

      {/* Panels */}
      <div className="relative z-10 flex flex-col lg:flex-row flex-1 min-h-screen">

        {/* ── Left Panel ── */}
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
                      <img src={icon} alt="icon" className="w-6 h-6 object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : <Globe className="w-4 h-4 text-white/70" />}
                  </div>
                  <span className="text-sm font-medium text-white/60 font-mono">{ENS_NAME}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isProfileOwner && (
                    <a
                      href="https://dinamic.eth.limo/profile-edit"
                      className="liquid-glass rounded-full px-3 py-2 flex items-center gap-1.5 text-xs text-white/60 hover:text-white/90 transition-colors"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </a>
                  )}
                  {connectedAddress ? (
                    <button
                      onClick={() => disconnect()}
                      className="liquid-glass rounded-full px-3 py-2 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                      title="Disconnect wallet"
                    >
                      <Wallet className="w-3 h-3" />
                      {connectedAddress.slice(0, 4)}…{connectedAddress.slice(-3)}
                    </button>
                  ) : (
                    <button
                      onClick={() => open()}
                      className="liquid-glass rounded-full px-3 py-2 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                    >
                      <Wallet className="w-3 h-3" /> Connect
                    </button>
                  )}

                  <div className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2">
                    <LiveDot />
                    <span className="text-xs text-white/70 font-medium">Live</span>
                  </div>
                </div>
              </nav>

              {/* Hero */}
              <div className="flex flex-col items-start lg:justify-center lg:flex-1 py-8 lg:py-12">

                <div className="relative mb-6 w-fit">
                  {avatar ? (
                    <img src={avatar} alt={ensName} className="w-20 h-20 rounded-full object-cover ring-1 ring-white/20" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center ring-1 ring-white/10">
                      <Globe className="w-8 h-8 text-white/40" />
                    </div>
                  )}
                  {badge && (
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap liquid-glass rounded-full px-2 py-0.5 text-[10px] text-white/70">
                      {badge}
                    </span>
                  )}
                </div>

                <h2 className="text-5xl lg:text-7xl font-medium tracking-[-0.05em] text-white leading-none mb-4">
                  {label}
                  <br />
                  <em className="font-serif text-white/50 not-italic">.{ENS_NAME}</em>
                </h2>

                {desc && <p className="text-white/60 text-base font-light max-w-sm mt-2 mb-8 leading-relaxed">{desc}</p>}

                <div className="flex flex-wrap items-center gap-3 mb-8">
                  {pfpButtonUrl ? (
                    <a href={pfpButtonUrl} target="_blank" rel="noopener noreferrer"
                      className="liquid-glass-strong rounded-full px-6 py-3 flex items-center gap-3 text-sm font-medium text-white hover:scale-105 active:scale-95 transition-transform">
                      <span>{pfpButtonLabel}</span>
                      <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center"><ArrowRight className="w-4 h-4" /></div>
                    </a>
                  ) : url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="liquid-glass-strong rounded-full px-6 py-3 flex items-center gap-3 text-sm font-medium text-white hover:scale-105 active:scale-95 transition-transform">
                      <span>Visit Site</span>
                      <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center"><ArrowRight className="w-4 h-4" /></div>
                    </a>
                  ) : null}
                  {pfpButton2Url && (
                    <a href={pfpButton2Url} target="_blank" rel="noopener noreferrer"
                      className="liquid-glass rounded-full px-5 py-3 flex items-center gap-2 text-sm text-white/80 hover:scale-105 active:scale-95 transition-transform">
                      <span>{pfpButton2Label}</span><ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {twitterHandle && (
                    <a href={`https://x.com/${twitterHandle}`} target="_blank" rel="noopener noreferrer"
                      className="liquid-glass rounded-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-white/10 transition-colors">
                      <IconX /><span className="text-xs text-white/60">@{twitterHandle}</span>
                    </a>
                  )}
                  {githubHandle && (
                    <a href={`https://github.com/${githubHandle}`} target="_blank" rel="noopener noreferrer"
                      className="liquid-glass rounded-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-white/10 transition-colors">
                      <IconGitHub /><span className="text-xs text-white/60">{githubHandle}</span>
                    </a>
                  )}
                  {telegramHandle && (
                    <a href={`https://t.me/${telegramHandle}`} target="_blank" rel="noopener noreferrer"
                      className="liquid-glass rounded-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-white/10 transition-colors">
                      <IconTelegram /><span className="text-xs text-white/60">@{telegramHandle}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-auto pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  {record?.address ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white/40">{shortAddr(record.address)}</span>
                      <CopyBtn text={record.address} />
                      <ShareBtn
                        url={`https://${ensName}.limo`}
                        title={`${ensName} — on-chain profile`}
                      />
                    </div>
                  ) : (
                    <span className="text-xs tracking-widest uppercase text-white/30">{ENS_NAME}</span>
                  )}
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="flex flex-col w-full lg:w-[48%] p-4 pt-0 pb-8 lg:p-6 lg:pl-0 gap-4">

          <div className="liquid-glass rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-white/50 font-mono">{ensName}</span>
            <span className="flex items-center gap-1.5"><LiveDot /><span className="text-[10px] text-white/30">live</span></span>
          </div>

          <div className="liquid-glass-strong rounded-[2.5rem] flex-1 p-6 flex flex-col gap-4">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Agents</p>

            {agents === null ? (
              <div className="flex flex-col gap-3">
                <div className="liquid-glass rounded-3xl p-5 flex flex-col gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 animate-pulse" />
                  <div className="h-3 w-2/3 rounded-full bg-white/5 animate-pulse" />
                  <div className="h-2.5 w-full rounded-full bg-white/4 animate-pulse" />
                </div>
              </div>
            ) : agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center flex-1">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white/20" />
                </div>
                <p className="text-white/25 text-sm">No agent registered yet</p>
                <a href={`https://dinamic.eth.limo/agent/`} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors">
                  Bridge an NFT →
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {agents.slice(agentPage * AGENTS_PER_PAGE, (agentPage + 1) * AGENTS_PER_PAGE).map(a => (
                  <AgentCard key={`${a.registry}-${a.agent_id}`} agent={a} isOwner={!!isProfileOwner} />
                ))}
                {agents.length > AGENTS_PER_PAGE && (
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setAgentPage(p => p - 1)}
                      disabled={agentPage === 0}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-white/40 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Prev
                    </button>
                    <span className="text-[10px] text-white/25">
                      {agentPage + 1} / {Math.ceil(agents.length / AGENTS_PER_PAGE)}
                    </span>
                    <button
                      onClick={() => setAgentPage(p => p + 1)}
                      disabled={(agentPage + 1) * AGENTS_PER_PAGE >= agents.length}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-white/40 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="liquid-glass rounded-2xl px-4 py-3 flex items-center justify-between">
            <a href={`https://${ENS_NAME}.limo`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-white/70 transition-colors">
              {ENS_NAME}
            </a>
            <a href={`https://dinamic.eth.limo/agents/`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-white/70 transition-colors">
              Agent Registry →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
