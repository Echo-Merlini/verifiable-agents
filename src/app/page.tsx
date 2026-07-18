"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { NavMenu } from "../components/NavMenu";
import { Landing } from "@/components/Landing";

const STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";
const SUB_ROUTES: Record<string, string> = {
  agent: "agent",
  "use-agent": "use-agent",
  claim: "claim",
  topup: "topup",
  "top-up": "topup",
  factory: "factory",
  mint: "mint",
  "mint-agent": "mint",
};
const AgentPage    = dynamic(() => import("./agent/page"),     { ssr: false });
const ClaimPage    = dynamic(() => import("./claim/page"),     { ssr: false });
const UseAgentPage = dynamic(() => import("./use-agent/page"), { ssr: false });
const FactoryPage  = dynamic(() => import("./factory/page"),   { ssr: false });
const TopupPage    = dynamic(() => import("./top-up/page"),     { ssr: false });
const MintPage     = dynamic(() => import("./mint/page"),       { ssr: false });
import { ArrowRight, Globe, Copy, Check, Zap, Activity, Volume2, VolumeX, Share2, Rss, Bot, Wallet, Sparkles, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useAccount, useDisconnect } from "wagmi";
import { useDisplayName } from "@/hooks/useDisplayName";
import { useWalletModal } from "@/hooks/useWalletModal";

const BASE_ENS_NAME = process.env.NEXT_PUBLIC_ENS_NAME || "dinamic.eth";
function resolveEnsName(): string {
  if (typeof window === "undefined") return BASE_ENS_NAME;
  const host = window.location.hostname;
  if (host.endsWith(".eth.limo")) return host.slice(0, -5); // strip .limo
  if (host.endsWith(".eth"))      return host;
  return BASE_ENS_NAME;
}
const ENS_NAME = resolveEnsName();
const VIDEO_URL = process.env.NEXT_PUBLIC_PROFILE_VIDEO_URL || "";
const GW_URL    = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

type EnsRecord = {
  name: string;
  address?: string;
  contenthash?: string;
  text_records: Record<string, string>;
  updated_at: number;
};

function timeAgo(ts: number) {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Social icons (monochrome SVG) ────────────────────────────────────────────
function IconX() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white/40 shrink-0">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconGitHub() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white/40 shrink-0">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.51 11.51 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function IconDiscord() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white/40 shrink-0">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.07.11 18.09.12 18.1a19.85 19.85 0 0 0 5.993 3.028.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function IconTelegram() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white/40 shrink-0">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

// ── Animated gradient fallback when no video ──────────────────────────────────
const THEMES: Record<string, [string, string, string]> = {
  purple: ["rgba(99,102,241,0.15)",  "rgba(129,140,248,0.1)", "rgba(79,70,229,0.12)"],
  blue:   ["rgba(59,130,246,0.15)",  "rgba(96,165,250,0.1)",  "rgba(37,99,235,0.12)"],
  green:  ["rgba(34,197,94,0.15)",   "rgba(74,222,128,0.1)",  "rgba(22,163,74,0.12)"],
  amber:  ["rgba(245,158,11,0.15)",  "rgba(251,191,36,0.1)",  "rgba(217,119,6,0.12)"],
  rose:   ["rgba(244,63,94,0.15)",   "rgba(251,113,133,0.1)", "rgba(225,29,72,0.12)"],
  teal:   ["rgba(20,184,166,0.15)",  "rgba(45,212,191,0.1)",  "rgba(13,148,136,0.12)"],
  mono:   ["rgba(120,120,120,0.15)", "rgba(160,160,160,0.1)", "rgba(90,90,90,0.12)"],
};

function GradientBg({ theme }: { theme?: string }) {
  const [a, b, c] = THEMES[theme?.toLowerCase() ?? ""] ?? THEMES.purple;
  return (
    <div className="fixed inset-0 z-0">
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 20% 50%, ${a}, transparent 60%)` }} />
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 80% 20%, ${b}, transparent 60%)` }} />
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 60% 80%, ${c}, transparent 60%)` }} />
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
}

// ── Live pulse dot ────────────────────────────────────────────────────────────
function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
    </span>
  );
}

// ── Connect wallet button ─────────────────────────────────────────────────────
function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { open } = useWalletModal();
  const { disconnect } = useDisconnect();
  const displayName = useDisplayName(address);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-9 w-32 rounded-full liquid-glass animate-pulse" />;

  if (isConnected && address) {
    return (
      <button onClick={() => disconnect()}
        className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-xs text-white/70 hover:text-white transition-colors"
        title={address}>
        <span className="font-mono">{displayName}</span>
      </button>
    );
  }
  return (
    <button onClick={() => open()}
      className="liquid-glass-strong rounded-full px-4 py-2 flex items-center gap-2 text-xs font-medium text-white hover:scale-105 active:scale-95 transition-transform">
      <Wallet className="w-3.5 h-3.5" />
      <span>Connect</span>
    </button>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded hover:bg-white/10 transition-colors text-white/50 hover:text-white/80"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Donate pill ───────────────────────────────────────────────────────────────
function ShareBtn() {
  const [shared, setShared] = useState(false);
  const url = `https://${ENS_NAME}.limo`;
  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: ENS_NAME, url }); } catch {}
    } else {
      navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };
  return (
    <button
      onClick={share}
      className="p-1 rounded hover:bg-white/10 transition-colors text-white/50 hover:text-white/80"
      title="Share profile"
    >
      {shared ? <Check className="w-3 h-3 text-green-400" /> : <Share2 className="w-3 h-3" />}
    </button>
  );
}

