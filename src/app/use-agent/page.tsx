"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount, useDisconnect, useSignMessage,
} from "wagmi";
import { useWalletModal } from "@/hooks/useWalletModal";
import { createSiweMessage } from "viem/siwe";
import { type Address } from "viem";
import { Bot, Check, Copy, ExternalLink, Globe, Link2, Loader2, LogOut, Pencil, Wallet, Zap, AlertTriangle, Coins } from "lucide-react";
import { getAgentAuthNonce, verifyAgentOwner, getMyAgents } from "@/lib/api";
import { GATEWAY_URL, REGISTRY_CHAIN_ID } from "@/lib/erc8004";
import Link from "next/link";
import { usePageRecords } from "@/hooks/usePageRecords";
import { NavMenu } from "@/components/NavMenu";

const OWNER_TOKEN_KEY = "ens-kit-owner-token";
const OWNER_ADDR_KEY  = "ens-kit-owner-addr";

type Service = { name: string; endpoint: string; version?: string };
type AgentRecord = {
  registry: string; agent_id: string; owner_address: string;
  name: string; description: string; image: string;
  source_contract: string; source_token_id: string;
  services: Service[]; chain_id: number; active: number;
  consult_price?: string; completion_window?: number;
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/70 transition-colors liquid-glass rounded-full px-2.5 py-1"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : (label ?? "Copy")}
    </button>
  );
}

type McpTab = "Claude" | "Cursor" | "OpenCode" | "Windsurf" | "ChatGPT";

