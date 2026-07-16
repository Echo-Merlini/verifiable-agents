"use client";

import { useState, useEffect } from "react";
import {
  useAccount, useReadContract, useWriteContract,
  useWaitForTransactionReceipt, useSwitchChain, useChainId,
} from "wagmi";
import { formatEther, type Hex } from "viem";
import {
  Wallet, Loader2, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight,
  Dices, ExternalLink, ShieldCheck, Check, Plus,
} from "lucide-react";
import {
  GENESIS_REGISTRY_ABI, GENESIS_REGISTRY_ADDRESS, GENESIS_CHAIN_ID,
  GENESIS_PHASE, GENESIS_PHASE_LABEL, isZero,
} from "@/lib/erc8004";
import { useWalletModal } from "@/hooks/useWalletModal";
import { NavMenu } from "@/components/NavMenu";
import { McpLogo } from "@/components/McpLogo";
import { buildMcpCards, type McpCard, type PublicMcp } from "@/lib/mcps";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

// Bot variants — sponsor-themed Recompute Kit Bots (nano-banana art). `image` is the
// optimized webp for fast slider display; `ipfs` is the pinned 1024px PNG that becomes
// the NFT's on-chain image at mint.
type BotVariant = { id: string; name: string; accent: string; image: string; ipfs: string };
const BOT_VARIANTS: BotVariant[] = [
  { id: "ethglobal", name: "ETH Global", accent: "#F2B705", image: "/bots/ethglobal.webp", ipfs: "ipfs://bafybeiebta24o2srwhlrpb2cxfw4tg3k7htfdmi75ro6npvmaoqh46kmlm" },
  { id: "ens",       name: "ENS",        accent: "#4A90E2", image: "/bots/ens.webp",       ipfs: "ipfs://bafybeicqk6coonbtrokczf43zaqzjavfw4w4ifoec2w6au25k5bk5j6twq" },
  { id: "uniswap",   name: "Uniswap",    accent: "#FF2E9A", image: "/bots/uniswap.webp",   ipfs: "ipfs://bafybeih72ysonmwyvzcs7czr4bchk3x6g2ayg3qfhzsuercqjvptkcekeq" },
  { id: "1inch",     name: "1inch",      accent: "#8BC34A", image: "/bots/1inch.webp",     ipfs: "ipfs://bafybeihiq4zajesunsie4zfnw7xr4poqp2a37wqhdgwokguo6nnqlanlza" },
  { id: "sui",       name: "Sui",        accent: "#4DA2FF", image: "/bots/sui.webp",       ipfs: "ipfs://bafybeif35qqjud7ftacyk36cjhyqjpv2azr2h7w6wrpreozwbxrc6eyrxu" },
  { id: "thegraph",  name: "The Graph",  accent: "#E0A24C", image: "/bots/thegraph.webp",  ipfs: "ipfs://bafybeia7myhceipzrxnxftkgp2ccvb5rewnihoorsm3emdlzi3itpwja2a" },
  { id: "worldcoin", name: "Worldcoin",  accent: "#E53935", image: "/bots/worldcoin.webp", ipfs: "ipfs://bafybeiebqyhtsdn4ttlm75k4w2u3jjpat5y33cdblmwetw5kjwqftv7wpe" },
  { id: "hedera",    name: "Hedera",     accent: "#AEB4BE", image: "/bots/hedera.webp",    ipfs: "ipfs://bafybeiaoslgie4ne3prn3pjkk6lyeerwe25m2gpnrc2jua7r4by4rcar4m" },
  { id: "0g",        name: "0G",         accent: "#A45BF0", image: "/bots/0g.webp",        ipfs: "ipfs://bafybeieu6x6mxkfeepphr4zpio2hwnsu226cmt5lbkw5ggprsbs6ngrmfu" },
];