function GalleryItem({ src }: { src: string }) {
  const [type, setType] = useState<"image" | "video" | null>(null);
  useEffect(() => {
    if (/\.(jpe?g|png|gif|webp|svg|avif)(\?|$)/i.test(src)) { setType("image"); return; }
    if (/\.(mp4|webm|mov|ogg|m4v)(\?|$)/i.test(src))        { setType("video"); return; }
    fetch(src, { method: "HEAD" })
      .then(r => setType((r.headers.get("content-type") || "").startsWith("image/") ? "image" : "video"))
      .catch(() => setType("image"));
  }, [src]);
  const cls = "h-24 w-24 rounded-2xl object-cover ring-1 ring-white/10 group-hover:ring-white/30 group-hover:scale-105 transition-all";
  if (!type) return <div className="h-24 w-24 rounded-2xl bg-white/5 animate-pulse shrink-0" />;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="shrink-0 group">
      {type === "video"
        ? <video src={src} autoPlay loop muted playsInline className={`${cls} pointer-events-none`} />
        : <img src={src} alt="" className={cls} />}
    </a>
  );
}

function RssFeed({ url }: { url: string }) {
  type FeedItem = { title: string; link: string; date: string; author: string; image: string };
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedTitle, setFeedTitle] = useState("");

  useEffect(() => {
    async function load() {
      let xml = "";
      try {
        const r = await fetch(url);
        if (r.ok) xml = await r.text();
      } catch {}
      if (!xml) {
        try {
          const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
          if (r.ok) { const d = await r.json(); xml = d.contents || ""; }
        } catch {}
      }
      if (!xml) { setLoading(false); return; }
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      setFeedTitle(doc.querySelector("channel > title")?.textContent || "");
      const parsed = [...doc.querySelectorAll("item")].slice(0, 6).map(el => ({
        title:  el.querySelector("title")?.textContent?.trim() || "",
        link:   el.querySelector("link")?.textContent?.trim() || "",
        date:   el.querySelector("pubDate")?.textContent?.trim() || "",
        author: el.querySelector("creator, author")?.textContent?.trim() || "",
        image:  el.querySelector("content")?.getAttribute("url") ||
                el.querySelector("enclosure")?.getAttribute("url") || "",
      }));
      setItems(parsed);
      setLoading(false);
    }
    load();
  }, [url]);

  if (loading) return (
    <div className="mt-6 space-y-2">
      {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-2xl bg-white/5 animate-pulse" />)}
    </div>
  );
  if (!items.length) return null;

  return (
    <div className="mt-6">
      <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3 flex items-center gap-1.5">
        <Rss className="w-3 h-3" />{feedTitle || "Feed"}
      </p>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white/6 transition-colors group">
            {item.image && (
              <img src={item.image} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0 ring-1 ring-white/10" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/75 group-hover:text-white transition-colors line-clamp-2 leading-snug">{item.title}</p>
              <p className="text-[10px] text-white/30 mt-0.5">
                {item.author && <span>{item.author} · </span>}
                {item.date && new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
            </div>
            <ArrowRight className="w-3 h-3 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  );
}

function DonatePill({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="liquid-glass rounded-full px-6 py-3 flex items-center gap-3 text-sm text-white/70 hover:text-white hover:scale-105 active:scale-95 transition-all"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0 text-white/40" />}
      <span>{copied ? "Address copied!" : "Donate"}</span>
      <span className="font-mono text-xs text-white/30">{address.slice(0, 6)}…{address.slice(-4)}</span>
    </button>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="liquid-glass rounded-2xl p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-white/70" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/50 mb-0.5">{label}</p>
        <p className="text-sm text-white font-medium">{value}</p>
      </div>
    </div>
  );
}

// ── User Journey ─────────────────────────────────────────────────────────────
function UserJourney() {
  const steps = [
    {
      num: "01",
      icon: Globe,
      color: "text-amber-400",
      border: "border-amber-400/20",
      bg: "bg-amber-400/8",
      title: "Claim your name",
      desc: "Get a gasless *.dinamic.eth subdomain and configure your on-chain profile — avatar, links, and social records.",
      actions: [
        { label: "Get Subdomain", href: "/claim", primary: true },
        { label: "Edit Profile", href: "/profile-edit", primary: false },
      ],
    },
    {
      num: "02",
      icon: Bot,
      color: "text-amber-400",
      border: "border-amber-400/20",
      bg: "bg-amber-400/8",
      title: "Bridge your NFT",
      desc: "Wrap any NFT you own into an ERC-8004 agent identity. One token, one agent — deployed on-chain in seconds.",
      actions: [
        { label: "Bridge NFT", href: "/agent", primary: true },
      ],
    },
    {
      num: "03",
      icon: MessageSquare,
      color: "text-emerald-400",
      border: "border-emerald-400/20",
      bg: "bg-emerald-400/8",
      title: "Chat with your Agent",
      desc: "Configure AI skills, personality, and MCP tools. Then chat — or let others discover your agent publicly.",
      actions: [
        { label: "Demo", href: "/demo", primary: true },
        { label: "Chat", href: "/use-agent", primary: false },
      ],
    },
  ];

  return (
    <div className="liquid-glass-strong rounded-[2.5rem] lg:flex-1 p-6 flex flex-col gap-0">
      <p className="text-[10px] uppercase tracking-widest text-white/40 mb-5">Get Started</p>
      <div className="flex flex-col gap-0">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.num} className="relative flex gap-4">
              {/* Connector line */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${step.border} ${step.bg}`}>
                  <span className={`text-[10px] font-mono font-bold ${step.color}`}>{step.num}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px flex-1 my-1 border-l border-dashed border-white/10" style={{ minHeight: "1.5rem" }} />
                )}
              </div>
              {/* Card */}
              <div className={`liquid-glass rounded-3xl p-4 flex flex-col gap-3 mb-3 flex-1 min-w-0`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${step.color}`} />
                  <span className="text-sm font-medium text-white">{step.title}</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{step.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {step.actions.map(action => (
                    <Link key={action.href} href={action.href}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 ${
                        action.primary
                          ? "liquid-glass-strong text-white"
                          : "liquid-glass text-white/60 hover:text-white"
                      }`}>
                      {action.label}
                      {action.primary && <ArrowRight className="w-3 h-3" />}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Record pill ───────────────────────────────────────────────────────────────
function RecordPill({ k, v }: { k: string; v: string }) {
  return (
    <div className="liquid-glass rounded-full px-4 py-1.5 flex items-center gap-2 text-xs">
      <span className="text-white/50 uppercase tracking-wider">{k}</span>
      <span className="text-white/80 truncate max-w-[140px]">{v}</span>
    </div>
  );
}

function ProfilePage() {
  const { isConnected } = useAccount();
  const { open } = useWalletModal();
  const [uiMounted, setUiMounted] = useState(false);
  const [record, setRecord] = useState<EnsRecord | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  const [fetchCount, setFetchCount] = useState(0);
  const [mediaIsVideo, setMediaIsVideo] = useState<boolean | null>(null);
  const [mediaFailed, setMediaFailed]   = useState(false);
  const [mediaMuted, setMediaMuted]     = useState(true);
  const [mediaVolume, setMediaVolume]   = useState(1);
  const [showSlider, setShowSlider]     = useState(false);
  const mediaVideoRef = useRef<HTMLVideoElement>(null);

  const fetchRecord = useCallback(async () => {
    try {
      const r = await fetch(`${GW_URL}/record/${encodeURIComponent(ENS_NAME)}`);
      if (!r.ok) { setError(true); return; }
      const data = await r.json();
      setRecord(data);
      setFetchCount(c => c + 1);
      setError(false);
    } catch { setError(true); }
  }, []);

  useEffect(() => { fetchRecord(); }, [fetchRecord]);
  useEffect(() => { const t = setInterval(() => { fetchRecord(); setTick(n => n + 1); }, 5000); return () => clearInterval(t); }, [fetchRecord]);
  useEffect(() => setUiMounted(true), []);

  const tr = record?.text_records ?? {};
  const avatar    = tr.avatar;
  const icon      = tr.icon;
  const desc      = tr.description || "A dynamic ENS profile — records served live, zero gas.";
  const url       = tr.url;
  const agent     = tr["agent"];
  const twitter   = tr["com.twitter"] || tr["twitter"];
  const github    = tr["com.github"]  || tr["github"];
  const videoUrl  = tr.video || VIDEO_URL;

  // Swap favicon dynamically from text record once loaded
  useEffect(() => {
    if (!icon) return;
    // Remove all existing icon links to avoid stale entries
    document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']").forEach(el => el.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = icon.endsWith(".svg") || icon.includes("svg") ? "image/svg+xml" : "image/png";
    link.href = icon;
    document.head.appendChild(link);
  }, [icon]);

  // pfp_button / pfp_button_2: "Label|URL" or "URL"
  const pfpButtonRaw  = tr["pfp_button"];
  const pfpButtonUrl   = pfpButtonRaw?.includes("|") ? pfpButtonRaw.split("|").slice(1).join("|") : pfpButtonRaw;
  const pfpButtonLabel = pfpButtonRaw?.includes("|") ? pfpButtonRaw.split("|")[0] : "Visit";
  const pfpButton2Raw  = tr["pfp_button_2"];
  const pfpButton2Url   = pfpButton2Raw?.includes("|") ? pfpButton2Raw.split("|").slice(1).join("|") : pfpButton2Raw;
  const pfpButton2Label = pfpButton2Raw?.includes("|") ? pfpButton2Raw.split("|")[0] : "More";

  const discord  = tr["discord"];
  const telegram = tr["telegram"];
  const badge    = tr["badge"];
  const cal      = tr["cal"];
  const tip      = tr["tip"];
  const banner   = tr["banner"];
  const gallery  = tr["gallery"]?.split(",").map((s: string) => s.trim()).filter(Boolean) ?? [];
  const cardBg   = tr["card_bg"];
  const media     = tr["media"];
  const mediaDesc = tr["media_desc"];
  const donate    = tr["donate"];
  const rss       = tr["rss"];
  const theme     = tr["theme"];
  const layout    = tr["layout"];
  const subtitle  = tr["subtitle"];

  // Detect media type via HEAD request (handles extensionless IPFS URLs)
  useEffect(() => {
    if (!media) return;
    setMediaFailed(false);
    setMediaIsVideo(null);
    if (/\.(jpe?g|png|gif|webp|svg|avif)$/i.test(media)) { setMediaIsVideo(false); return; }
    if (/\.(mp4|webm|mov|ogg|m4v)$/i.test(media)) { setMediaIsVideo(true); return; }
    fetch(media, { method: "HEAD" })
      .then(r => {
        const ct = r.headers.get("content-type") || "";
        // Only treat as image if explicitly image/* — octet-stream and unknown default to video
        setMediaIsVideo(!ct.startsWith("image/"));
      })
      .catch(() => setMediaIsVideo(true));
  }, [media]);
  // layout: planned (controls page structure preset)

  const twitterHandle  = twitter?.replace(/https?:\/\/(www\.)?(twitter|x)\.com\/?@?/, "").replace(/^@/, "");
  const githubHandle   = github?.replace(/https?:\/\/(www\.)?github\.com\/?/, "").replace(/^\//, "");
  const discordHandle  = discord?.replace(/https?:\/\/(www\.)?discord\.(gg|com)\/?/, "");
  const telegramHandle = telegram?.replace(/https?:\/\/(www\.)?t\.me\/?/, "").replace(/^@/, "");

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col font-display">
      <NavMenu currentPath="root" />

      {/* ── Background ─────────────────────────────────── */}
      {videoUrl ? (
        <>
          <video src={videoUrl} autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover z-0" />
          <div className="fixed inset-0 z-0 bg-black/50" />
        </>
      ) : (
        <GradientBg theme={theme} />
      )}

      {/* ── Hero header ────────────────────────────────── */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center pt-16 pb-10 px-6 text-center">
        <h1 className="text-6xl lg:text-8xl font-medium tracking-[-0.05em] text-white leading-none mb-5">
          dinamic<em className="font-serif not-italic text-white/60">.eth</em>
        </h1>
        <p className="text-sm lg:text-base text-white/40 font-light max-w-lg leading-relaxed">
          {subtitle || <>Not a database. A trust-minimised routing layer —<br className="hidden sm:block" /> any ENS client resolves it, no platform permission required.</>}
        </p>
      </div>

      {/* ── Banner card ────────────────────────────────── */}
      {banner && (
        <div className="relative z-10 w-full px-4 lg:px-6 pb-4">
          <div className="w-full h-36 lg:h-44 rounded-3xl overflow-hidden ring-1 ring-white/10">
            <img src={banner} alt="banner" className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* ── Media card ─────────────────────────────────── */}
      {media && (
        <div className="relative z-10 w-full px-4 lg:px-6 pb-4">
          {/* outer wrapper is relative so the volume button can escape overflow-hidden */}
          <div className="relative">
            <div className="liquid-glass-strong rounded-3xl overflow-hidden">
              {mediaIsVideo === null ? (
                <div className="w-full h-48 animate-pulse bg-white/5" />
              ) : mediaIsVideo && !mediaFailed ? (
                <video
                  ref={mediaVideoRef}
                  src={media}
                  autoPlay loop muted playsInline
                  className="w-full max-h-[60vh] object-cover"
                  onError={() => setMediaFailed(true)}
                  onVolumeChange={(e) => {
                    const v = e.currentTarget;
                    setMediaMuted(v.muted);
                    setMediaVolume(v.volume);
                  }}
                />
              ) : (
                <img src={media} alt={mediaDesc || "media"} className="w-full max-h-[60vh] object-cover" />
              )}
              {mediaDesc && (
                <div className="px-6 py-4 border-t border-white/8">
                  <p className="text-sm text-white/50 leading-relaxed">{mediaDesc}</p>
                </div>
              )}
            </div>

            {/* Volume control — outside overflow-hidden, anchored to card top-right */}
            {mediaIsVideo && !mediaFailed && (
              <div
                className="absolute top-3 right-3 flex items-center gap-2 z-20"
                onMouseEnter={() => setShowSlider(true)}
                onMouseLeave={() => setShowSlider(false)}
              >
                {showSlider && (
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={mediaMuted ? 0 : mediaVolume}
                    onChange={(e) => {
                      const vol = parseFloat(e.target.value);
                      if (mediaVideoRef.current) {
                        mediaVideoRef.current.volume = vol;
                        mediaVideoRef.current.muted  = vol === 0;
                      }
                      setMediaVolume(vol);
                      setMediaMuted(vol === 0);
                    }}
                    className="w-20 h-1 accent-white/80 cursor-pointer"
                  />
                )}
                <button
                  onClick={() => {
                    if (!mediaVideoRef.current) return;
                    const next = !mediaMuted;
                    mediaVideoRef.current.muted  = next;
                    mediaVideoRef.current.volume = next ? mediaVolume : (mediaVolume || 1);
                    setMediaMuted(next);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all"
                  title={mediaMuted ? "Unmute" : "Mute"}
                >
                  {mediaMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
                <img
                  src={icon || "./favicon.svg"}
                  alt={ENS_NAME}
                  className="w-6 h-6 object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "./favicon.svg"; }}
                />
              </div>
              <span className="text-xl font-semibold tracking-tight text-white">ENS Kit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2">
                <LiveDot />
                <span className="text-xs text-white/70 font-medium">Live</span>
              </div>
              <ConnectButton />
            </div>
          </nav>

          {/* Hero */}
          <div className="flex flex-col items-start lg:justify-center lg:flex-1 py-8 lg:py-12">

            {/* Avatar + badge */}
            <div className="relative mb-6 w-fit">
              {avatar ? (
                <a href={pfpButtonUrl || avatar} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={avatar} alt={ENS_NAME} className="w-20 h-20 rounded-full object-cover ring-1 ring-white/20 hover:ring-white/50 hover:scale-105 transition-all" />
                </a>
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

            {/* Name */}
            <h2 className="text-5xl lg:text-7xl font-medium tracking-[-0.05em] text-white leading-none mb-4">
              {ENS_NAME.split(".").map((part, i) => (
                <span key={i}>
                  {i === 0 ? part : <><br /><em className="font-serif text-white/70 not-italic">.{part}</em></>}
                </span>
              ))}
            </h2>

            <p className="text-white/60 text-base font-light max-w-sm mt-2 mb-8 leading-relaxed">{desc}</p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
              {/* Primary: pfp_button → url → admin fallback */}
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
              {/* pfp_button_2 */}
              {pfpButton2Url && (
                <a href={pfpButton2Url} target="_blank" rel="noopener noreferrer"
                  className="liquid-glass rounded-full px-5 py-3 flex items-center gap-2 text-sm text-white/80 hover:scale-105 active:scale-95 transition-transform">
                  <span>{pfpButton2Label}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              )}
              {/* agent — link to agent subpage */}
              {agent && (
                <a href={agent.startsWith("http") ? agent : "./agent/"}
                  target={agent.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                  className="liquid-glass rounded-full px-5 py-3 flex items-center gap-2 text-sm text-white/80 hover:scale-105 active:scale-95 transition-transform">
                  <Bot className="w-4 h-4 text-white/50" />
                  <span>{(!agent.startsWith("http") && agent.length < 30) ? agent : "Agent"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              )}
              {/* cal — Book a call / phone call */}
              {cal && (() => {
                const isPhone = /^\+?[\d\s\-().]{7,}$/.test(cal.trim());
                return (
                  <a href={isPhone ? `tel:${cal.replace(/\s/g, "")}` : cal}
                    target={isPhone ? undefined : "_blank"} rel="noopener noreferrer"
                    className="liquid-glass rounded-full px-5 py-3 text-sm text-white/80 hover:scale-105 active:scale-95 transition-transform">
                    {isPhone ? "Call" : "Book a call"}
                  </a>
                );
              })()}
              {/* tip — send tip */}
              {tip && (
                <a href={`ethereum:${tip}`}
                  className="liquid-glass rounded-full px-5 py-3 text-sm text-white/80 hover:scale-105 active:scale-95 transition-transform">
                  Send tip
                </a>
              )}

            </div>

            {/* Tags + Socials */}
            <div className="flex flex-wrap gap-2">
              <div className="liquid-glass rounded-full px-4 py-1.5 text-xs text-white/80">CCIP Read</div>
              <div className="liquid-glass rounded-full px-4 py-1.5 text-xs text-white/80">Offchain Resolver</div>
              <div className="liquid-glass rounded-full px-4 py-1.5 text-xs text-white/80">Zero Gas Updates</div>
              {twitterHandle && (
                <a href={`https://x.com/${twitterHandle}`} target="_blank" rel="noopener noreferrer"
                  className="liquid-glass rounded-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-white/10 transition-colors">
                  <IconX />
                  <span className="text-xs text-white/60">@{twitterHandle}</span>
                </a>
              )}
              {githubHandle && (
                <a href={`https://github.com/${githubHandle}`} target="_blank" rel="noopener noreferrer"
                  className="liquid-glass rounded-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-white/10 transition-colors">
                  <IconGitHub />
                  <span className="text-xs text-white/60">{githubHandle}</span>
                </a>
              )}
              {discordHandle && (
                <a href={discord!.startsWith("http") ? discord! : `https://discord.gg/${discordHandle}`} target="_blank" rel="noopener noreferrer"
                  className="liquid-glass rounded-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-white/10 transition-colors">
                  <IconDiscord />
                  <span className="text-xs text-white/60">{discordHandle}</span>
                </a>
              )}
              {telegramHandle && (
                <a href={`https://t.me/${telegramHandle}`} target="_blank" rel="noopener noreferrer"
                  className="liquid-glass rounded-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-white/10 transition-colors">
                  <IconTelegram />
                  <span className="text-xs text-white/60">@{telegramHandle}</span>
                </a>
              )}
            </div>

            {/* Gallery */}
            {gallery.length > 0 && (
              <div className="mt-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none bg-transparent">
                {gallery.map((src, i) => <GalleryItem key={i} src={src} />)}
              </div>
            )}
            {rss && <RssFeed url={rss} />}
          </div>

          {/* Bottom quote / address */}
          <div className="mt-auto pt-6">
            {record?.address ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-white/50">{shortAddr(record.address)}</span>
                  <CopyBtn text={record.address} />
                </div>
                <div className="flex-1 h-px bg-white/10" />
                <ShareBtn />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs tracking-widest uppercase text-white/30">Dynamic ENS</span>
                <div className="flex-1 h-px bg-white/10" />
                <ShareBtn />
              </div>
            )}
          </div>
          </div>

          {/* Wallet gate overlay */}
          {uiMounted && !isConnected && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-[2.5rem] backdrop-blur-md bg-black/30">
              <button
                onClick={() => open()}
                className="liquid-glass-strong rounded-full px-8 py-4 flex items-center gap-3 text-base font-semibold text-white hover:scale-105 active:scale-95 transition-transform">
                <Wallet className="w-5 h-5" />
                <span>Connect Wallet</span>
              </button>
              <p className="text-xs text-white/35 mt-3 tracking-wide">Connect to view your live ENS profile</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────── */}
      <div className="flex flex-col w-full lg:w-[48%] p-4 pt-0 pb-8 lg:p-6 lg:pl-0 lg:pb-6 gap-4">

        {/* Top bar */}
        <div className="liquid-glass rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LiveDot />
            <span className="text-xs text-white/60">Records resolving live from gateway</span>
          </div>
          <div className="liquid-glass rounded-full px-3 py-1.5 text-[10px] text-white/50 font-mono">
            {GW_URL.replace("https://", "")}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Zap} label="Last Updated"
            value={record ? timeAgo(record.updated_at) : "—"} />
          <StatCard icon={Activity} label="Gateway Polls"
            value={fetchCount > 0 ? `${fetchCount} requests` : "connecting…"} />
        </div>

        <UserJourney />
      </div>

      </div>{/* end panels row */}

      {/* ── Project cards ──────────────────────────────── */}
      <div className="relative z-10 w-full px-4 lg:px-6 pb-10 lg:pb-12">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-[10px] uppercase tracking-widest text-white/30">About ENS Kit</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          <div className="liquid-glass-strong rounded-3xl p-6 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white/70" />
            </div>
            <h3 className="text-sm font-medium text-white">Zero gas updates</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Change your address, bio, links, or background at any time — no wallet transaction, no fee, instant effect.
            </p>
          </div>

          <div className="liquid-glass-strong rounded-3xl p-6 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-white/70" />
            </div>
            <h3 className="text-sm font-medium text-white">Your .eth name, alive</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              ENS names are usually static. This stack makes yours dynamic — a live profile any wallet or browser can resolve in real time.
            </p>
          </div>

          <div className="liquid-glass-strong rounded-3xl p-6 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white/70" />
            </div>
            <h3 className="text-sm font-medium text-white">Build on top</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              A push API lets any backend update records automatically. CI pipeline, webhook, cron — your .eth name becomes a programmable config layer.
            </p>
          </div>

          <div className="liquid-glass-strong rounded-3xl p-6 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white/70">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.51 11.51 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-white">Open source</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Gateway, contract, and admin UI are fully open source and self-hostable. No vendor lock-in — you own the stack.
            </p>
            <a href="https://github.com/Echo-Merlini/ens-dynamic-kit" target="_blank" rel="noopener noreferrer"
              className="mt-auto text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors">
              GitHub →
            </a>
          </div>

        </div>

        {/* EIP explanation */}
        <div className="mt-6 mb-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-[10px] uppercase tracking-widest text-white/30">Under the hood</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <div className="liquid-glass rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-white/8 text-white/40">EIP-3668</span>
              <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-white/8 text-white/40">ENSIP-10</span>
            </div>
            <h3 className="text-sm font-medium text-white">CCIP Read — Cross-Chain Interoperability Protocol</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              When a wallet resolves your <span className="text-white/70">.eth</span> name, the on-chain resolver does not return data directly. Instead it reverts with an <span className="font-mono text-white/60">OffchainLookup</span> — a signed pointer to a gateway URL. The client fetches from that URL, receives a cryptographically signed response, and calls back into the contract to verify the signature. No trust is placed in the gateway: the contract only accepts responses signed by the registered signer key. ENSIP-10 extends this to wildcard subdomains — one resolver handles every name under your <span className="text-white/70">.eth</span>.
            </p>
            <div className="font-mono text-[10px] text-white/25 leading-relaxed border-l border-white/10 pl-3">
              resolve(name) → OffchainLookup<br />
              GET /lookup/:sender/:data → signed response<br />
              resolveWithProof(response) → verify sig → return data
            </div>
          </div>

          <div className="liquid-glass rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-white/8 text-white/40">EIP-1577</span>
              <span className="font-mono text-[10px] px-2 py-1 rounded-full bg-white/8 text-white/40">On-chain CID</span>
            </div>
            <h3 className="text-sm font-medium text-white">Direct CID validation — Brave & native browser resolution</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Browsers like Brave resolve <span className="text-white/70">.eth</span> names by calling <span className="font-mono text-white/60">contenthash(bytes32)</span> directly on the resolver — they do not follow CCIP Read. The resolver stores a CID encoded as EIP-1577 (CIDv1 dag-pb) on-chain via <span className="font-mono text-white/60">setContenthash()</span>. This means the IPFS content hash is independently verifiable on-chain: anyone can call the contract and confirm the exact CID the name points to, with no trust in the gateway. Gas is paid once per content update, keeping the on-chain record as the single source of truth for browser-native resolution.
            </p>
            <div className="font-mono text-[10px] text-white/25 leading-relaxed border-l border-white/10 pl-3">
              contenthash(node) → EIP-1577 bytes<br />
              decode → CIDv1 (dag-pb, sha2-256)<br />
              Brave fetches ipfs://&lt;CID&gt; directly
            </div>
          </div>

        </div>

        {/* ENS-KIT/1 Convention card */}
        <div className="mt-6 mb-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-[10px] uppercase tracking-widest text-white/30">ENS-KIT/1 Convention Proposal</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="text-sm font-medium text-white mb-1">Text Record Extension Spec</h3>
            <p className="text-xs text-white/40 max-w-md leading-relaxed">
              A proposed convention for driving frontend UI directly from ENS text records. No custom resolver required — updates are instant, gasless, and require no redeployment.
            </p>
          </div>
          <a href="/verify" className="shrink-0 font-mono text-[10px] px-3 py-1.5 rounded-full bg-white/8 text-white/40 hover:text-white/70 hover:bg-white/12 transition-colors">
            Draft · ENS-KIT/1 →
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            {
              label: "Media", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20",
              records: [
                { key: "avatar",     done: true  },
                { key: "icon",       done: true  },
                { key: "video",      done: true  },
                { key: "banner",     done: true  },
                { key: "gallery",    done: true  },
                { key: "card_bg",    done: true  },
                { key: "media",      done: true  },
                { key: "media_desc", done: true  },
              ],
            },
            {
              label: "Actions", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20",
              records: [
                { key: "pfp_button",   done: true  },
                { key: "pfp_button_2", done: true  },
                { key: "url",          done: true  },
                { key: "agent",        done: true  },
                { key: "tip",          done: true  },
                { key: "cal",          done: true  },
                { key: "donate",       done: true  },
              ],
            },
            {
              label: "Integrations", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20",
              records: [
                { key: "com.twitter", done: true  },
                { key: "com.github",  done: true  },
                { key: "discord",     done: true  },
                { key: "telegram",    done: true  },
                { key: "email",       done: false },
                { key: "rss",         done: true  },
              ],
            },
            {
              label: "Appearance", color: "text-pink-400", bg: "bg-pink-400/10 border-pink-400/20",
              records: [
                { key: "theme",    done: true  },
                { key: "layout",  done: false },
                { key: "badge",   done: true  },
                { key: "subtitle", done: true  },
              ],
            },
          ] as const).map((section) => (
            <div key={section.label} className="liquid-glass rounded-3xl p-5 flex flex-col gap-3">
              <p className={`text-[10px] uppercase tracking-widest font-medium ${section.color}`}>{section.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {section.records.map(({ key, done }) => (
                  <span
                    key={key}
                    className={`font-mono text-[10px] px-2.5 py-1 rounded-full border ${
                      done
                        ? `${section.bg} ${section.color}`
                        : "bg-white/4 border-white/10 text-white/25"
                    }`}
                  >
                    {key}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Donate pill */}
        {donate && (
          <div className="mt-10 flex justify-center">
            <DonatePill address={donate} />
          </div>
        )}

      </div>
    </div>
  );
}
export default function RootPage() {
  const [subPage, setSubPage] = useState<string>("root");

  useEffect(() => {
    if (!STATIC) { setSubPage("root"); return; }
    const hardcoded = (window as any).__ENS_ROUTE__;
    if (hardcoded && SUB_ROUTES[hardcoded]) { setSubPage(SUB_ROUTES[hardcoded]); return; }
    const label = window.location.hostname.split(".")[0];
    if (SUB_ROUTES[label]) { setSubPage(SUB_ROUTES[label]); return; }
    const pathSeg = window.location.pathname.replace(/^\//, "").split("/")[0];
    setSubPage(SUB_ROUTES[pathSeg] ?? "root");
  }, []);

  if (subPage === "agent")     return <AgentPage />;
  if (subPage === "use-agent")  return <UseAgentPage />;
  if (subPage === "claim")     return <ClaimPage />;
  if (subPage === "factory")   return <FactoryPage />;
  if (subPage === "topup")     return <TopupPage />;
  if (subPage === "mint")      return <MintPage />;
  if (subPage === "profile")   return <ProfilePage />; // dinamic profile — kept reachable (static export), dormant in server mode
  return <Landing />;
}
