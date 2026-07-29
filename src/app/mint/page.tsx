"use client";

import { useState, useEffect, useRef } from "react";
import {
  useAccount, useReadContract, useWriteContract,
  useWaitForTransactionReceipt, useSwitchChain, useChainId, usePublicClient,
} from "wagmi";
import { formatEther, type Hex } from "viem";
import {
  Wallet, Loader2, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight,
  Dices, ExternalLink, ShieldCheck, Check, Upload, X, Sparkles,
} from "lucide-react";
import {
  GENESIS_REGISTRY_ABI, GENESIS_REGISTRY_ADDRESS, GENESIS_CHAIN_ID,
  GENESIS_PHASE, GENESIS_PHASE_LABEL, isZero,
} from "@/lib/erc8004";
import { useWalletModal } from "@/hooks/useWalletModal";
import { TopNav } from "@/components/TopNav";
import { McpLogo } from "@/components/McpLogo";
import { buildMcpCards, type McpCard, type PublicMcp } from "@/lib/mcps";
import { fetchPremiumMcps, type PremiumMcp } from "@/lib/marketplace";

// MCPEntitlementRegistry.buy(address registry, uint256 tokenId, bytes32 mcpId) payable
const ENTITLEMENT_ABI = [{
  type: "function", name: "buy", stateMutability: "payable",
  inputs: [{ name: "registry", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "mcpId", type: "bytes32" }],
  outputs: [],
}] as const;

// ERC-721 Transfer(address,address,uint256) topic — used to read the freshly minted tokenId
// out of the mint receipt so we can equip entitlements onto it.
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
function mintedTokenIdFromLogs(logs: readonly { address: string; topics: readonly string[] }[], registry: string): bigint | null {
  const reg = registry.toLowerCase();
  for (const l of logs) {
    if (l.address.toLowerCase() === reg && l.topics[0] === TRANSFER_TOPIC && l.topics.length === 4
        && /^0x0+$/.test(l.topics[1] ?? "")) {   // mint = Transfer from the zero address
      try { return BigInt(l.topics[3]); } catch { return null; }
    }
  }
  return null;
}
const equipEth = (wei: string) => { try { return `${formatEther(BigInt(wei || "0"))} ETH`; } catch { return "—"; } };

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

// Bot variants — sponsor-themed Recompute Kit Bots (nano-banana art). `image` is the
// optimized webp for fast slider display; `ipfs` is the pinned 1024px PNG that becomes
// the NFT's on-chain image at mint.
type BotVariant = { id: string; name: string; accent: string; image: string; ipfs: string };
const BOT_VARIANTS: BotVariant[] = [
  { id: "vertice", name: "Vértice X Trustless-ai", accent: "#E0A24C",
    image: "https://sapphire-naval-quelea-174.mypinata.cloud/ipfs/bafybeicgte5e2hkw5zvgulsj7gly244qcgj5ynhhlssnk7xsz22dqejvpa",
    ipfs: "ipfs://bafybeicgte5e2hkw5zvgulsj7gly244qcgj5ynhhlssnk7xsz22dqejvpa" },
];

// Auto-assigned personalities. Tiago to add the on-brand hackathon one; keep this
// list as the pool the mint rolls from.
type Personality = { id: string; name: string; blurb: string };
const PERSONALITIES: Personality[] = [
  { id: "recompute", name: "The Recomputer", blurb: "Trust nothing, re-derive everything. Verifies every claim from the primary artifact before it acts." },
  { id: "auditor",   name: "The Auditor",    blurb: "Methodical and receipts-first. Narrates what it checked and why, and leaves an on-chain trail." },
  { id: "scout",     name: "The Scout",      blurb: "Fast, market-aware, curious. Surfaces live data and opportunities across chains." },
  { id: "sentinel",  name: "The Sentinel",   blurb: "Security-minded. Traces flows, flags risk, and refuses to sign what it can't explain." },
  // Lighter, on-brand personalities for the demo — still verifiable, just more fun.
  { id: "ethglobal-maxi", name: "EthGlobal Maxi", blurb: "Runs on hackathon energy and cold brew. Ships fast, name-drops every bounty, and treats each prompt like a 4am demo deadline — but still recomputes before it commits." },
  { id: "local-dev",      name: "Local Dev",      blurb: "Happiest on localhost:3000. Insists it 'works on my machine', thinks in terminal commands, and reflexively suggests a fresh reinstall — then attests the result on-chain anyway." },
  { id: "vitalik-groupie", name: "Vitalik Groupie", blurb: "Quotes vitalik.eth blog posts unprompted, dreams of a reply-guy retweet, and rates every idea by how based and decentralized it is." },
];

