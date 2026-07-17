"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { Menu, X, Bot, Users, Wallet, Rss, FileText, Zap, Home, User, Sparkles, LogOut } from "lucide-react";
import { useWalletModal } from "@/hooks/useWalletModal";

const GW_URL   = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const ENS_NAME = process.env.NEXT_PUBLIC_ENS_NAME   || "dinamic.eth";

const LINKS = [
  { path: "demo/",      label: "Home",            icon: Home,      desc: "Verifiable Agents demo" },
  { path: "mint/",      label: "Mint Agent",      icon: Sparkles,  desc: "Mint a self-sovereign agent — no NFT needed" },
  { path: "my-agents/", label: "My Agents",       icon: Bot,       desc: "Manage your agent identities" },
  { path: "agents/",    label: "Browse Agents",   icon: Users,     desc: "Discover on-chain agent identities" },
  { path: "top-up/",    label: "Top Up Credits",  icon: Zap,       desc: "Add AI credits to your wallet" },
  { path: "feed/",      label: "Feed",            icon: Rss,       desc: "Latest activity" },
  { path: "spec/",      label: "Spec",            icon: FileText,  desc: "ENS-KIT/1 specification" },
];

export function NavMenu({ currentPath, baseUrl }: { currentPath?: string; baseUrl?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { open: openWallet } = useWalletModal();

  const connectWallet = () => { setOpen(false); openWallet(); };
  const disconnectWallet = () => {
    try { localStorage.removeItem("ens-kit-admin-token"); } catch {}
    disconnect();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const href = (path: string) =>
    baseUrl ? `${baseUrl}/${path}` : `../${path}`;

  const handleMyProfile = async () => {
    setOpen(false);
    if (!address) {
      window.open(href("claim/"), "_blank");
      return;
    }
    try {
      const res = await fetch(`${GW_URL}/api/claim/mine?address=${address}`);
      const data = await res.json();
      if (data.label) {
        window.open(`https://${data.label}.${ENS_NAME}.limo`, "_blank");
      } else {
        window.open(href("claim/"), "_blank");
      }
    } catch {
      window.open(href("claim/"), "_blank");
    }
  };

  return (
    <div ref={ref} className="fixed top-4 right-4 z-[100]">
      <button
        onClick={() => setOpen(p => !p)}
        aria-label="Navigation menu"
        className="w-9 h-9 rounded-full liquid-glass-strong flex items-center justify-center text-white/70 hover:text-white transition-colors hover:scale-105 active:scale-95"
      >
        {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {open && (
        <div className="absolute top-12 right-0 w-64 liquid-glass-strong rounded-3xl p-3 shadow-2xl flex flex-col gap-0.5">
          {/* Wallet — connect / disconnect */}
          <div className="px-1 pb-2 mb-1 border-b border-white/8">
            {address ? (
              <div className="flex items-center justify-between gap-2 px-2 py-1">
                <span className="font-mono text-[11px] text-white/60">{address.slice(0, 6)}…{address.slice(-4)}</span>
                <button onClick={disconnectWallet}
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/40 hover:text-red-400 transition-colors">
                  <LogOut className="w-3 h-3" /> Disconnect
                </button>
              </div>
            ) : (
              <button onClick={connectWallet}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-white/8 hover:bg-white/12 py-2 text-xs text-white/80 transition-colors">
                <Wallet className="w-3.5 h-3.5" /> Connect wallet
              </button>
            )}
          </div>
          <p className="text-[10px] uppercase tracking-widest text-white/25 px-3 py-1.5">Navigate</p>
          <button
            onClick={handleMyProfile}
            className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors group text-white/60 hover:bg-white/8 hover:text-white w-full text-left"
          >
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-white/8 group-hover:bg-white/12 transition-colors">
              <User className="w-3.5 h-3.5 text-white/50 group-hover:text-white/80" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium leading-none mb-0.5">My Profile</p>
              <p className="text-[10px] text-white/30 leading-none truncate">View or claim your subdomain</p>
            </div>
          </button>
          {LINKS.map(({ path, label, icon: Icon, desc }) => {
            const isCurrent = currentPath && path && path.includes(currentPath);
            return (
              <a
                key={path}
                href={href(path)}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors group ${
                  isCurrent
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/8 hover:text-white"
                }`}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isCurrent ? "bg-amber-500/30" : "bg-white/8 group-hover:bg-white/12"
                }`}>
                  <Icon className={`w-3.5 h-3.5 ${isCurrent ? "text-amber-300" : "text-white/50 group-hover:text-white/80"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-none mb-0.5">{label}</p>
                  <p className="text-[10px] text-white/30 leading-none truncate">{desc}</p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
