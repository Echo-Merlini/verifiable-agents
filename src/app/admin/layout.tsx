"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useGatewayEnv } from "@/hooks/useGatewayEnv";
import { shortAddr } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Database, Globe, Wallet, HardDrive,
  Sparkles, Key, Rocket, Settings, LogOut, Loader2, Bot, ChevronDown, Zap, Plug, ShieldCheck, FileCheck2, Network, Users, Coins, Store, Gauge,
} from "lucide-react";
import type { GatewayEnvKey } from "@/hooks/useGatewayEnv";

const nav = [
  {
    section: "Workspace",
    items: [
      { href: "/admin",          label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/ens",      label: "ENS",       icon: Globe },
      { href: "/admin/wallets",  label: "Wallets",   icon: Wallet },
      { href: "/admin/data",     label: "Storage",   icon: HardDrive },
      { href: "/admin/ai",       label: "AI",        icon: Sparkles },
      { href: "/admin/agents",   label: "Agents",    icon: Bot },
      { href: "/admin/credits",  label: "Credits",   icon: Zap },
      { href: "/admin/mcps",       label: "MCPs",      icon: Plug },
      { href: "/admin/approvals",    label: "Approvals",   icon: ShieldCheck },
      { href: "/admin/attestations", label: "Attestations", icon: FileCheck2 },
      { href: "/admin/router",       label: "Gateway / Router", icon: Network },
      { href: "/admin/settlement",   label: "Settlement",        icon: Coins },
      { href: "/admin/marketplace",  label: "Marketplace",       icon: Store },
      { href: "/admin/reputation",   label: "Reputation",        icon: Gauge },
      { href: "/admin/profiles",   label: "Profiles",  icon: Users },
    ],
  },
  {
    section: "System",
    items: [
      { href: "/admin/api-keys", label: "API Keys",  icon: Key },
      { href: "/admin/deploy",   label: "Deploy",    icon: Rocket },
      { href: "/admin/settings", label: "Settings",  icon: Settings },
    ],
  },
];

// Redirect to local dev server if accessed from IPFS/wrong host
// This inline script runs from the static HTML before any chunks load
const REDIRECT_SCRIPT = `
  (function(){
    var h = window.location.hostname;
    if(h !== 'localhost' && h !== '127.0.0.1'){
      window.location.replace('http://localhost:3000' + window.location.pathname);
    }
  })();
`;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { token, login, logout, loading, error, address } = useAuth();
  const { env, envKey, setEnv, envs } = useGatewayEnv();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [password, setPassword] = useState("");
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("ens-kit-unauthorized", handler);
    return () => window.removeEventListener("ens-kit-unauthorized", handler);
  }, [logout]);

  const handleLogin = () => login(password || undefined);

  if (!mounted) return <div className="min-h-screen bg-gb-bg" />;

  if (!token) {
    return (
      <div className="min-h-screen bg-gb-bg flex items-center justify-center p-4" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <script dangerouslySetInnerHTML={{ __html: REDIRECT_SCRIPT }} />
        <div className="bg-gb-surface border border-gb-border rounded-xl p-8 w-full max-w-sm space-y-5">
          <div className="text-center space-y-2">
            <div className="w-11 h-11 rounded-full bg-gb-accentD mx-auto flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-100 tracking-tight">Recomputable Agents · Admin</h1>
            <p className="text-gb-faint text-sm">Sign with your wallet to continue.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-gb-muted font-semibold uppercase tracking-wide">Password (optional)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Leave blank if none set"
              className="w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-gb-muted outline-none transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-gb-accentD hover:bg-gb-accent disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Signing…" : "Connect Wallet & Sign In"}
          </button>

          <div className="pt-2 border-t border-gb-border space-y-1.5">
            <p className="text-[10px] text-gb-muted uppercase tracking-widest font-semibold">Gateway</p>
            {(Object.entries(envs) as [GatewayEnvKey, typeof envs[GatewayEnvKey]][]).map(([key, e]) => (
              <button
                key={key}
                onClick={() => setEnv(key)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                  envKey === key
                    ? "bg-gb-surface border border-gb-border text-slate-100"
                    : "text-gb-faint hover:text-slate-100 hover:bg-gb-surface"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.color}`} />
                <span className="flex-1 text-left truncate">{e.label}</span>
                {envKey === key && <span className="text-gb-accent text-[10px]">active</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gb-bg flex text-slate-100" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-60 bg-gb-bg border-r border-gb-border flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-gb-border">
          <p className="text-base font-bold tracking-tight text-slate-100">Recomputable Agents</p>
          <p className="text-[9px] font-bold text-gb-accent uppercase tracking-widest mt-0.5">Admin</p>
          <div className="flex items-center gap-1.5 mt-3">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${env.color}`} />
            <span className="text-xs text-gb-muted">{env.label}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3">
          {nav.map(({ section, items }) => (
            <div key={section} className="mb-4">
              <p className="px-2 py-1 text-[10px] font-bold text-gb-muted uppercase tracking-widest mb-1">{section}</p>
              {items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors mb-0.5",
                    pathname === href
                      ? "bg-gb-surface text-slate-100"
                      : "text-gb-faint hover:text-slate-100 hover:bg-gb-surface"
                  )}
                >
                  <Icon className="w-[14px] h-[14px] shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gb-border space-y-1">
          <div className="px-2.5 py-1.5">
            <p className="text-gb-muted text-[11px] truncate font-mono">{address || "—"}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-gb-faint hover:text-slate-100 hover:bg-gb-surface w-full transition-colors"
          >
            <LogOut className="w-[14px] h-[14px]" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-9 overflow-auto">{children}</main>
    </div>
  );
}