const EMPTY_META: readonly { metadataKey: string; metadataValue: Hex }[] = [];

type Step = "idle" | "pinning-image" | "pinning-meta" | "minting" | "confirming" | "equipping" | "claiming" | "done";

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
  const [custom, setCustom] = useState<{ file: File; url: string } | null>(null); // uploaded image (overrides preset)
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);

  // ── premium capabilities (equip = an on-chain MCPEntitlementRegistry.buy, added to the total) ──
  const [premium, setPremium] = useState<PremiumMcp[]>([]);
  const [equipped, setEquipped] = useState<Set<string>>(new Set());   // slugs to equip
  const [equipState, setEquipState] = useState<Record<string, "pending" | "done" | "error">>({});
  const [mintedId, setMintedId] = useState<string | null>(null);
  const publicClient = usePublicClient();

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

  // Load the premium capability catalog (equip-able, priced, on-chain entitlements).
  useEffect(() => {
    fetchPremiumMcps()
      .then((list) => setPremium(list.filter((m) => m.active)))
      .catch(() => setPremium([]));
  }, []);

  // After mint confirms → equip the chosen premium capabilities onto the fresh tokenId, then
  // claim the free-trial credits. Equips are separate txs (the entitlement binds to the minted
  // NFT, which only exists once the mint lands) — one signature each, best-effort per capability.
  useEffect(() => {
    if (step !== "confirming" || !receipt.isSuccess || !txHash) return;
    (async () => {
      // Read the minted tokenId out of the receipt so we can equip onto it.
      const tokenId = receipt.data ? mintedTokenIdFromLogs(receipt.data.logs as any, registry) : null;
      if (tokenId != null) setMintedId(tokenId.toString());

      const toEquip = premium.filter((m) => equipped.has(m.slug) && m.contract);
      if (tokenId != null && toEquip.length > 0) {
        setStep("equipping");
        for (const m of toEquip) {
          setEquipState((s) => ({ ...s, [m.slug]: "pending" }));
          try {
            if (chainId !== m.chainId) await switchChainAsync({ chainId: m.chainId });
            const hash = await writeContractAsync({
              address: m.contract as Hex, abi: ENTITLEMENT_ABI, functionName: "buy",
              args: [registry, tokenId, m.mcpId as Hex], value: BigInt(m.price || "0"), chainId: m.chainId,
            });
            if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
            setEquipState((s) => ({ ...s, [m.slug]: "done" }));
          } catch {
            setEquipState((s) => ({ ...s, [m.slug]: "error" }));   // skipped/rejected — the mint still stands
          }
        }
      }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, receipt.isSuccess, txHash]);

  const toggleEquip = (slug: string) =>
    setEquipped((prev) => { const n = new Set(prev); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });

  // Price math: base mint + Σ equipped premium prices → the total shown upfront.
  const equipTotalWei = premium.reduce((a, m) => (equipped.has(m.slug) ? a + BigInt(m.price || "0") : a), 0n);
  const baseWei = price ?? 0n;
  const totalWei = baseWei + equipTotalWei;
  const equippedList = premium.filter((m) => equipped.has(m.slug) && m.contract);

  // Upload your own art. Kept as a local object-URL preview; the file is pinned to IPFS
  // as a step when you press Mint (so nothing is uploaded until you commit).
  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImgErr(null);
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!f) return;
    if (!f.type.startsWith("image/")) { setImgErr("Pick an image file (PNG, JPG, GIF, WebP)."); return; }
    if (f.size > 15 * 1024 * 1024) { setImgErr("Image too large — max 15MB."); return; }
    setCustom((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { file: f, url: URL.createObjectURL(f) }; });
  };
  const clearImage = () =>
    setCustom((prev) => { if (prev) URL.revokeObjectURL(prev.url); return null; });
  // Picking a preset drops the uploaded image.
  const pickPreset = (i: number) => { clearImage(); setVi(i); };
  // Revoke the preview URL on unmount.
  useEffect(() => () => { if (custom) URL.revokeObjectURL(custom.url); }, [custom]);

  const busy = step !== "idle" && step !== "done";
  const canMint = mounted && isConnected && registryReady && isOpen && !!name.trim() && step === "idle";

  async function handleMint() {
    if (!isConnected) { openWallet(); return; }
    if (!canMint || !address) return;
    setError(null);
    try {
      if (chainId !== GENESIS_CHAIN_ID) await switchChainAsync({ chainId: GENESIS_CHAIN_ID });

      // 1. if the user uploaded their own art, pin it now (before mint) → ipfs:// uri
      let imageUri = variant.ipfs;
      let variantLabel = variant.name;
      if (custom) {
        setStep("pinning-image");
        const fd = new FormData();
        fd.append("file", custom.file);
        const imgRes = await fetch(`${GW_URL}/api/genesis/pin-image`, { method: "POST", body: fd });
        const imgData = await imgRes.json();
        if (!imgData.uri) throw new Error(imgData.error || "Image pin failed");
        imageUri = imgData.uri;
        variantLabel = "Custom";
      }

      // 2. pin metadata (image + chosen personality + selected tools)
      setStep("pinning-meta");
      const p = PERSONALITIES[persona];
      const chosen = cards.filter((c) => tools.has(c.id));
      const metaRes = await fetch(`${GW_URL}/api/genesis/pin-metadata`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: `${p.name} — ${p.blurb}`,
          image: imageUri,
          attributes: [
            { trait_type: "Collection", value: "Recompute Kit Bots" },
            { trait_type: "Variant", value: variantLabel },
            { trait_type: "Personality", value: p.name },
            ...chosen.map((c) => ({ trait_type: "Tool", value: c.label })),
          ],
          personality: p.id,
          // System prompt applied to the agent at index — gives it its personality.
          custom_prompt: `You are ${name.trim() || p.name}, an autonomous verifiable agent minted from the Recompute Kit Bots collection. ${p.blurb} You have on-chain tools — use them when a request calls for it. Every action you take is attested on-chain and independently recomputable. Don't trust — recompute.`,
          mcps: chosen.map((c) => c.id),
        }),
      });
      const metaData = await metaRes.json();
      if (!metaData.uri) throw new Error(metaData.error || "Metadata pin failed");

      // 3. mint
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
  const cycleMcp = (d: number) => { if (premium.length) setMi((i) => (i + d + premium.length) % premium.length); };

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <TopNav />
      <div className="max-w-xl mx-auto px-6 py-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-brassLight/80">Mint your agent</p>
        <h1 className="mt-2 font-display font-medium tracking-tightest text-4xl">Recompute Kit Bot</h1>
        <p className="mt-2 text-sm text-gb-muted">A verifiable agent you recompute, not trust. Mint binds this bot as your agent — pick a look or upload your own, name it, equip its capabilities.</p>

        {step === "done" ? (
          <div className="mt-8 liquid-glass rounded-3xl p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h2 className="mt-3 font-display text-2xl">{name || "Your agent"} is live</h2>
            {trialGranted != null && trialGranted > 0 && (
              <p className="mt-1 text-sm text-gb-muted">{trialGranted} free trial credits granted.</p>
            )}
            {/* Honest equip summary — a rejected/failed purchase shows as "not equipped", not hidden. */}
            {equippedList.length > 0 && (
              <div className="mt-3 space-y-1">
                {equippedList.map((m) => {
                  const st = equipState[m.slug];
                  return (
                    <p key={m.slug} className="flex items-center justify-center gap-1.5 text-[12px]">
                      {st === "done"
                        ? <><Check className="h-3.5 w-3.5 text-emerald-400" /><span className="text-gb-muted">{m.label} equipped</span></>
                        : <><AlertCircle className="h-3.5 w-3.5 text-amber-400" /><span className="text-gb-muted">{m.label} not equipped — <a href="/marketplace" className="text-brassLight hover:text-brass">add it later</a></span></>}
                    </p>
                  );
                })}
              </div>
            )}
            {/* Close the loop: send them straight to drive the agent they just minted. */}
            <a href="/demo"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brass px-6 py-3.5 font-display font-medium text-deepink hover:bg-brassLight transition-colors">
              <ShieldCheck className="h-4 w-4" /> Drive {name || "your agent"} <ChevronRight className="h-4 w-4" />
            </a>
            {txHash && (
              <div className="mt-4">
                <a href={`${GENESIS_CHAIN_ID === 1 ? "https://etherscan.io" : "https://sepolia.etherscan.io"}/tx/${txHash}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-brassLight hover:text-brass">
                  View transaction <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 1 — variant frame + slider (or your uploaded art) */}
            <div className="mt-6 relative liquid-glass rounded-3xl border border-brassLight/30 p-4">
              {(() => { const accent = custom ? "#E0A24C" : variant.accent; return (
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl"
                   style={{ boxShadow: `inset 0 0 0 1px ${accent}22, 0 0 60px -20px ${accent}55` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={custom ? custom.url : variant.image} alt={custom ? "Your uploaded agent art" : variant.name} className="h-full w-full object-contain" />
              </div>
              ); })()}
              {/* preset arrows — only when there's more than one preset, and not while an upload is in play */}
              {!custom && BOT_VARIANTS.length > 1 && (<>
                <button onClick={() => cycle(-1)} aria-label="Previous"
                  className="absolute left-6 top-[calc(50%-1.75rem)] -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 border border-white/10 hover:bg-black/70 transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={() => cycle(1)} aria-label="Next"
                  className="absolute right-6 top-[calc(50%-1.75rem)] -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 border border-white/10 hover:bg-black/70 transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>)}
              {BOT_VARIANTS.length > 1 && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  {BOT_VARIANTS.map((b, i) => (
                    <button key={b.id} onClick={() => pickPreset(i)} aria-label={b.name}
                      className="h-2.5 w-2.5 rounded-full transition-transform"
                      style={{ background: !custom && i === vi ? b.accent : "#3a3f4b", transform: !custom && i === vi ? "scale(1.25)" : "scale(1)" }} />
                  ))}
                </div>
              )}
              <p className="mt-1 text-center font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: custom ? "#E0A24C" : variant.accent }}>{custom ? "Custom image" : variant.name}</p>

              {/* Upload your own — pinned to IPFS as a step when you press Mint */}
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
              <div className="mt-3 flex items-center justify-center">
                {custom ? (
                  <button onClick={clearImage} disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] text-gb-muted hover:text-paper hover:border-white/25 transition-colors disabled:opacity-50">
                    <X className="h-3.5 w-3.5" /> Remove · use the default
                  </button>
                ) : (
                  <button onClick={() => fileRef.current?.click()} disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brassLight/40 bg-white/5 px-3 py-1.5 text-[11px] text-brassLight hover:border-brassLight/70 transition-colors disabled:opacity-50">
                    <Upload className="h-3.5 w-3.5" /> Upload your own image
                  </button>
                )}
              </div>
              {imgErr && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-red-400"><AlertCircle className="h-3.5 w-3.5" />{imgErr}</p>
              )}
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
              <div className="mt-1.5 rounded-xl bg-white/5 border border-brassLight/30 px-4 py-3">
                <p className="font-display font-medium text-paper">{PERSONALITIES[persona].name}</p>
                <p className="mt-0.5 text-[12px] text-gb-muted">{PERSONALITIES[persona].blurb}</p>
              </div>
            </div>

            {/* 4 — capability carousel: browse the payable MCPs one at a time; equip adds to the mint */}
            {premium.length > 0 && (
            <div className="mt-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">Capabilities · {equipped.size} equipped</span>
              {/* equipped so far — small logo squares; tap to un-equip */}
              {equipped.size > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {premium.filter((m) => equipped.has(m.slug)).map((m) => (
                    <button key={m.slug} onClick={() => toggleEquip(m.slug)} disabled={busy} title={`Un-equip ${m.label}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-brassLight/40 hover:border-red-400/50 transition-colors disabled:opacity-50">
                      <McpLogo card={{ id: m.slug, label: m.label, logo: m.logo, icon: m.icon, fill: m.fill } as any} className="h-5 w-5" fill />
                    </button>
                  ))}
                </div>
              )}
              {(() => {
                const m = premium[Math.min(mi, premium.length - 1)];
                const on = equipped.has(m.slug);
                const live = !!m.contract;
                const st = equipState[m.slug];
                return (
                  <>
                    <div className="mt-1.5 liquid-glass rounded-2xl border border-brassLight/30 p-4">
                      <div className="flex items-start gap-4">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-black/30 ring-1 ring-brassLight/40">
                          <McpLogo card={{ id: m.slug, label: m.label, logo: m.logo, icon: m.icon, fill: m.fill } as any} className="h-8 w-8" fill />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-display font-medium text-paper">{m.label}</p>
                            <span className="shrink-0 font-mono text-[11px] text-brassLight">{equipEth(m.price)}</span>
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed text-gb-muted">{m.description || m.tagline}</p>
                          <button onClick={() => toggleEquip(m.slug)} disabled={busy || !live}
                            title={live ? undefined : "Launching on mainnet"}
                            className={`mt-2 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-40 ${
                              st === "done" ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                              : st === "error" ? "border-red-400/50 bg-red-400/10 text-red-300"
                              : on ? "border-brassLight/60 bg-brass/15 text-brassLight" : "border-white/10 bg-white/5 text-gb-muted hover:text-paper"}`}>
                            {st === "done" ? <><Check className="h-3 w-3" /> Equipped</>
                              : st === "error" ? <><AlertCircle className="h-3 w-3" /> Skipped</>
                              : on ? <><Check className="h-3 w-3" /> Added · {equipEth(m.price)}</>
                              : live ? <><Sparkles className="h-3 w-3" /> Equip · {equipEth(m.price)}</>
                              : <>Launching soon</>}
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* arrows + position dots (brass dot = equipped) */}
                    <div className="mt-2 flex items-center justify-center gap-3">
                      <button onClick={() => cycleMcp(-1)} aria-label="Previous capability"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <div className="flex items-center gap-1.5">
                        {premium.map((mm, i) => (
                          <button key={mm.slug} onClick={() => setMi(i)} aria-label={mm.label}
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: i === mi ? 16 : 6, background: equipped.has(mm.slug) ? "#E0A24C" : i === mi ? "#8A909C" : "#3a3f4b" }} />
                        ))}
                      </div>
                      <button onClick={() => cycleMcp(1)} aria-label="Next capability"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
            )}

            {/* 5 — premium capabilities: equip on-chain entitlements (each adds to the total) */}
            {premium.length > 0 && (
              <div className="mt-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">All capabilities · quick equip</span>
                <p className="mt-1 text-[12px] text-gb-muted">Each is bought as an on-chain entitlement carried by the NFT. Equipping adds its price to the mint — you sign the mint first, then one purchase per capability.</p>
                <div className="mt-2 space-y-1.5">
                  {premium.map((m) => {
                    const on = equipped.has(m.slug);
                    const live = !!m.contract;
                    const st = equipState[m.slug];
                    return (
                      <div key={m.slug} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${on ? "border-brassLight/50 bg-brass/[0.06]" : "border-white/10 bg-white/5"}`}>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/30 ring-1 ring-brassLight/40">
                          <McpLogo card={{ id: m.slug, label: m.label, logo: m.logo, icon: m.icon, fill: m.fill } as any} className="h-5 w-5" fill />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-medium text-paper leading-tight">{m.label}</p>
                          <p className="truncate text-[11px] text-gb-muted">{m.tagline}</p>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-brassLight">{equipEth(m.price)}</span>
                        <button onClick={() => toggleEquip(m.slug)} disabled={busy || !live}
                          title={live ? undefined : "Launching on mainnet"}
                          className={`shrink-0 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-40 ${
                            st === "done" ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                            : st === "error" ? "border-red-400/50 bg-red-400/10 text-red-300"
                            : on ? "border-brassLight/60 bg-brass/15 text-brassLight" : "border-white/10 bg-white/5 text-gb-muted hover:text-paper"}`}>
                          {st === "done" ? <><Check className="h-3 w-3" /> Equipped</>
                            : st === "error" ? <><AlertCircle className="h-3 w-3" /> Skipped</>
                            : on ? <><Check className="h-3 w-3" /> Added</>
                            : <><Sparkles className="h-3 w-3" /> Equip</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6 — price + mint */}
            <div className="mt-7 flex items-center justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">{equipTotalWei > 0n ? "Total" : "Price"}</p>
                <p className="font-display text-2xl" style={{ color: isFree && equipTotalWei === 0n ? "#34D399" : undefined }}>
                  {equipTotalWei > 0n ? `${formatEther(totalWei)} ETH` : priceLabel}
                </p>
                {equipTotalWei > 0n ? (
                  <p className="text-[11px] text-gb-faint">{isFree ? "free mint" : `${formatEther(baseWei)} mint`} + {formatEther(equipTotalWei)} equip{equippedList.length > 1 ? "s" : ""}</p>
                ) : (
                  supplyLeft != null && <p className="text-[11px] text-gb-faint">{supplyLeft} left</p>
                )}
              </div>
              <button onClick={handleMint} disabled={busy || (isConnected && !canMint)}
                className="inline-flex items-center gap-2 rounded-2xl bg-brass px-6 py-3.5 font-display font-medium text-deepink hover:bg-brassLight transition-colors disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isConnected ? <ShieldCheck className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                {busy ? (step === "pinning-image" ? "Pinning image…" : step === "pinning-meta" ? "Preparing…" : step === "equipping" ? "Equipping…" : step === "claiming" ? "Granting credits…" : "Minting…")
                  : isConnected ? (equippedList.length > 0 ? "Mint & equip" : "Mint agent") : "Connect wallet"}
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
