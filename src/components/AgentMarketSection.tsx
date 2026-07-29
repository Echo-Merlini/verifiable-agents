"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { formatEther, parseEther, type Hex } from "viem";
import { Tag, Wallet, Loader2, Check, X, ShoppingCart, Pencil, ExternalLink, ShieldCheck, Store } from "lucide-react";
import { useWalletModal } from "@/hooks/useWalletModal";
import {
  AGENT_MARKET_ABI, AGENT_MARKET_ADDRESS, AGENT_MARKET_CHAIN_ID, AGENT_MARKET_FEE_BPS,
  ERC721_APPROVE_ABI, agentMarketConfigured, fetchActiveListings, explorerTx, type Listing,
} from "@/lib/agentMarketEscrow";

const GW = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const ipfsHttp = (u: string) => (u?.startsWith("ipfs://") ? "https://ipfs.io/ipfs/" + u.slice(7) : u);

type Owned = { registry: string; agent_id: string; name: string; image: string };
type Meta = { name: string; image: string };

async function ownedOf(addr: string): Promise<Owned[]> {
  try { const r = await fetch(`${GW}/agent/owned/${addr}`); return r.ok ? await r.json() : []; } catch { return []; }
}

export function AgentMarketSection() {
  const { address } = useAccount();
  const { open: openWallet } = useWalletModal();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const [listings, setListings] = useState<Listing[]>([]);
  const [meta, setMeta] = useState<Record<string, Meta>>({});   // tokenId(lower nft) → name/image
  const [owned, setOwned] = useState<Owned[]>([]);
  const [busy, setBusy] = useState<string | null>(null);         // key of the action in flight
  const [err, setErr] = useState<string | null>(null);
  const [priceFor, setPriceFor] = useState<string | null>(null); // which agent/listing has its price editor open
  const [priceInput, setPriceInput] = useState("");

  const metaKey = (nft: string, tokenId: string) => `${nft.toLowerCase()}:${tokenId}`;

  const load = useCallback(async () => {
    const ls = await fetchActiveListings();
    setListings(ls);
    // Listed NFTs are held by the escrow → its owned feed carries name/image for each.
    if (agentMarketConfigured) {
      const escrowed = await ownedOf(AGENT_MARKET_ADDRESS);
      const m: Record<string, Meta> = {};
      for (const a of escrowed) m[metaKey(a.registry, a.agent_id)] = { name: a.name, image: ipfsHttp(a.image) };
      setMeta(m);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (address) ownedOf(address).then(setOwned); else setOwned([]); }, [address]);

  const ensureChain = async () => { if (chainId !== AGENT_MARKET_CHAIN_ID) await switchChainAsync({ chainId: AGENT_MARKET_CHAIN_ID }); };
  const wait = async (hash: Hex) => { if (publicClient) await publicClient.waitForTransactionReceipt({ hash }); };

  const doBuy = async (l: Listing) => {
    if (!address) { openWallet(); return; }
    setErr(null); setBusy(`buy:${l.id}`);
    try {
      await ensureChain();
      const hash = await writeContractAsync({ address: AGENT_MARKET_ADDRESS as Hex, abi: AGENT_MARKET_ABI,
        functionName: "buy", args: [l.id], value: l.price, chainId: AGENT_MARKET_CHAIN_ID });
      await wait(hash); await load(); if (address) ownedOf(address).then(setOwned);
    } catch (e: any) { setErr(e?.shortMessage || e?.message || "Purchase failed"); }
    finally { setBusy(null); }
  };

  const doList = async (a: Owned) => {
    if (!priceInput || Number(priceInput) <= 0) { setErr("Set a price in ETH"); return; }
    setErr(null); setBusy(`list:${a.agent_id}`);
    try {
      await ensureChain();
      const priceWei = parseEther(priceInput as `${number}`);
      // 1. approve the escrow for this token, 2. list
      const ah = await writeContractAsync({ address: a.registry as Hex, abi: ERC721_APPROVE_ABI,
        functionName: "approve", args: [AGENT_MARKET_ADDRESS as Hex, BigInt(a.agent_id)], chainId: AGENT_MARKET_CHAIN_ID });
      await wait(ah);
      const lh = await writeContractAsync({ address: AGENT_MARKET_ADDRESS as Hex, abi: AGENT_MARKET_ABI,
        functionName: "list", args: [a.registry as Hex, BigInt(a.agent_id), priceWei], chainId: AGENT_MARKET_CHAIN_ID });
      await wait(lh);
      setPriceFor(null); setPriceInput(""); await load(); if (address) ownedOf(address).then(setOwned);
    } catch (e: any) { setErr(e?.shortMessage || e?.message || "Listing failed"); }
    finally { setBusy(null); }
  };

  const doCancel = async (l: Listing) => {
    setErr(null); setBusy(`cancel:${l.id}`);
    try {
      await ensureChain();
      const hash = await writeContractAsync({ address: AGENT_MARKET_ADDRESS as Hex, abi: AGENT_MARKET_ABI,
        functionName: "cancel", args: [l.id], chainId: AGENT_MARKET_CHAIN_ID });
      await wait(hash); await load(); if (address) ownedOf(address).then(setOwned);
    } catch (e: any) { setErr(e?.shortMessage || e?.message || "Cancel failed"); }
    finally { setBusy(null); }
  };

  const doSetPrice = async (l: Listing) => {
    if (!priceInput || Number(priceInput) <= 0) { setErr("Set a price in ETH"); return; }
    setErr(null); setBusy(`price:${l.id}`);
    try {
      await ensureChain();
      const hash = await writeContractAsync({ address: AGENT_MARKET_ADDRESS as Hex, abi: AGENT_MARKET_ABI,
        functionName: "setPrice", args: [l.id, parseEther(priceInput as `${number}`)], chainId: AGENT_MARKET_CHAIN_ID });
      await wait(hash); setPriceFor(null); setPriceInput(""); await load();
    } catch (e: any) { setErr(e?.shortMessage || e?.message || "Reprice failed"); }
    finally { setBusy(null); }
  };

  const you = address?.toLowerCase();
  const myListings = listings.filter((l) => l.seller.toLowerCase() === you);
  const forSale = listings; // everyone's active listings (incl. yours)
  const listedTokens = new Set(myListings.map((l) => metaKey(l.nft, l.tokenId)));
  // Your agents you still hold (not currently escrowed/listed) → these can be listed.
  const listable = owned.filter((a) => !listedTokens.has(metaKey(a.registry, a.agent_id)));

  const nameFor = (nft: string, tokenId: string) => meta[metaKey(nft, tokenId)]?.name || `Agent #${tokenId}`;
  const imageFor = (nft: string, tokenId: string) => meta[metaKey(nft, tokenId)]?.image || "";

  // Pre-launch: contract not deployed yet. Still show the owner their agents + a launch note.
  return (
    <section className="mt-10">
      <div className="flex items-center gap-3">
        <Tag className="h-5 w-5 text-brassLight" />
        <h2 className="font-display text-xl font-semibold">Agent market</h2>
      </div>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Buy and sell agents. Each sale settles through a non-custodial escrow and recomputes from the
        on-chain log — a sale proves an agent <span className="text-zinc-300">changed hands</span>, not that
        it's good. Reputation and reviews are separate facts, shown on each card.
      </p>
      {!agentMarketConfigured && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-brassLight/30 bg-brass/[0.06] px-3 py-1.5 text-[12px] text-brassLight/90">
          <Store className="h-3.5 w-3.5" /> Trading opens once the market contract is live.
        </p>
      )}
      {err && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-red-400"><X className="h-3.5 w-3.5" />{err}</p>}

      {/* ── FOR SALE (on top) ── */}
      {agentMarketConfigured && (
        <div className="mt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">For sale · {forSale.length}</p>
          {forSale.length === 0 ? (
            <p className="mt-2 text-[12px] text-gb-faint">No agents listed yet — list one below to open the market.</p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {forSale.map((l) => {
                const mine = l.seller.toLowerCase() === you;
                const editing = priceFor === `L${l.id}`;
                return (
                  <div key={l.id.toString()} className="liquid-glass flex flex-col rounded-2xl p-4 ring-1 ring-brassLight/30">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {imageFor(l.nft, l.tokenId) ? <img src={imageFor(l.nft, l.tokenId)} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/10" /> : <div className="h-12 w-12 rounded-xl bg-white/5 ring-1 ring-white/10" />}
                      <div className="min-w-0">
                        <p className="truncate font-display font-medium text-paper">{nameFor(l.nft, l.tokenId)}</p>
                        <p className="font-mono text-[11px] text-gb-faint">#{l.tokenId}{mine && " · yours"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gb-muted">Price</p>
                        <p className="font-display text-lg text-paper">{formatEther(l.price)} ETH</p>
                      </div>
                      {mine ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { setPriceFor(editing ? null : `L${l.id}`); setPriceInput(formatEther(l.price)); }} disabled={!!busy}
                            title="Reprice" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gb-muted hover:text-paper disabled:opacity-40"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => doCancel(l)} disabled={!!busy}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-400/40 bg-red-400/10 px-2.5 py-1.5 text-[11px] text-red-300 hover:bg-red-400/20 disabled:opacity-40">
                            {busy === `cancel:${l.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => doBuy(l)} disabled={!!busy}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brass px-4 py-2 font-display font-medium text-deepink hover:bg-brassLight disabled:opacity-40">
                          {busy === `buy:${l.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />} Buy
                        </button>
                      )}
                    </div>
                    {editing && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <input value={priceInput} onChange={(e) => setPriceInput(e.target.value)} inputMode="decimal" placeholder="ETH"
                          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-paper focus:border-brassLight/50 focus:outline-none" />
                        <button onClick={() => doSetPrice(l)} disabled={!!busy}
                          className="inline-flex items-center gap-1 rounded-lg bg-brass px-3 py-1.5 text-[11px] font-medium text-deepink hover:bg-brassLight disabled:opacity-40">
                          {busy === `price:${l.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Set
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── YOUR AGENTS (large card carousel) ── */}
      <div className="mt-7">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gb-muted">Your agents</p>
          {!address && (
            <button onClick={openWallet} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/90 hover:text-brassLight">
              <Wallet className="h-3.5 w-3.5" /> Connect
            </button>
          )}
        </div>
        {!address ? (
          <p className="mt-2 text-[12px] text-gb-faint">Connect your wallet to list an agent for sale.</p>
        ) : listable.length === 0 && myListings.length === 0 ? (
          <p className="mt-2 text-[12px] text-gb-faint">No agents in this wallet yet — <a href="/mint" className="text-brassLight hover:text-brass">mint one</a> to trade it.</p>
        ) : (
          <div className="mt-3 flex gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {listable.map((a) => {
              const editing = priceFor === `O${a.registry}:${a.agent_id}`;
              return (
                <div key={`${a.registry}:${a.agent_id}`} className="liquid-glass flex w-64 shrink-0 flex-col rounded-2xl border border-brassLight/25 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.image ? <img src={ipfsHttp(a.image)} alt={a.name} className="aspect-square w-full rounded-xl object-cover ring-1 ring-white/10" /> : <div className="aspect-square w-full rounded-xl bg-white/5 ring-1 ring-white/10" />}
                  <p className="mt-3 truncate font-display font-medium text-paper">{a.name || `Agent #${a.agent_id}`}</p>
                  <p className="font-mono text-[11px] text-gb-faint">#{a.agent_id}</p>
                  {agentMarketConfigured ? (
                    editing ? (
                      <div className="mt-3 flex items-center gap-1.5">
                        <input value={priceInput} onChange={(e) => setPriceInput(e.target.value)} inputMode="decimal" placeholder="Price in ETH" autoFocus
                          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-paper focus:border-brassLight/50 focus:outline-none" />
                        <button onClick={() => doList(a)} disabled={!!busy}
                          className="inline-flex items-center gap-1 rounded-lg bg-brass px-3 py-1.5 text-[11px] font-medium text-deepink hover:bg-brassLight disabled:opacity-40">
                          {busy === `list:${a.agent_id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />} List
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setPriceFor(`O${a.registry}:${a.agent_id}`); setPriceInput(""); setErr(null); }} disabled={!!busy}
                        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-brassLight/40 bg-white/5 px-3 py-2 text-[12px] text-brassLight hover:border-brassLight/70 disabled:opacity-40">
                        <Tag className="h-3.5 w-3.5" /> List for sale
                      </button>
                    )
                  ) : (
                    <a href="/demo" className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-gb-muted hover:text-paper">
                      <ShieldCheck className="h-3.5 w-3.5" /> Drive it
                    </a>
                  )}
                </div>
              );
            })}
            {/* your currently-listed agents (in escrow) — cancel/reprice from the For-sale cards above, shown here as a marker */}
            {myListings.map((l) => (
              <div key={`mine-${l.id}`} className="liquid-glass flex w-64 shrink-0 flex-col rounded-2xl border border-brassLight/40 bg-brass/[0.05] p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {imageFor(l.nft, l.tokenId) ? <img src={imageFor(l.nft, l.tokenId)} alt="" className="aspect-square w-full rounded-xl object-cover ring-1 ring-brassLight/30" /> : <div className="aspect-square w-full rounded-xl bg-white/5 ring-1 ring-brassLight/30" />}
                <p className="mt-3 truncate font-display font-medium text-paper">{nameFor(l.nft, l.tokenId)}</p>
                <p className="font-mono text-[11px] text-brassLight/80">Listed · {formatEther(l.price)} ETH</p>
                <button onClick={() => doCancel(l)} disabled={!!busy}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-400/40 bg-red-400/10 px-3 py-2 text-[12px] text-red-300 hover:bg-red-400/20 disabled:opacity-40">
                  {busy === `cancel:${l.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Cancel listing
                </button>
              </div>
            ))}
          </div>
        )}
        {agentMarketConfigured && AGENT_MARKET_FEE_BPS > 0 && (address && (listable.length > 0 || myListings.length > 0)) && (
          <p className="mt-2 font-mono text-[10px] text-gb-faint">Protocol fee on a sale: {(AGENT_MARKET_FEE_BPS / 100).toFixed(2)}% · settlement is non-custodial, your wallet signs.</p>
        )}
      </div>
    </section>
  );
}
