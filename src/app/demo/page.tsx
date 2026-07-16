"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useDisconnect } from "wagmi";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { ShieldCheck, ArrowUpRight, Wallet, ChevronLeft, ChevronRight, LogIn, LogOut } from "lucide-react";
import { AgentChat } from "@/components/AgentChat";
import { McpLogo } from "@/components/McpLogo";
import { buildMcpCards, buildCardsFromIds, DEMO_AGENT, type McpCard, type PublicMcp } from "@/lib/mcps";
import { useWalletModal } from "@/hooks/useWalletModal";
import { useAuth } from "@/hooks/useAuth";

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
  const { token, login, logout } = useAuth();

  const disconnectWallet = () => { logout(); disconnect(); setMyAgents([]); setAi(0); };

  const [fallbackCards, setFallbackCards] = useState<McpCard[]>([]); // Bulla Goblin (public toolbox)
  const [myAgents, setMyAgents] = useState<OwnedAgent[]>([]);
  const [ai, setAi] = useState(0);                                   // active owned-agent index
  const [cards, setCards] = useState<McpCard[]>([]);                 // tools of the featured agent

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

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display font-medium tracking-tight text-paper">Verifiable Agents</Link>
          <div className="flex items-center gap-5">
            {!address ? (
              <button onClick={openWallet} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/90 hover:text-brassLight">
                <Wallet className="h-3.5 w-3.5" /> Connect
              </button>
            ) : (
              <div className="flex items-center gap-3">
                {isRkb && !token && (
                  <button onClick={() => login()} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/90 hover:text-brassLight">
                    <LogIn className="h-3.5 w-3.5" /> Sign in
                  </button>
                )}
                <span className="font-mono text-[11px] text-gb-faint">{address.slice(0, 6)}…{address.slice(-4)}</span>
                <button onClick={disconnectWallet} title="Disconnect" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-red-400 transition-colors">
                  <LogOut className="h-3.5 w-3.5" /> Disconnect
                </button>
              </div>
            )}
            <Link href={`/consult/?registry=${featured.registry}&agentId=${featured.agentId}`} className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Consult</Link>
            <Link href="/verify" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80 hover:text-brassLight">
              <ShieldCheck className="h-3.5 w-3.5" /> Verify
            </Link>
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
        {cards.length === 0 ? (
          <p className="mt-3 text-[12px] text-gb-faint">{isRkb ? "This agent was minted with no tools selected." : "Loading tools…"}</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cards.map((c) => (
              <div key={c.id} className="relative group">
                <button onClick={() => pick(c)} className="liquid-glass w-full h-full group/btn rounded-2xl p-4 text-left transition-colors hover:border-brassLight/40">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                    <McpLogo card={c} className="h-6 w-6" />
                  </span>
                  <p className="mt-3 font-display font-medium text-paper flex items-center gap-1">
                    {c.label}
                    <ArrowUpRight className="h-3.5 w-3.5 text-gb-faint transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                  </p>
                  <p className="mt-0.5 text-[11px] text-gb-faint">{c.tagline}</p>
                </button>
                <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <div className="rounded-xl border border-white/10 bg-deepink/95 px-3 py-2.5 text-[11px] italic leading-relaxed text-gb-muted shadow-xl backdrop-blur">{c.blurb}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat — remounts per agent so each has a fresh session */}
        <div className="mt-6 liquid-glass rounded-2xl overflow-hidden">
          <AgentChat
            key={`${featured.registry}-${featured.agentId}`}
            registry={featured.registry}
            agentId={featured.agentId}
            {...(isRkb ? { ownerAddress: address, authToken: token ?? undefined } : {})}
            onReady={(send) => { sendRef.current = send; }}
          />
        </div>

        {/* Verify note */}
        <div className="mt-4 rounded-xl border border-white/8 p-4 text-sm text-gb-muted">
          Every action this agent takes is attested on-chain. When it runs a tool, you can{" "}
          <Link href="/verify" className="text-brassLight hover:text-brass">recompute the attestation yourself</Link> —
          input, output, and the on-chain anchor, all verified in your browser.
        </div>
      </div>
    </main>
  );
}
