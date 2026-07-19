"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { ShieldCheck, ArrowUpRight, Wallet, ChevronLeft, ChevronRight, LogIn, LogOut, Loader2, Radio } from "lucide-react";
import { buildLiveRecord, stashLiveRecord } from "@/lib/liveRecord";
import { AgentChat } from "@/components/AgentChat";
import { McpLogo } from "@/components/McpLogo";
import { buildMcpCards, buildCardsFromIds, DEMO_AGENT, type McpCard, type PublicMcp } from "@/lib/mcps";
import { useWalletModal } from "@/hooks/useWalletModal";
import { getAgentAuthNonce, verifyAgentOwner } from "@/lib/api";

const TOKEN_KEY = "ens-kit-admin-token";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const RKB = (process.env.NEXT_PUBLIC_GENESIS_REGISTRY_ADDRESS || "0x8b5AF3A59f81c7e16617E8Eb824BC6FfB792A2C3").toLowerCase();
const RPC = process.env.NEXT_PUBLIC_MAINNET_RPC || "https://ethereum-rpc.publicnode.com";

const pub = createPublicClient({ chain: mainnet, transport: http(RPC) });
const TOKENURI_ABI = [{
  type: "function", name: "tokenURI", stateMutability: "view",
  inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "string" }],
}] as const;

type OwnedAgent = { registry: string; agent_id: string; name: string; image: string; description?: string };

// Read an RKB agent's selected tools straight from its on-chain tokenURI metadata.
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

