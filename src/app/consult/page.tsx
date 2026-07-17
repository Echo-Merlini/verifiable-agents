"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { createPublicClient, http, parseEther, formatEther } from "viem";
import { mainnet } from "viem/chains";
import { Bot, Wallet, Loader2, Coins, ShieldCheck, Clock, Check, ChevronLeft, ChevronRight, LogOut, LogIn, Rocket, Save } from "lucide-react";
import { GATEWAY_URL } from "@/lib/erc8004";
import { useWalletModal } from "@/hooks/useWalletModal";
import { McpLogo } from "@/components/McpLogo";
import { buildCardsFromIds, type McpCard } from "@/lib/mcps";
import { getNonce, verifySiwe } from "@/lib/api";

const TOKEN_KEY = "ens-kit-admin-token";
const RKB = (process.env.NEXT_PUBLIC_GENESIS_REGISTRY_ADDRESS || "0x8b5AF3A59f81c7e16617E8Eb824BC6FfB792A2C3").toLowerCase();
const RPC = process.env.NEXT_PUBLIC_MAINNET_RPC || "https://ethereum-rpc.publicnode.com";

const pub = createPublicClient({ chain: mainnet, transport: http(RPC) });
const TOKENURI_ABI = [{
  type: "function", name: "tokenURI", stateMutability: "view",
  inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "string" }],
}] as const;

type OwnedAgent = { registry: string; agent_id: string; name: string; image: string; description?: string };
type Pricing = { consultPrice?: string; completionWindow?: number; consultTools?: string[]; consultEnabled?: boolean };

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

function fmtHours(s?: number) { if (!s) return "—"; const h = s / 3600; return h >= 1 ? `${h}h` : `${Math.round(s / 60)}m`; }