// Auto-assigned personalities. Tiago to add the on-brand hackathon one; keep this
// list as the pool the mint rolls from.
type Personality = { id: string; name: string; blurb: string };
const PERSONALITIES: Personality[] = [
  { id: "recompute", name: "The Recomputer", blurb: "Trust nothing, re-derive everything. Verifies every claim from the primary artifact before it acts." },
  { id: "auditor",   name: "The Auditor",    blurb: "Methodical and receipts-first. Narrates what it checked and why, and leaves an on-chain trail." },
  { id: "scout",     name: "The Scout",      blurb: "Fast, market-aware, curious. Surfaces live data and opportunities across chains." },
  { id: "sentinel",  name: "The Sentinel",   blurb: "Security-minded. Traces flows, flags risk, and refuses to sign what it can't explain." },
];

const EMPTY_META: readonly { metadataKey: string; metadataValue: Hex }[] = [];

type Step = "idle" | "pinning-meta" | "minting" | "confirming" | "claiming" | "done";

export default function MintAgentPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const { open: openWallet } = useWalletModal();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();

  // ── selections ──
  const [vi, setVi] = useState(0);                 // variant index
  const variant = BOT_VARIANTS[vi];
  const [name, setName] = useState("");
  const [persona, setPersona] = useState(0);       // personality index
  const [tools, setTools] = useState<Set<string>>(new Set());
  const [cards, setCards] = useState<McpCard[]>([]);
  const [mi, setMi] = useState(0);                 // MCP carousel index

  // ── flow state ──
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [trialGranted, setTrialGranted] = useState<number | null>(null);

  const registry = GENESIS_REGISTRY_ADDRESS;
  const registryReady = !isZero(registry);
  const readOpts = { address: registry, abi: GENESIS_REGISTRY_ABI, chainId: GENESIS_CHAIN_ID } as const;
  const { data: phase } = useReadContract({ ...readOpts, functionName: "phase", query: { enabled: registryReady } });
  const { data: publicPrice } = useReadContract({ ...readOpts, functionName: "publicPrice", query: { enabled: registryReady } });
  const { data: totalSupply } = useReadContract({ ...readOpts, functionName: "totalSupply", query: { enabled: registryReady } });
  const { data: maxSupply } = useReadContract({ ...readOpts, functionName: "maxSupply", query: { enabled: registryReady } });

  const phaseNum = Number(phase ?? 0);
  const isOpen = phaseNum === GENESIS_PHASE.Public || phaseNum === GENESIS_PHASE.Allowlist;
  const price = publicPrice as bigint | undefined;
  const isFree = price !== undefined && price === 0n;
  const priceLabel = price === undefined ? "…" : isFree ? "FREE MINT" : `${formatEther(price)} ETH`;
  const supplyLeft = maxSupply !== undefined && (maxSupply as bigint) > 0n
    ? Number((maxSupply as bigint) - (totalSupply ?? 0n)) : null;

  const receipt = useWaitForTransactionReceipt({ hash: txHash ?? undefined, chainId: GENESIS_CHAIN_ID });

  // Load the agent toolbox (same public list the demo uses) and pre-select the four heroes.
  useEffect(() => {
    fetch(`${GW_URL}/agent/public-mcps`)
      .then((r) => (r.ok ? r.json() : []))
      .then((mcps: PublicMcp[]) => {
        const built = buildMcpCards(mcps);
        setCards(built);
        setTools(new Set(built.slice(0, 4).map((c) => c.id)));
      })
      .catch(() => setCards([]));
  }, []);

  // After mint confirms → claim the free-trial credits.
  useEffect(() => {
    if (step !== "confirming" || !receipt.isSuccess || !txHash) return;
    (async () => {
      setStep("claiming");
      try {
        const r = await fetch(`${GW_URL}/api/genesis/claim-trial`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash }),
        });
        const d = await r.json();
        setTrialGranted(typeof d.creditsGranted === "number" ? d.creditsGranted : 0);
      } catch { setTrialGranted(0); }
      setStep("done");
    })();
  }, [step, receipt.isSuccess, txHash]);

  const toggleTool = (id: string) =>
    setTools((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const busy = step !== "idle" && step !== "done";
  const canMint = mounted && isConnected && registryReady && isOpen && !!name.trim() && step === "idle";

  async function handleMint() {
    if (!isConnected) { openWallet(); return; }
    if (!canMint || !address) return;
    setError(null);
    try {
      if (chainId !== GENESIS_CHAIN_ID) await switchChainAsync({ chainId: GENESIS_CHAIN_ID });

      // 1. pin metadata (variant image + chosen personality + selected tools)
      setStep("pinning-meta");
      const p = PERSONALITIES[persona];
      const chosen = cards.filter((c) => tools.has(c.id));
      const metaRes = await fetch(`${GW_URL}/api/genesis/pin-metadata`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: `${p.name} — ${p.blurb}`,
          image: variant.ipfs,
          attributes: [
            { trait_type: "Collection", value: "Recompute Kit Bots" },
            { trait_type: "Variant", value: variant.name },
            { trait_type: "Personality", value: p.name },
            ...chosen.map((c) => ({ trait_type: "Tool", value: c.label })),
          ],
          personality: p.id,
          mcps: chosen.map((c) => c.id),
        }),
      });
      const metaData = await metaRes.json();
      if (!metaData.uri) throw new Error(metaData.error || "Metadata pin failed");

      // 2. mint
      setStep("minting");
      const hash = await writeContractAsync({
        address: registry, abi: GENESIS_REGISTRY_ABI, functionName: "mint",
        args: [metaData.uri, EMPTY_META], value: price ?? 0n, chainId: GENESIS_CHAIN_ID,
      });
      setTxHash(hash); setStep("confirming");
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Mint failed");
      setStep("idle");
    }
  }

  const cycle = (d: number) => setVi((i) => (i + d + BOT_VARIANTS.length) % BOT_VARIANTS.length);
  const cycleMcp = (d: number) => { if (cards.length) setMi((i) => (i + d + cards.length) % cards.length); };

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <NavMenu />
      <div className="max-w-xl mx-auto px-6 py-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">Mint your agent</p>
        <h1 className="mt-2 font-display font-medium tracking-tightest text-4xl">Recompute Kit Bot</h1>
        <p className="mt-2 text-sm text-gb-muted">A verifiable agent you recompute, not trust. Mint binds this bot as your agent — pick a look, name it, choose its tools.</p>

        {step === "done" ? (
          <div className="mt-8 liquid-glass rounded-3xl p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h2 className="mt-3 font-display text-2xl">{name || "Your agent"} is live</h2>
            {trialGranted != null && trialGranted > 0 && (
              <p className="mt-1 text-sm text-gb-muted">{trialGranted} free trial credits granted.</p>
            )}
            {txHash && (
              <a href={`${GENESIS_CHAIN_ID === 1 ? "https://etherscan.io" : "https://sepolia.etherscan.io"}/tx/${txHash}`}
                target="_blank" rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-brassLight hover:text-brass">
                View transaction <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ) : (
          <>
            {/* 1 — variant frame + slider */}
            <div className="mt-6 relative liquid-glass rounded-3xl p-4">
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl"
                   style={{ boxShadow: `inset 0 0 0 1px ${variant.accent}22, 0 0 60px -20px ${variant.accent}55` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={variant.image} alt={variant.name} className="h-full w-full object-contain" />
              </div>
              <button onClick={() => cycle(-1)} aria-label="Previous"
                className="absolute left-6 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 border border-white/10 hover:bg-black/70 transition-colors">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={() => cycle(1)} aria-label="Next"
                className="absolute right-6 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 border border-white/10 hover:bg-black/70 transition-colors">
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="mt-3 flex items-center justify-center gap-2">
                {BOT_VARIANTS.map((b, i) => (
                  <button key={b.id} onClick={() => setVi(i)} aria-label={b.name}
                    className="h-2.5 w-2.5 rounded-full transition-transform"
                    style={{ background: i === vi ? b.accent : "#3a3f4b", transform: i === vi ? "scale(1.25)" : "scale(1)" }} />
                ))}
              </div>
              <p className="mt-1 text-center font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: variant.accent }}>{variant.name}</p>
            </div>

            {/* 2 — name */}
            <label className="mt-6 block">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">Agent name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy}
                placeholder="e.g. Wizgob Advisor"
                className="mt-1.5 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-paper placeholder:text-gb-faint focus:border-brassLight/50 focus:outline-none disabled:opacity-50" />
            </label>

            {/* 3 — personality (auto-assigned, re-rollable) */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">Personality · auto-assigned</span>
                <button onClick={() => setPersona((i) => (i + 1) % PERSONALITIES.length)} disabled={busy}
                  className="inline-flex items-center gap-1 text-[11px] text-brassLight hover:text-brass disabled:opacity-50">
                  <Dices className="h-3.5 w-3.5" /> re-roll
                </button>
              </div>
              <div className="mt-1.5 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                <p className="font-display font-medium text-paper">{PERSONALITIES[persona].name}</p>
                <p className="mt-0.5 text-[12px] text-gb-muted">{PERSONALITIES[persona].blurb}</p>
              </div>
            </div>

            {/* 4 — MCP selector: browse each tool (logo + description), add the ones you want */}
            <div className="mt-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">Tools · {tools.size} selected</span>
              {/* selected tools — small logo squares appear as you Add; tap to remove */}
              {tools.size > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {cards.filter((c) => tools.has(c.id)).map((c) => (
                    <button key={c.id} onClick={() => toggleTool(c.id)} disabled={busy} title={`Remove ${c.label}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-brassLight/40 hover:border-red-400/50 transition-colors disabled:opacity-50">
                      <McpLogo card={c} className="h-5 w-5" />
                    </button>
                  ))}
                </div>
              )}
              {cards.length > 0 && (() => {
                const c = cards[mi];
                const on = tools.has(c.id);
                return (
                  <>
                    <div className="mt-1.5 liquid-glass rounded-2xl p-4">
                      <div className="flex items-start gap-4">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                          <McpLogo card={c} className="h-8 w-8" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-display font-medium text-paper">{c.label}</p>
                            <button onClick={() => toggleTool(c.id)} disabled={busy}
                              className={`shrink-0 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${on ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-gb-muted hover:text-paper"}`}>
                              {on ? <><Check className="h-3 w-3" /> Added</> : <><Plus className="h-3 w-3" /> Add</>}
                            </button>
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed text-gb-muted">{c.blurb}</p>
                        </div>
                      </div>
                    </div>
                    {/* arrows + position dots (brass dot = selected) */}
                    <div className="mt-2 flex items-center justify-center gap-3">
                      <button onClick={() => cycleMcp(-1)} aria-label="Previous tool"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <div className="flex items-center gap-1.5">
                        {cards.map((cc, i) => (
                          <button key={cc.id} onClick={() => setMi(i)} aria-label={cc.label}
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: i === mi ? 16 : 6, background: tools.has(cc.id) ? "#E0A24C" : i === mi ? "#8A909C" : "#3a3f4b" }} />
                        ))}
                      </div>
                      <button onClick={() => cycleMcp(1)} aria-label="Next tool"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* 5 — price + mint */}
            <div className="mt-7 flex items-center justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">Price</p>
                <p className="font-display text-2xl" style={{ color: isFree ? "#34D399" : undefined }}>{priceLabel}</p>
                {supplyLeft != null && <p className="text-[11px] text-gb-faint">{supplyLeft} left</p>}
              </div>
              <button onClick={handleMint} disabled={busy || (isConnected && !canMint)}
                className="inline-flex items-center gap-2 rounded-2xl bg-brass px-6 py-3.5 font-display font-medium text-deepink hover:bg-brassLight transition-colors disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isConnected ? <ShieldCheck className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                {busy ? "Minting…" : isConnected ? "Mint agent" : "Connect wallet"}
              </button>
            </div>

            {mounted && isConnected && registryReady && !isOpen && (
              <p className="mt-3 text-[12px] text-amber-300/90">Minting is {GENESIS_PHASE_LABEL[phaseNum]} — opens when the collection goes public.</p>
            )}
            {mounted && !registryReady && (
              <p className="mt-3 text-[12px] text-amber-300/90">Collection deploys shortly — the mint activates once its registry is live.</p>
            )}
            {error && (
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-red-400"><AlertCircle className="h-3.5 w-3.5" />{error}</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
