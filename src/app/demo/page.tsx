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
import { VerticeMark } from "@/components/VerticeMark";
import { TopNav } from "@/components/TopNav";
import { buildMcpCards, buildCardsFromIds, ENTITLEMENT_SLUG_TO_CARD_ID, DEMO_AGENT, type McpCard, type PublicMcp } from "@/lib/mcps";
import { useWalletModal } from "@/hooks/useWalletModal";
import { getAgentAuthNonce, verifyAgentOwner } from "@/lib/api";
import { tagPillClass, fetchReputation, type Reputation } from "@/lib/marketplace";
import { ReputationBadge } from "@/components/ReputationBadge";
import { fetchIpfs } from "@/lib/ipfs";

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

// Read an agent's selected tools straight from its on-chain tokenURI metadata.
// Reads the agent's OWN registry: reading every agent from RKB returns another token's
// metadata, or reverts, for any agent held in a different collection.
async function fetchAgentMcps(registry: string, agentId: string): Promise<string[]> {
  try {
    const uri = (await pub.readContract({
      address: registry as `0x${string}`, abi: TOKENURI_ABI, functionName: "tokenURI", args: [BigInt(agentId)],
    })) as string;
    const j = await (await fetchIpfs(uri)).json();
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
  const trackRef = useRef<HTMLDivElement>(null);                     // MCP carousel scroll track
  const [hoverMcp, setHoverMcp] = useState<McpCard | null>(null);    // capability described below the carousel
  const [mcpTags, setMcpTags] = useState<Record<string, string[]>>({}); // mcp_server id → taxonomy tags
  const [lastExchange, setLastExchange] = useState<{ query: string; reply: string } | null>(null);
  const [recomputing, setRecomputing] = useState<"user" | "agent" | null>(null);
  const [recomputeErr, setRecomputeErr] = useState<string | null>(null);
  const [rep, setRep] = useState<Reputation | null>(null);   // recomputable reputation of the featured agent
  const [agentEns, setAgentEns] = useState<string | null>(null); // the agent's ENSIP-25 ENS name

  // Bulla Goblin's toolbox (the walletless showcase default).
  useEffect(() => {
    fetch(`${GW_URL}/agent/public-mcps`).then((r) => (r.ok ? r.json() : []))
      .then((mcps: PublicMcp[]) => setFallbackCards(buildMcpCards(mcps))).catch(() => setFallbackCards([]));
  }, []);

  // Taxonomy tags per tool (mcp_server id → tags), so each loadout card shows its categories.
  useEffect(() => {
    fetch(`${GW_URL}/marketplace/mcp-tags`).then((r) => (r.ok ? r.json() : {}))
      .then((m: Record<string, string[]>) => setMcpTags(m || {})).catch(() => setMcpTags({}));
  }, []);

  // Premium first, Community second, rest after — the shared ordering.
  const orderTags = (tags: string[]) => {
    const rank = (t: string) => (t.toLowerCase() === "premium" ? 0 : t.toLowerCase() === "community" ? 1 : 2);
    return [...tags].sort((a, b) => rank(a) - rank(b));
  };

  // On connect → the wallet's Recompute Kit Bots.
  useEffect(() => {
    if (!address) {
      setMyAgents([]);
      // signed out via the shared header → drop the demo session token too
      localStorage.removeItem(TOKEN_KEY); setToken(null); autoSignRef.current = false;
      return;
    }
    fetch(`${GW_URL}/agent/owned/${address}`).then((r) => (r.ok ? r.json() : []))
      .then((all: OwnedAgent[]) => {
        // Every agent this wallet holds, in any registry. Connecting a wallet should give you
        // your agents; filtering to RKB dropped 8 of 9 for a wallet whose other agents were
        // held in NFT-derived registries, with no indication any had been hidden.
        // Genesis first, so the primary bots still lead the carousel.
        const owned = [...(all || [])].sort((a, b) =>
          (a.registry.toLowerCase() === RKB ? 0 : 1) - (b.registry.toLowerCase() === RKB ? 0 : 1));
        setMyAgents(owned);
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

  const active = myAgents.length ? myAgents[ai] : null;          // an owned agent, or null → default
  // Two different questions, and conflating them is what broke the carousel:
  //   isOwned  — is the viewer driving one of their own agents? (controls, sign-in, counter)
  //   isRkb    — is THIS agent a genesis one? (labelling only)
  //   hasRkb   — does the wallet hold any genesis agent at all? (the "mint one" notice)
  const isOwned = !!active;
  const isRkb = !!active && active.registry.toLowerCase() === RKB;
  const hasRkb = myAgents.some((a) => a.registry.toLowerCase() === RKB);

  const featured = active
    ? { registry: active.registry, agentId: active.agent_id, name: active.name || `Bot #${active.agent_id}`, image: active.image,
        by: isRkb ? "Recompute Kit Bots" : "Held by this wallet",
        sub: isRkb ? `#${active.agent_id} · RKB` : `#${active.agent_id} · ${active.registry.slice(0, 6)}…${active.registry.slice(-4)}` }
    : { registry: DEMO_AGENT.registry, agentId: DEMO_AGENT.agentId, name: DEMO_AGENT.name, image: DEMO_AGENT.image, by: DEMO_AGENT.by, sub: DEMO_AGENT.ens };

  // Featured agent's recomputable reputation (escrow-settlement predicate) — shown as a pill under the name.
  useEffect(() => {
    let alive = true;
    setRep(null); setAgentEns(null);
    fetchReputation(featured.registry, featured.agentId).then((r) => { if (alive) setRep(r); }).catch(() => {});
    // The agent's ENSIP-25-registered ENS name (from /binding) — shown as a pill under the name.
    fetch(`${GW_URL}/agent/${featured.registry}/${featured.agentId}/binding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.ens_name) setAgentEns(d.ens_name); })
      .catch(() => {});
    return () => { alive = false; };
  }, [featured.registry, featured.agentId]);

  // Featured agent's tools: per-agent for RKB = its baked tokenURI tools PLUS any on-chain
  // entitlements it bought (so a purchased capability shows up in the loadout). Else the public toolbox.
  useEffect(() => {
    if (!active) { setCards(fallbackCards); return; }
    let cancelled = false;
    (async () => {
      const [ids, ents] = await Promise.all([
        fetchAgentMcps(active.registry, active.agent_id),
        fetch(`${GW_URL}/marketplace/agents`).then((r) => (r.ok ? r.json() : []))
          .then((all: Array<{ registry?: string; agentId?: string; entitlements?: string[] }>) =>
            (all || []).find((a) => String(a.agentId) === String(active.agent_id)
              && a.registry?.toLowerCase() === active.registry.toLowerCase())?.entitlements ?? [])
          .catch(() => [] as string[]),
      ]);
      if (cancelled) return;
      const entIds = (ents as string[]).map((s) => ENTITLEMENT_SLUG_TO_CARD_ID[s] ?? s);
      const merged = Array.from(new Set([...ids, ...entIds]));
      setCards(merged.length ? buildCardsFromIds(merged) : []);
    })();
    return () => { cancelled = true; };
  }, [active, fallbackCards]);

  const pick = (c: McpCard) => sendRef.current?.(c.prompt, c.display);
  const cycle = (d: number) => setAi((i) => (i + d + myAgents.length) % myAgents.length);

  // New agent selected → drop the stale "recompute last action" offer.
  useEffect(() => { setLastExchange(null); setRecomputeErr(null); }, [featured.registry, featured.agentId]);

  // Recompute the action the agent just took — builds the full record from the live
  // exchange + on-chain attestation, stashes it, and opens /verify in real-time mode.
  const recomputeLast = async (focus: "user" | "agent") => {
    if (!lastExchange) return;
    setRecomputing(focus); setRecomputeErr(null);
    const rec = await buildLiveRecord(
      { ens: featured.name, agentId: featured.agentId, registry: featured.registry },
      lastExchange.query, lastExchange.reply,
    );
    if (rec) { stashLiveRecord(rec); window.location.href = `/verify?live=1&focus=${focus}`; return; }
    setRecomputeErr("The attestation is still landing on-chain — give it a couple seconds and retry.");
    setRecomputing(null);
  };

  // Un-stick the recompute buttons if the page is restored from the back/forward cache —
  // navigating to /verify then hitting Back would otherwise freeze a button mid-"Building record…".
  useEffect(() => {
    const onShow = () => setRecomputing(null);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <TopNav />
      <div className="max-w-5xl mx-auto px-6 md:px-10 py-8">
        {/* /demo-specific context — sign in to drive your agents + configure. Nav + wallet are in TopNav. */}
        {address && isOwned && (
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
            <Link href="/consult" className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted hover:text-paper">Configure</Link>
            {token ? (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400/70" title="Signed in — chatting with your agents">
                <ShieldCheck className="h-3.5 w-3.5" /> Signed in
              </span>
            ) : (
              <button onClick={signIn} disabled={signingIn} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/90 hover:text-brassLight disabled:opacity-50">
                {signingIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />} {signingIn ? "Signing in…" : "Sign in"}
              </button>
            )}
          </div>
        )}

        {address && !hasRkb && (
          <div className="mt-6 rounded-xl border border-hairline/10 bg-elevate/5 px-4 py-2 text-[12px] text-gb-muted">
            No Recompute Kit Bots in this wallet yet — <Link href="/mint" className="text-brassLight hover:text-brass">mint one</Link> and it appears here.
          </div>
        )}

        {/* Agent header — avatar left of the title, in a brass-bordered card */}
        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-brassLight/30 bg-elevate/[0.02] p-4 sm:p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={featured.image} src={featured.image} alt={featured.name}
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border border-hairline/10 object-cover shrink-0"
            style={{ imageRendering: "pixelated" }} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">
              Live agent · {featured.by}{isOwned && myAgents.length > 1 ? ` · ${ai + 1} of ${myAgents.length}` : ""}
            </p>
            <div className="mt-1 flex items-center gap-3">
              {isOwned && myAgents.length > 1 && (
                <button onClick={() => cycle(-1)} aria-label="Previous agent"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevate/5 border border-hairline/10 hover:bg-elevate/10 transition-colors">
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              <h1 className="font-display font-medium tracking-tightest text-4xl sm:text-5xl truncate">{featured.name}</h1>
              {isOwned && myAgents.length > 1 && (
                <button onClick={() => cycle(1)} aria-label="Next agent"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevate/5 border border-hairline/10 hover:bg-elevate/10 transition-colors">
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] text-gb-faint truncate">{featured.sub}</p>
              {agentEns && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline/10 bg-elevate/[0.03] px-2.5 py-0.5 text-[11px] text-paper/75" title="ENSIP-25 agent name — verify on /verify">
                  <img src="/logos/ens.png" alt="ENS" className="h-3 w-auto" />
                  {agentEns}
                </span>
              )}
              <ReputationBadge rep={rep} />
              {/* What this agent can do, at a glance — right after the reputation pill, where
                  the eye already is. Small, dimmed and unframed on purpose: a description, not
                  a control. The pressable tool cards further down stay the way to run them. */}
              {cards.length > 0 && (
                <span className="inline-flex items-center gap-1 pl-0.5">
                  {cards.slice(0, 6).map((c) => (
                    <span key={`pill-${c.id}`} title={c.label}
                      className="inline-flex h-4 w-4 items-center justify-center opacity-60">
                      <McpLogo card={c} className="h-3.5 w-3.5" fill />
                    </span>
                  ))}
                  {cards.length > 6 && (
                    <span className="font-mono text-[10px] text-gb-faint">+{cards.length - 6}</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chat — remounts per agent so each has a fresh session. Sits above the tools:
            the conversation is the primary surface; the tools below are press-to-test. */}
        <div className="mt-8 liquid-glass rounded-2xl overflow-hidden h-[500px] p-4">
          <AgentChat
            key={`${featured.registry}-${featured.agentId}`}
            registry={featured.registry}
            agentId={featured.agentId}
            {...(isOwned ? { ownerAddress: address, authToken: token ?? undefined } : {})}
            onReady={(send) => { sendRef.current = send; }}
            onExchange={(query, reply) => setLastExchange({ query, reply })}
          />
        </div>

        {/* MCP selectors */}
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">
          {isOwned ? "Its tools — chosen at mint" : "Its tools — hover to learn, click to watch it run"}
        </p>
        <p className="mt-1 text-[11px] text-brassLight/80">
          Press a capability to put the agent to work — it runs the tool live, and every action is attested on-chain and independently recomputable.
        </p>
        {cards.length === 0 ? (
          <p className="mt-3 text-[12px] text-gb-faint">{isOwned ? "This agent was minted with no tools selected." : "Loading tools…"}</p>
        ) : (
          <div className="relative mt-3">
            {/* left / right arrows — rotate through the loadout, 3–4 cards visible at a time */}
            {cards.length > 3 && (
              <>
                <button
                  onClick={() => trackRef.current?.scrollBy({ left: -320, behavior: "smooth" })}
                  aria-label="Previous tools"
                  className="absolute -left-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-hairline/10 bg-deepink/90 p-2 text-gb-muted shadow-lg backdrop-blur transition-colors hover:border-brassLight/50 hover:text-brassLight sm:flex"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => trackRef.current?.scrollBy({ left: 320, behavior: "smooth" })}
                  aria-label="Next tools"
                  className="absolute -right-3 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-hairline/10 bg-deepink/90 p-2 text-gb-muted shadow-lg backdrop-blur transition-colors hover:border-brassLight/50 hover:text-brassLight sm:flex"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <div
              ref={trackRef}
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pt-3 pb-3 scroll-px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {cards.map((c) => (
                <div key={c.id} className="group relative w-[calc(50%-0.375rem)] shrink-0 snap-start sm:w-[calc(33.333%-0.5rem)] lg:w-[calc(25%-0.5625rem)]">
                  {/* Taxonomy tags — a vertical column from Premium downwards, capped at 4 + N */}
                  {(() => {
                    const ts = orderTags(mcpTags[c.id] || []);
                    if (!ts.length) return null;
                    const shown = ts.slice(0, 4);
                    const extra = ts.length - shown.length;
                    return (
                      <div className="pointer-events-none absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
                        {shown.map((t) => (
                          <span key={t} className={tagPillClass(t, "sm")}>{t}</span>
                        ))}
                        {extra > 0 && <span className={tagPillClass("+", "sm")}>+{extra}</span>}
                      </div>
                    );
                  })()}
                  <button
                    onClick={() => pick(c)}
                    onMouseEnter={() => setHoverMcp(c)}
                    onFocus={() => setHoverMcp(c)}
                    className="liquid-glass group/btn h-full w-full rounded-2xl p-4 text-left ring-1 ring-brassLight/30 transition-all duration-200 hover:-translate-y-1 hover:ring-brassLight/60 hover:shadow-[0_12px_28px_-14px_rgba(198,160,90,0.45)] motion-reduce:transform-none motion-reduce:transition-none"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-elevate/5 border border-brass/25">
                      <McpLogo card={c} className="h-6 w-6" fill />
                    </span>
                    <p className="mt-3 pr-16 font-display font-medium text-paper flex items-center gap-1">
                      {c.label}
                      <ArrowUpRight className="h-3.5 w-3.5 text-gb-faint transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                    </p>
                    <p className="mt-0.5 pr-16 text-[11px] text-gb-faint">{c.tagline}</p>
                  </button>
                </div>
              ))}
            </div>
            {/* Fixed description — always present below the carousel, changes on hover
                (steadier than a per-card tooltip that clips on the first card) */}
            <div className="mt-1 min-h-[3.25rem] rounded-xl border border-brassLight/30 bg-elevate/[0.02] px-4 py-3">
              {hoverMcp ? (
                <p className="text-[12px] leading-relaxed text-gb-muted">
                  <span className="font-display font-medium text-paper">{hoverMcp.label}</span>
                  <span className="mx-1.5 text-gb-faint">·</span>
                  <span className="italic">{hoverMcp.blurb}</span>
                </p>
              ) : (
                <p className="text-[12px] italic leading-relaxed text-gb-faint">
                  Hover a capability to see what it does — click one to watch the agent run it.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Recompute the action it JUST took — the real-time proof */}
        {lastExchange ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.04] p-4 flex flex-col gap-3">
            <div className="min-w-0">
              <p className="text-sm text-paper flex items-center gap-1.5 font-display font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> The full exchange was attested on-chain — both sides.
              </p>
              <p className="text-[12px] text-gb-muted mt-0.5">Recompute either half in your browser: your <span className="text-paper">input</span> the agent received (attested in), or the agent&apos;s <span className="text-paper">output</span> anchored on-chain and signed (attested out). Same live record; all five checks run either way.</p>
              {recomputeErr && <p className="text-[11px] text-brass/80 mt-1.5">{recomputeErr}</p>}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => recomputeLast("user")} disabled={!!recomputing}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-brass/40 bg-brass/10 hover:bg-brass/20 text-brassLight font-display font-medium text-sm px-5 py-2.5 disabled:opacity-50 transition-colors">
                {recomputing === "user" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                {recomputing === "user" ? "Building record…" : "Recompute user action"}
              </button>
              <button onClick={() => recomputeLast("agent")} disabled={!!recomputing}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-brass hover:bg-brassLight text-deepink font-display font-medium text-sm px-5 py-2.5 disabled:opacity-50 transition-colors">
                {recomputing === "agent" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {recomputing === "agent" ? "Building record…" : "Recompute agent action"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-hairline/8 p-4 text-sm text-gb-muted">
            Every action this agent takes is attested on-chain. Send it a message or run a tool — then{" "}
            <span className="text-brassLight">recompute that exact action yourself</span>, input to on-chain anchor, all in your browser.
          </div>
        )}
      </div>
    </main>
  );
}