export default function DemoPage() {
  const sendRef = useRef<((payload: string, display?: string) => void) | null>(null);
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { open: openWallet } = useWalletModal();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // Restore a non-expired sign-in token.
  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      if (!t) return;
      const p = JSON.parse(atob(t.split(".")[1]));
      if (!p.exp || p.exp > Date.now() / 1000) setToken(t); else localStorage.removeItem(TOKEN_KEY);
    } catch { localStorage.removeItem(TOKEN_KEY); }
  }, []);

  // Sign in with the WAGMI-connected wallet (not raw window.ethereum) so the token's
  // address always matches the connected account that owns the agents + credits.
  const signIn = async () => {
    if (!address) return;
    setSigningIn(true);
    try {
      const nonce = await getAgentAuthNonce();
      const message = [
        `${window.location.host} wants you to sign in with your Ethereum account:`,
        address, "", "Sign in to drive your agents", "",
        `URI: ${window.location.origin}`, "Version: 1", "Chain ID: 1",
        `Nonce: ${nonce}`, `Issued At: ${new Date().toISOString()}`,
      ].join("\n");
      const signature = await signMessageAsync({ message });
      const { token: jwt } = await verifyAgentOwner(message, signature);
      localStorage.setItem(TOKEN_KEY, jwt);
      setToken(jwt);
    } catch (e) { console.error("sign-in failed", e); autoSignRef.current = false; } // allow a dismissed prompt to be retried
    finally { setSigningIn(false); }
  };

  const autoSignRef = useRef(false);
  const disconnectWallet = () => { localStorage.removeItem(TOKEN_KEY); setToken(null); disconnect(); setMyAgents([]); setAi(0); autoSignRef.current = false; };

  const [fallbackCards, setFallbackCards] = useState<McpCard[]>([]); // Bulla Goblin (public toolbox)
  const [myAgents, setMyAgents] = useState<OwnedAgent[]>([]);
  const [ai, setAi] = useState(0);                                   // active owned-agent index
  const [cards, setCards] = useState<McpCard[]>([]);                 // tools of the featured agent
  const [lastExchange, setLastExchange] = useState<{ query: string; reply: string } | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeErr, setRecomputeErr] = useState<string | null>(null);

  // Bulla Goblin's toolbox (the walletless showcase default).
  useEffect(() => {
    fetch(`${GW_URL}/agent/public-mcps`).then((r) => (r.ok ? r.json() : []))
      .then((mcps: PublicMcp[]) => setFallbackCards(buildMcpCards(mcps))).catch(() => setFallbackCards([]));
  }, []);

  // On connect → the wallet's Recompute Kit Bots.
  useEffect(() => {
    if (!address) { setMyAgents([]); return; }
    fetch(`${GW_URL}/agent/owned/${address}`).then((r) => (r.ok ? r.json() : []))
      .then((all: OwnedAgent[]) => {
        setMyAgents((all || []).filter((a) => a.registry.toLowerCase() === RKB));
        setAi(0);
      })
      .catch(() => setMyAgents([]));
  }, [address]);

  // Once you connect and have agents to drive, prompt the one SIWE signature
  // automatically — so it's a single signature, not connect-then-hunt-for-signin.
  useEffect(() => {
    if (address && myAgents.length > 0 && !token && !signingIn && !autoSignRef.current) {
      autoSignRef.current = true;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      signIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, myAgents.length, token]);

  const active = myAgents.length ? myAgents[ai] : null;          // an RKB agent, or null → default
  const isRkb = !!active;

  const featured = active
    ? { registry: RKB, agentId: active.agent_id, name: active.name || `Bot #${active.agent_id}`, image: active.image, by: "Recompute Kit Bots", sub: `#${active.agent_id} · RKB` }
    : { registry: DEMO_AGENT.registry, agentId: DEMO_AGENT.agentId, name: DEMO_AGENT.name, image: DEMO_AGENT.image, by: DEMO_AGENT.by, sub: DEMO_AGENT.ens };

  // Featured agent's tools: per-agent (from metadata) for RKB, else the public toolbox.
  useEffect(() => {
    if (!active) { setCards(fallbackCards); return; }
    fetchAgentMcps(active.agent_id).then((ids) => setCards(ids.length ? buildCardsFromIds(ids) : []));
  }, [active, fallbackCards]);

  const pick = (c: McpCard) => sendRef.current?.(c.prompt, c.display);
  const cycle = (d: number) => setAi((i) => (i + d + myAgents.length) % myAgents.length);

  // New agent selected → drop the stale "recompute last action" offer.
  useEffect(() => { setLastExchange(null); setRecomputeErr(null); }, [featured.registry, featured.agentId]);

  // Recompute the action the agent just took — builds the full record from the live
  // exchange + on-chain attestation, stashes it, and opens /verify in real-time mode.
  const recomputeLast = async () => {
    if (!lastExchange) return;
    setRecomputing(true); setRecomputeErr(null);
    const rec = await buildLiveRecord(
      { ens: featured.name, agentId: featured.agentId, registry: featured.registry },
      lastExchange.query, lastExchange.reply,
    );
    if (rec) { stashLiveRecord(rec); window.location.href = "/verify?live=1"; return; }
    setRecomputeErr("The attestation is still landing on-chain — give it a couple seconds and retry.");
    setRecomputing(false);
  };

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/demo" className="font-display font-medium tracking-tight text-paper">Verifiable Agents</Link>
          <div className="flex items-center gap-5">
            <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Home</Link>
            <Link href="/mint" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Mint</Link>
            <Link href="/A2A" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">A2A</Link>
            <Link href="/marketplace" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Marketplace</Link>
            {isRkb && <Link href="/consult" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Configure</Link>}
            <Link href="/verify" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80 hover:text-brassLight">
              <ShieldCheck className="h-3.5 w-3.5" /> Verify
            </Link>
            <span className="w-px h-4 bg-white/12" aria-hidden />
            {!address ? (
              <button onClick={openWallet} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/90 hover:text-brassLight">
                <Wallet className="h-3.5 w-3.5" /> Connect
              </button>
            ) : (
              <div className="flex items-center gap-3">
                {isRkb && (token ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400/70" title="Signed in — chatting with your agents">
                    <ShieldCheck className="h-3.5 w-3.5" /> Signed in
                  </span>
                ) : (
                  <button onClick={signIn} disabled={signingIn} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/90 hover:text-brassLight disabled:opacity-50">
                    {signingIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />} {signingIn ? "Signing in…" : "Sign in"}
                  </button>
                ))}
                <span className="font-mono text-[11px] text-gb-faint">{address.slice(0, 6)}…{address.slice(-4)}</span>
                <button onClick={disconnectWallet} title="Disconnect" aria-label="Disconnect" className="inline-flex items-center text-gb-muted hover:text-red-400 transition-colors">
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {address && !isRkb && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-gb-muted">
            No Recompute Kit Bots in this wallet yet — <Link href="/mint" className="text-brassLight hover:text-brass">mint one</Link> and it appears here.
          </div>
        )}

        {/* Agent header — avatar left of the title */}
        <div className="mt-6 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={featured.image} src={featured.image} alt={featured.name}
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border border-white/10 object-cover shrink-0"
            style={{ imageRendering: "pixelated" }} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">
              Live agent · {featured.by}{isRkb && myAgents.length > 1 ? ` · ${ai + 1} of ${myAgents.length}` : ""}
            </p>
            <div className="mt-1 flex items-center gap-3">
              {isRkb && myAgents.length > 1 && (
                <button onClick={() => cycle(-1)} aria-label="Previous agent"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              <h1 className="font-display font-medium tracking-tightest text-4xl sm:text-5xl truncate">{featured.name}</h1>
              {isRkb && myAgents.length > 1 && (
                <button onClick={() => cycle(1)} aria-label="Next agent"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-gb-faint truncate">{featured.sub}</p>
          </div>
        </div>

        {/* MCP selectors */}
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">
          {isRkb ? "Its tools — chosen at mint" : "Its tools — hover to learn, click to watch it run"}
        </p>
        <p className="mt-1 text-[11px] text-brassLight/80">
          Every capability is a <span className="font-medium">premium</span> MCP — bought and carried by the agent NFT in production, unlocked here as a demo bonus.
        </p>
        {cards.length === 0 ? (
          <p className="mt-3 text-[12px] text-gb-faint">{isRkb ? "This agent was minted with no tools selected." : "Loading tools…"}</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cards.map((c) => (
              <div key={c.id} className="relative group">
                <button
                  onClick={() => pick(c)}
                  className="relative flex w-full h-full flex-col overflow-hidden rounded-2xl border border-brassLight/20 bg-white/[0.03] p-4 text-left shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-brassLight/60 hover:bg-white/[0.06] hover:shadow-[0_14px_34px_-14px_rgba(198,160,90,0.5)] motion-reduce:transform-none motion-reduce:transition-none"
                >
                  {/* premium marker — gold glow dot (all demo capabilities are premium) */}
                  <span title="Premium MCP" className="pointer-events-none absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-brassLight/70 shadow-[0_0_8px_2px_rgba(198,160,90,0.5)]" />
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 border border-brass/25 transition-colors group-hover:border-brassLight/50">
                    <McpLogo card={c} className="h-6 w-6" fill />
                  </span>
                  <p className="mt-3 font-display font-medium text-paper flex items-center gap-1">
                    {c.label}
                    <ArrowUpRight className="h-3.5 w-3.5 text-brassLight/70 opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 motion-reduce:transform-none motion-reduce:transition-none" />
                  </p>
                  {/* tagline slides in on hover — fixed height reserved so the lift never reflows the grid */}
                  <p className="mt-0.5 h-8 text-[11px] leading-snug text-gb-faint opacity-0 translate-y-1.5 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none motion-reduce:opacity-100">
                    {c.tagline}
                  </p>
                </button>
                <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <div className="rounded-xl border border-white/10 bg-deepink/95 px-3 py-2.5 text-[11px] italic leading-relaxed text-gb-muted shadow-xl backdrop-blur">{c.blurb}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat — remounts per agent so each has a fresh session */}
        <div className="mt-6 liquid-glass rounded-2xl overflow-hidden h-[560px] p-4">
          <AgentChat
            key={`${featured.registry}-${featured.agentId}`}
            registry={featured.registry}
            agentId={featured.agentId}
            {...(isRkb ? { ownerAddress: address, authToken: token ?? undefined } : {})}
            onReady={(send) => { sendRef.current = send; }}
            onExchange={(query, reply) => setLastExchange({ query, reply })}
          />
        </div>

        {/* Recompute the action it JUST took — the real-time proof */}
        {lastExchange ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.04] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-paper flex items-center gap-1.5 font-display font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> That action was attested on-chain.
              </p>
              <p className="text-[12px] text-gb-muted mt-0.5">Recompute all five checks — input, provenance, output, signature, and the on-chain anchor — for the reply you just got. Not a saved demo; the one you watched.</p>
              {recomputeErr && <p className="text-[11px] text-brass/80 mt-1.5">{recomputeErr}</p>}
            </div>
            <button onClick={recomputeLast} disabled={recomputing}
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-brass hover:bg-brassLight text-deepink font-display font-medium text-sm px-5 py-2.5 disabled:opacity-50 transition-colors">
              {recomputing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
              {recomputing ? "Building record…" : "Recompute this action (5/5)"}
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-white/8 p-4 text-sm text-gb-muted">
            Every action this agent takes is attested on-chain. Send it a message or run a tool — then{" "}
            <span className="text-brassLight">recompute that exact action yourself</span>, input to on-chain anchor, all in your browser.
          </div>
        )}
      </div>
    </main>
  );
}