function EndpointRow({ service, token }: { service: Service; token: string }) {
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "err">("idle");
  const [mcpTab, setMcpTab] = useState<McpTab>("Claude");

  const mcpClients: { id: McpTab; file: string; snippet: string }[] = [
    { id: "Claude",   file: "~/.claude/mcp_servers.json",              snippet: `{\n  "my-agent": {\n    "type": "streamable-http",\n    "url": "${service.endpoint}",\n    "headers": { "Authorization": "Bearer <token>" }\n  }\n}` },
    { id: "Cursor",   file: ".cursor/mcp.json",                        snippet: `{\n  "mcpServers": {\n    "my-agent": {\n      "url": "${service.endpoint}",\n      "headers": { "Authorization": "Bearer <token>" }\n    }\n  }\n}` },
    { id: "OpenCode", file: "opencode.json",                           snippet: `{\n  "mcp": {\n    "my-agent": {\n      "type": "remote",\n      "url": "${service.endpoint}",\n      "headers": { "Authorization": "Bearer <token>" }\n    }\n  }\n}` },
    { id: "Windsurf", file: "~/.codeium/windsurf/mcp_config.json",     snippet: `{\n  "mcpServers": {\n    "my-agent": {\n      "serverType": "http",\n      "url": "${service.endpoint}",\n      "headers": { "Authorization": "Bearer <token>" }\n    }\n  }\n}` },
    { id: "ChatGPT", file: "chatgpt.com → Settings → Connectors → Add", snippet: `URL\n${service.endpoint}\n\nAuthentication\nBearer <token>` },
  ];
  const activeMcp = mcpClients.find(c => c.id === mcpTab)!;

  async function testConnection() {
    setStatus("testing");
    try {
      const res = await fetch(service.endpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      setStatus(res.ok || res.status < 500 ? "ok" : "err");
    } catch {
      setStatus("err");
    }
  }

  const colorClass = service.name === "MCP"
    ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
    : service.name === "A2A"
    ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
    : "bg-white/5 border-white/10 text-white/50";

  return (
    <div className="liquid-glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${colorClass}`}>
            {service.name}
          </span>
          {service.version && (
            <span className="text-[10px] text-white/25 font-mono">{service.version}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "ok"  && <span className="text-[10px] text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Reachable</span>}
          {status === "err" && <span className="text-[10px] text-red-400">Unreachable</span>}
          <button
            onClick={testConnection}
            disabled={status === "testing"}
            className="text-[10px] text-white/40 hover:text-white/70 transition-colors liquid-glass rounded-full px-2.5 py-1 disabled:opacity-40"
          >
            {status === "testing" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test"}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-white/4 rounded-xl px-3 py-2">
        <Globe className="w-3.5 h-3.5 text-white/25 shrink-0" />
        <span className="font-mono text-xs text-white/60 truncate flex-1">{service.endpoint}</span>
        <CopyButton text={service.endpoint} />
        <a
          href={service.endpoint}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
            {service.name === "MCP" && (
        <div className="bg-black/30 rounded-xl p-3 text-[10px] text-white/40 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-white/25 text-[9px] uppercase tracking-widest">Connect · MCP Client</p>
            <div className="flex gap-1 flex-wrap">
              {mcpClients.map(c => (
                <button key={c.id} onClick={() => setMcpTab(c.id)}
                  className={`rounded-full px-2 py-0.5 text-[9px] transition-colors ${mcpTab === c.id ? "bg-amber-500/30 text-amber-200 border border-amber-500/40" : "text-white/30 hover:text-white/50"}`}>
                  {c.id}
                </button>
              ))}
            </div>
          </div>
          <p className="font-mono text-white/20 text-[9px]">{activeMcp.file}</p>
          <pre className="font-mono text-[10px] text-white/40 whitespace-pre-wrap break-all leading-relaxed">{activeMcp.snippet}</pre>
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, token }: { agent: AgentRecord; token: string }) {
  const mcpService  = agent.services.find(s => s.name === "MCP");
  const a2aService  = agent.services.find(s => s.name === "A2A");
  const ensService  = agent.services.find(s => s.name === "ENS");
  const hasServices = Boolean(mcpService || a2aService);
  const agentUri    = GATEWAY_URL ? `${GATEWAY_URL}/agent/${agent.registry}/${agent.agent_id}` : "";
  const [tokenVisible, setTokenVisible] = useState(false);

  return (
    <div className="space-y-4">
      <div className="liquid-glass-strong rounded-3xl p-5 flex gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-white/4">
          {agent.image ? (
            <img src={agent.image} alt={agent.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white/20" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-white text-lg leading-tight">{agent.name}</h2>
              {ensService && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Link2 className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-green-400 font-mono">{ensService.endpoint}</span>
                </div>
              )}
            </div>
            <Link
              href="/my-agents"
              className="liquid-glass rounded-full p-2 text-white/40 hover:text-white/70 transition-colors shrink-0"
              title="Edit in My Agents"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Link>
          </div>
          {agent.description && (
            <p className="text-sm text-white/50 mt-1.5 line-clamp-2">{agent.description}</p>
          )}
          <div className="flex gap-2 flex-wrap mt-2.5">
            <span className="liquid-glass rounded-full px-2.5 py-1 text-[10px] font-mono text-white/30">
              #{agent.agent_id}
            </span>
            <span className="liquid-glass rounded-full px-2.5 py-1 text-[10px] font-mono text-white/30">
              {shortAddr(agent.registry)}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] border ${
              agent.active ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-white/5 border-white/10 text-white/30"
            }`}>
              {agent.active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      {hasServices ? (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-white/30 px-1">AI Services</p>
          {mcpService && <EndpointRow service={mcpService} token={token} />}
          {a2aService && <EndpointRow service={a2aService} token={token} />}
        </div>
      ) : (
        <div className="liquid-glass rounded-2xl p-4 text-center">
          <p className="text-sm text-white/40">No AI services configured yet.</p>
          <Link href="/my-agents" className="text-xs text-amber-400 hover:text-amber-300 mt-1 inline-block">
            Add MCP / A2A endpoints in My Agents →
          </Link>
        </div>
      )}

      <div className="liquid-glass-strong rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <p className="text-[10px] uppercase tracking-widest text-white/40">Bearer Token</p>
            <span className="text-[10px] text-white/20">· valid 24 h</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTokenVisible(v => !v)}
              className="text-[10px] text-white/40 hover:text-white/70 liquid-glass rounded-full px-2.5 py-1 transition-colors"
            >
              {tokenVisible ? "Hide" : "Reveal"}
            </button>
            <CopyButton text={token} label="Copy token" />
          </div>
        </div>
        <div className="bg-black/30 rounded-xl px-3 py-2 font-mono text-[10px] text-white/40 break-all">
          {tokenVisible ? token : "••••••••••••••••••••••••••••••••••••••••"}
        </div>
        <p className="text-[10px] text-white/20">
          Pass as <span className="font-mono text-white/30">Authorization: Bearer &lt;token&gt;</span> to authenticate with MCP / A2A endpoints.
        </p>
      </div>

      {agentUri && (
        <div className="liquid-glass rounded-2xl px-4 py-3 flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-white/25 shrink-0" />
          <span className="font-mono text-[10px] text-white/40 truncate flex-1">{agentUri}</span>
          <CopyButton text={agentUri} label="Copy URI" />
          <a href={agentUri} target="_blank" rel="noopener noreferrer" className="text-white/25 hover:text-white/50 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      <a
        href={`/consult/?registry=${agent.registry}&agentId=${agent.agent_id}`}
        className="liquid-glass rounded-2xl px-4 py-3 flex items-center gap-2 hover:bg-white/5 transition-colors"
      >
        <Coins className="w-4 h-4 text-amber-300 shrink-0" />
        <span className="text-sm text-white/70 flex-1">Consult this agent</span>
        <span className="text-[10px] text-white/30">pay-per-task escrow</span>
      </a>
    </div>
  );
}

export default function UseAgentPage() {
  const { address, isConnected } = useAccount();
  const { open }                 = useWalletModal();
  const { disconnect }           = useDisconnect();
  const { signMessageAsync }     = useSignMessage();

  const tr       = usePageRecords("use-agent.dinamic.eth");
  const icon     = tr.icon;
  const avatar   = tr.avatar;
  const cardBg   = tr.card_bg;
  const videoUrl = tr.video;

  const [mounted,      setMounted]      = useState(false);
  const [ownerToken,   setOwnerToken]   = useState<string | null>(null);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  const [agents,       setAgents]       = useState<AgentRecord[]>([]);
  const [regCredits,   setRegCredits]   = useState<Record<string, number>>({});
  const [selected,     setSelected]     = useState<AgentRecord | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [signingIn,    setSigningIn]    = useState(false);
  const [signError,    setSignError]    = useState("");

  useEffect(() => {
    setMounted(true);
    const token = sessionStorage.getItem(OWNER_TOKEN_KEY);
    const addr  = sessionStorage.getItem(OWNER_ADDR_KEY);
    if (token && addr) { setOwnerToken(token); setOwnerAddress(addr); }
  }, []);

  const fetchAgents = useCallback(async (addr: string) => {
    setLoading(true);
    const data = await getMyAgents(addr);
    const list: AgentRecord[] = Array.isArray(data) ? data : [];
    setAgents(list);
    if (list.length === 1) setSelected(list[0]);
    // Fetch wallet credit balance for this owner
    try {
      const r = await fetch(`${GATEWAY_URL}/api/registry/wallet/${addr}/credits`);
      const d = await r.json();
      if (typeof d.credits === "number") setRegCredits({ __wallet: d.credits });
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (ownerToken && ownerAddress) fetchAgents(ownerAddress);
  }, [ownerToken, ownerAddress, fetchAgents]);

  useEffect(() => {
    if (!mounted) return;
    if (!isConnected || (ownerAddress && address?.toLowerCase() !== ownerAddress)) {
      sessionStorage.removeItem(OWNER_TOKEN_KEY);
      sessionStorage.removeItem(OWNER_ADDR_KEY);
      setOwnerToken(null); setOwnerAddress(null); setAgents([]); setSelected(null);
    }
  }, [isConnected, address, mounted, ownerAddress]);

  async function handleSignIn() {
    if (!address) return;
    setSigningIn(true); setSignError("");
    try {
      const nonce = await getAgentAuthNonce();
      const message = createSiweMessage({
        domain:    window.location.host,
        address:   address as Address,
        statement: "Sign in to use your ERC-8004 agent identity",
        uri:       window.location.origin,
        version:   "1",
        chainId:   REGISTRY_CHAIN_ID,
        nonce,
      });
      const signature = await signMessageAsync({ message });
      const result = await verifyAgentOwner(message, signature);
      sessionStorage.setItem(OWNER_TOKEN_KEY, result.token);
      sessionStorage.setItem(OWNER_ADDR_KEY, address.toLowerCase());
      setOwnerToken(result.token);
      setOwnerAddress(address.toLowerCase());
    } catch (e: any) {
      setSignError(e.message || "Sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }

  function handleSignOut() {
    sessionStorage.removeItem(OWNER_TOKEN_KEY);
    sessionStorage.removeItem(OWNER_ADDR_KEY);
    setOwnerToken(null); setOwnerAddress(null); setAgents([]); setSelected(null);
  }

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col font-display">
      <NavMenu currentPath="use-agent" />

      {videoUrl ? (
        <>
          <video src={videoUrl} autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover z-0" />
          <div className="fixed inset-0 z-0 bg-black/50" />
        </>
      ) : (
        <GradientBg />
      )}

      <nav className="relative z-10 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <Link href="/agents" className="text-white/40 hover:text-white/70 transition-colors text-sm">
            ← Agents
          </Link>
          <span className="text-white/20">·</span>
          <span className="text-sm font-semibold text-white/80">Use Your Agent</span>
        </div>
        <div className="flex items-center gap-2">
          {ownerToken && (
            <button
              onClick={handleSignOut}
              className="liquid-glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          )}
          {isConnected && address ? (
            <button
              onClick={() => disconnect()}
              className="liquid-glass rounded-full px-4 py-2 text-sm text-white/60 hover:text-white transition-colors font-mono"
            >
              {shortAddr(address)}
            </button>
          ) : (
            <button
              onClick={() => open()}
              className="liquid-glass-strong rounded-full px-5 py-2.5 flex items-center gap-2 text-sm font-medium text-white hover:scale-105 active:scale-95 transition-transform"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-8">
        {!isConnected && (
          <div className="liquid-glass-strong rounded-3xl p-10 text-center space-y-4">
            <Bot className="w-12 h-12 text-white/20 mx-auto" />
            <h1 className="text-2xl font-semibold text-white">Use Your Agent</h1>
            <p className="text-white/50 text-sm max-w-xs mx-auto">
              Connect your wallet to authenticate as an ERC-8004 agent owner and access AI services.
            </p>
            <button
              onClick={() => open()}
              className="liquid-glass-strong rounded-full px-6 py-3 flex items-center gap-2 text-sm font-medium text-white mx-auto hover:scale-105 active:scale-95 transition-transform"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          </div>
        )}

        {isConnected && !ownerToken && (
          <div className="liquid-glass-strong rounded-3xl p-10 text-center space-y-4">
            <Zap className="w-12 h-12 text-yellow-400/60 mx-auto" />
            <h1 className="text-2xl font-semibold text-white">Sign In as Agent Owner</h1>
            <p className="text-white/50 text-sm max-w-xs mx-auto">
              Sign a message to prove ownership of your agent NFT and get a session token for MCP / A2A access.
            </p>
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="liquid-glass-strong rounded-full px-6 py-3 flex items-center gap-2 text-sm font-medium text-white mx-auto hover:scale-105 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {signingIn ? "Signing…" : "Sign in with Wallet"}
            </button>
            {signError && (
              <p className="text-xs text-red-400">{signError}</p>
            )}
          </div>
        )}

        {ownerToken && (
          <>
            {loading && (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-white/30" />
              </div>
            )}

            {!loading && agents.length === 0 && (
              <div className="liquid-glass-strong rounded-3xl p-10 text-center space-y-4">
                <Bot className="w-12 h-12 text-white/20 mx-auto" />
                <p className="text-white/50">No agents found for this wallet.</p>
                <Link
                  href="/agent"
                  className="liquid-glass-strong rounded-full px-6 py-3 inline-flex items-center gap-2 text-sm font-medium text-white hover:scale-105 transition-transform"
                >
                  Mint your first agent →
                </Link>
              </div>
            )}

            {!loading && agents.length > 1 && !selected && (
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-white/40 px-1">Select an Agent</p>
                {agents.map(a => (
                  <button
                    key={`${a.registry}-${a.agent_id}`}
                    onClick={() => setSelected(a)}
                    className="w-full liquid-glass-strong rounded-2xl p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-white/4">
                      {a.image ? (
                        <img src={a.image} alt={a.name} className="w-full h-full object-cover" />
                      ) : (
                        <Bot className="w-5 h-5 text-white/20 m-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{a.name}</p>
                      <p className="text-xs text-white/40 font-mono">#{a.agent_id} · {shortAddr(a.registry)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {a.services.find(s => s.name === "MCP") && (
                        <span className="rounded-full px-2 py-0.5 text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-300">MCP</span>
                      )}
                      {a.services.find(s => s.name === "A2A") && (
                        <span className="rounded-full px-2 py-0.5 text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-300">A2A</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!loading && selected && (
              <div className="space-y-4">
                {agents.length > 1 && (
                  <button
                    onClick={() => setSelected(null)}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    ← All agents
                  </button>
                )}
                {(() => {
                  const bal = regCredits["__wallet"];
                  if (typeof bal !== "number") return null;
                  const topupHref = `../top-up/?address=${selected.owner_address}`;
                  if (bal === 0) return (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 mb-3">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span className="flex-1">Your wallet has <strong>0 credits</strong> — AI chat is paused.</span>
                      <a href={topupHref}
                        className="shrink-0 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-full px-3 py-1 font-medium transition-colors">
                        Top up →
                      </a>
                    </div>
                  );
                  if (bal < 50) return (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 mb-3">
                      <Zap className="w-4 h-4 shrink-0" />
                      <span className="flex-1">Low credits — <strong>{bal}</strong> in your wallet.</span>
                      <a href={topupHref}
                        className="shrink-0 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-full px-3 py-1 font-medium transition-colors">
                        Top up →
                      </a>
                    </div>
                  );
                  return null;
                })()}
                <AgentCard agent={selected} token={ownerToken} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