function ConsultInner() {
  useSearchParams(); // keep the Suspense boundary consistent with the client-nav shell
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { open: openWallet } = useWalletModal();
  const { signMessageAsync } = useSignMessage();

  const [token, setToken] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [myAgents, setMyAgents] = useState<OwnedAgent[]>([]);
  const [ai, setAi] = useState(0);

  // Config form state (loaded per active agent)
  const [minted, setMinted] = useState<McpCard[]>([]);   // the agent's minted tools
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});
  const [isFree, setIsFree] = useState(false);
  const [priceEth, setPriceEth] = useState("0.0002");
  const [windowH, setWindowH] = useState(1);
  const [published, setPublished] = useState(false);
  const [loadingCfg, setLoadingCfg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Restore a non-expired sign-in token.
  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      if (!t) return;
      const p = JSON.parse(atob(t.split(".")[1]));
      if (!p.exp || p.exp > Date.now() / 1000) setToken(t); else localStorage.removeItem(TOKEN_KEY);
    } catch { localStorage.removeItem(TOKEN_KEY); }
  }, []);

  const signIn = useCallback(async () => {
    if (!address) return;
    setSigningIn(true);
    try {
      const nonce = await getNonce();
      const message = [
        `${window.location.host} wants you to sign in with your Ethereum account:`,
        address, "", "Sign in to ENS Offchain Kit Admin", "",
        `URI: ${window.location.origin}`, "Version: 1", "Chain ID: 1",
        `Nonce: ${nonce}`, `Issued At: ${new Date().toISOString()}`,
      ].join("\n");
      const signature = await signMessageAsync({ message });
      const { token: jwt } = await verifySiwe(message, signature);
      localStorage.setItem(TOKEN_KEY, jwt);
      setToken(jwt);
    } catch (e) { console.error("sign-in failed", e); }
    finally { setSigningIn(false); }
  }, [address, signMessageAsync]);

  const disconnectWallet = () => { localStorage.removeItem(TOKEN_KEY); setToken(null); disconnect(); setMyAgents([]); setAi(0); };

  // Owned RKB agents (the connection persists across pages).
  useEffect(() => {
    if (!address) { setMyAgents([]); return; }
    fetch(`${GATEWAY_URL}/agent/owned/${address}`).then((r) => (r.ok ? r.json() : []))
      .then((all: OwnedAgent[]) => { setMyAgents((all || []).filter((a) => a.registry.toLowerCase() === RKB)); setAi(0); })
      .catch(() => setMyAgents([]));
  }, [address]);

  const active = myAgents.length ? myAgents[ai] : null;
  const cycle = (d: number) => setAi((i) => (i + d + myAgents.length) % myAgents.length);

  // Load the active agent's minted tools + current consult config.
  useEffect(() => {
    if (!active) { setMinted([]); return; }
    setLoadingCfg(true); setSaved(false); setErr(null);
    (async () => {
      const [ids, card] = await Promise.all([
        fetchAgentMcps(active.agent_id),
        fetch(`${GATEWAY_URL}/.well-known/agent/${RKB}/${active.agent_id}.json`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      setMinted(buildCardsFromIds(ids));
      const p: Pricing = card?.pricing ?? {};
      const already = Array.isArray(p.consultTools) && p.consultTools.length ? p.consultTools : ids; // default: all minted tools
      setEnabledTools(Object.fromEntries(ids.map((id) => [id, already.includes(id)])));
      const priceWei = p.consultPrice ?? "0";
      const free = (() => { try { return BigInt(priceWei) === 0n; } catch { return true; } })();
      setIsFree(free);
      setPriceEth(free ? "0.0002" : (() => { try { return formatEther(BigInt(priceWei)); } catch { return "0.0002"; } })());
      setWindowH(p.completionWindow ? Math.max(1, Math.round(p.completionWindow / 3600)) : 1);
      setPublished(!!p.consultEnabled);
      setLoadingCfg(false);
    })();
  }, [active]);

  const chosenTools = Object.entries(enabledTools).filter(([, v]) => v).map(([k]) => k);

  async function save(publish: boolean) {
    if (!active) return;
    let t = token;
    if (!t) { await signIn(); t = localStorage.getItem(TOKEN_KEY); if (!t) { setErr("Sign-in required to save."); return; } }
    setSaving(true); setSaved(false); setErr(null);
    try {
      const consult_price = isFree ? "0" : parseEther((priceEth || "0") as `${number}`).toString();
      const body = {
        consult_price,
        completion_window: Math.max(1, windowH) * 3600,
        consult_tools: chosenTools,
        consult_enabled: publish,
      };
      const r = await fetch(`${GATEWAY_URL}/agent/${RKB}/${active.agent_id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error ? JSON.stringify(data.error) : `save failed (${r.status})`);
      setPublished(publish);
      setSaved(true);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <div className="max-w-xl mx-auto px-6 py-8 space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/demo" className="font-display font-medium tracking-tight text-paper">Verifiable Agents</Link>
          <div className="flex items-center gap-4">
            {!address ? (
              <button onClick={openWallet} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/90 hover:text-brassLight">
                <Wallet className="h-3.5 w-3.5" /> Connect
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-gb-faint">{address.slice(0, 6)}…{address.slice(-4)}</span>
                <button onClick={disconnectWallet} title="Disconnect" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-red-400 transition-colors">
                  <LogOut className="h-3.5 w-3.5" /> Disconnect
                </button>
              </div>
            )}
            <Link href="/A2A" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">A2A</Link>
            <Link href="/verify" className="font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80 hover:text-brassLight">Verify</Link>
          </div>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">Consult configuration</p>
          <p className="text-sm text-paper/50 mt-1">Publish your agent as an A2A service — set its price and which of its tools a paid consult may use.</p>
        </div>

        {!address ? (
          <div className="liquid-glass rounded-2xl p-8 text-center space-y-3">
            <Wallet className="w-7 h-7 text-brassLight mx-auto" />
            <p className="text-sm text-paper/60">Connect the wallet that owns your Recompute Kit Bots to configure their consult service.</p>
            <button onClick={openWallet} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brass hover:bg-brassLight text-deepink font-display font-medium transition-colors">
              <Wallet className="w-4 h-4" /> Connect wallet
            </button>
          </div>
        ) : myAgents.length === 0 ? (
          <div className="liquid-glass rounded-2xl p-8 text-center space-y-2">
            <Bot className="w-7 h-7 text-paper/30 mx-auto" />
            <p className="text-sm text-paper/60">No Recompute Kit Bots in this wallet yet.</p>
            <Link href="/mint" className="text-brassLight hover:text-brass text-sm">Mint one →</Link>
          </div>
        ) : (
          <>
            {/* Agent selector */}
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
              <div className="flex gap-4 items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={active!.image} alt={active!.name} className="w-16 h-16 rounded-2xl object-cover border border-white/10 shrink-0" style={{ imageRendering: "pixelated" }} />
                <div className="flex-1 min-w-0">
                  <h1 className="font-display font-medium text-paper text-lg leading-tight truncate">{active!.name}</h1>
                  <p className="text-[11px] text-paper/40 font-mono mt-0.5">#{active!.agent_id} · RKB</p>
                  <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full ${published ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-paper/40"}`}>
                    <Rocket className="w-2.5 h-2.5" /> {published ? "Listed on A2A" : "Not listed"}
                  </span>
                </div>
              </div>
            </div>

            {loadingCfg ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-paper/30" /></div>
            ) : (
              <>
                {/* Pricing */}
                <div className="liquid-glass rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2"><Coins className="w-4 h-4 text-brassLight" /><p className="text-[10px] uppercase tracking-widest text-paper/40">Price</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => setIsFree(false)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-display transition-colors ${!isFree ? "bg-brass/20 border border-brassLight/40 text-paper" : "liquid-glass text-paper/50"}`}>Paid</button>
                    <button onClick={() => setIsFree(true)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-display transition-colors ${isFree ? "bg-emerald-400/15 border border-emerald-300/40 text-emerald-200" : "liquid-glass text-paper/50"}`}>Free</button>
                  </div>
                  {!isFree && (
                    <div className="flex gap-3">
                      <label className="flex-1 block">
                        <span className="text-[10px] uppercase tracking-widest text-paper/40">Consult price (ETH)</span>
                        <input type="number" step="0.0001" min="0" value={priceEth} onChange={(e) => setPriceEth(e.target.value)}
                          className="mt-1 w-full rounded-xl bg-black/25 border border-white/10 px-3 py-2 text-sm font-mono text-paper outline-none focus:border-brassLight/50" />
                      </label>
                      <label className="w-28 block">
                        <span className="text-[10px] uppercase tracking-widest text-paper/40">Deliver (h)</span>
                        <input type="number" step="1" min="1" value={windowH} onChange={(e) => setWindowH(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl bg-black/25 border border-white/10 px-3 py-2 text-sm font-mono text-paper outline-none focus:border-brassLight/50" />
                      </label>
                    </div>
                  )}
                  <p className="text-[11px] text-paper/35 leading-relaxed">
                    {isFree
                      ? "Anyone can consult this agent for free — no escrow, just a direct connection."
                      : `A caller stakes ${priceEth || "0"} ETH into ConsultEscrow; you're paid on delivery, they refund after ${windowH}h. A platform min-fee covers compute.`}
                  </p>
                </div>

                {/* Consult tools */}
                <div className="liquid-glass rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brassLight" /><p className="text-[10px] uppercase tracking-widest text-paper/40">Tools available for consult</p><span className="ml-auto text-[10px] text-paper/25">{chosenTools.length}/{minted.length}</span></div>
                  <p className="text-[11px] text-paper/35">Pick which of the tools this agent was minted with a paid consult may use.</p>
                  {minted.length === 0 ? (
                    <p className="text-[12px] text-paper/40">This agent was minted with no tools.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {minted.map((m) => (
                        <button key={m.id} onClick={() => setEnabledTools((a) => ({ ...a, [m.id]: !a[m.id] }))}
                          className="w-full flex items-center gap-2.5 text-left liquid-glass rounded-xl px-3 py-2 hover:bg-white/5 transition-colors">
                          <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${enabledTools[m.id] ? "bg-brass/25 border-brassLight/50" : "border-white/20"}`}>
                            {enabledTools[m.id] && <Check className="w-3 h-3 text-brass" />}
                          </span>
                          <McpLogo card={m} className="h-5 w-5 shrink-0" />
                          <span className="min-w-0">
                            <span className="text-xs text-paper/70 font-medium">{m.label}</span>
                            <span className="block text-[10px] text-paper/35 line-clamp-1">{m.tagline}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Save / Publish */}
                <div className="flex gap-2">
                  <button onClick={() => save(published)} disabled={saving || signingIn}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl liquid-glass hover:bg-white/5 disabled:opacity-40 text-paper font-display font-medium transition-colors">
                    {saving && !published ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                  </button>
                  <button onClick={() => save(true)} disabled={saving || signingIn || chosenTools.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-brass hover:bg-brassLight disabled:opacity-40 text-deepink font-display font-medium transition-colors">
                    {saving && published ? <Loader2 className="w-4 h-4 animate-spin" /> : signingIn ? <LogIn className="w-4 h-4" /> : <Rocket className="w-4 h-4" />}
                    {published ? "Update listing" : "Publish to A2A"}
                  </button>
                </div>
                {chosenTools.length === 0 && <p className="text-[10px] text-center text-paper/30">Select at least one tool to publish.</p>}
                {saved && <p className="text-[11px] text-center text-emerald-300 flex items-center justify-center gap-1"><Check className="w-3.5 h-3.5" /> Saved{published ? " · live on the A2A marketplace" : ""}</p>}
                {err && <p className="text-[11px] text-center text-red-300">{err}</p>}
                {published && (
                  <p className="text-[11px] text-center text-paper/30 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" /> {isFree ? "Free" : `${priceEth} ETH`} · deliver within {fmtHours(Math.max(1, windowH) * 3600)} ·{" "}
                    <Link href="/A2A" className="text-brassLight hover:text-brass">view on A2A →</Link>
                  </p>
                )}
              </>
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
