"use client";

import { useEffect, useMemo, useState } from "react";
import { keccak256, toBytes, parseEther, formatEther } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { Loader2, Store, Plus, ExternalLink, Check, ShieldCheck } from "lucide-react";
import { fetchPremiumMcps, fetchMarketAgents, type PremiumMcp, type MarketAgent } from "@/lib/marketplace";
import { MCP_ENTITLEMENT_REGISTER_ABI } from "@/lib/mcpEntitlementDeploy";

const EXPLORER: Record<number, string> = { 1: "https://etherscan.io", 84532: "https://sepolia.basescan.org" };

export default function AdminMarketplacePage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [mcps, setMcps] = useState<PremiumMcp[]>([]);
  const [agents, setAgents] = useState<MarketAgent[]>([]);
  const [loading, setLoading] = useState(true);

  // registerMcp form
  const [slug, setSlug] = useState("ens-write");
  const [priceEth, setPriceEth] = useState("0.001");
  const [payTo, setPayTo] = useState("");
  const [durationDays, setDurationDays] = useState("0");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const contract = useMemo(() => mcps.find((m) => m.contract)?.contract ?? null, [mcps]);
  const chainId = useMemo(() => mcps[0]?.chainId ?? 1, [mcps]);
  const explorer = EXPLORER[chainId] ?? EXPLORER[1];

  function load() {
    Promise.all([fetchPremiumMcps(), fetchMarketAgents()]).then(([m, a]) => {
      setMcps(m); setAgents(a); setLoading(false);
      if (!payTo && m[0]?.payTo) setPayTo(m[0].payTo);
    });
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function registerMcp() {
    setErr(null); setMsg(null);
    if (!walletClient || !address) { setErr("Connect the owner wallet."); return; }
    if (!contract) { setErr("Registry not deployed — deploy it from the Deploy tab first."); return; }
    try {
      setBusy(true);
      const mcpId = keccak256(toBytes(slug.trim()));
      const price = parseEther((priceEth || "0").trim());
      const duration = BigInt(Math.max(0, Math.floor(Number(durationDays) || 0)) * 86400);
      const hash = await walletClient.writeContract({
        address: contract as `0x${string}`,
        abi: MCP_ENTITLEMENT_REGISTER_ABI,
        functionName: "registerMcp",
        args: [mcpId, price, payTo as `0x${string}`, duration, active],
      });
      setMsg(`registerMcp sent: ${hash}`);
      setTimeout(load, 4000);
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || "registerMcp failed");
    } finally {
      setBusy(false);
    }
  }

  const held = useMemo(() => agents.filter((a) => (a.entitlements ?? []).length > 0), [agents]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-100">
          <Store className="h-5 w-5 text-brassLight" /> Marketplace
        </h1>
        <p className="mt-0.5 text-xs text-gb-muted">
          Premium MCP capabilities — purchased and carried by the agent NFT. Registry:{" "}
          {contract ? (
            <a href={`${explorer}/address/${contract}`} target="_blank" rel="noreferrer" className="font-mono text-brassLight hover:underline">{contract}</a>
          ) : <span className="text-amber-300">not deployed (Deploy tab)</span>}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gb-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          {/* Catalog */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mcps.map((m) => (
              <div key={m.slug} className="liquid-glass rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-slate-100">{m.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ring-1 ${m.registered ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25" : "bg-amber-400/10 text-amber-200 ring-amber-300/25"}`}>
                    {m.registered ? (m.active ? "active" : "inactive") : "unregistered"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gb-muted">{m.tagline}</p>
                <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px] text-gb-muted">
                  <span>price {formatEther(BigInt(m.price || "0"))} ETH</span>
                  <span>payTo {m.payTo ? `${m.payTo.slice(0, 6)}…${m.payTo.slice(-4)}` : "—"}</span>
                  <span className="col-span-2 break-all">mcpId {m.mcpId.slice(0, 18)}…</span>
                </div>
              </div>
            ))}
          </div>

          {/* registerMcp form */}
          <div className="liquid-glass rounded-xl p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Plus className="h-4 w-4" /> Register / update a premium MCP</h2>
            <p className="mt-1 text-xs text-gb-muted">Owner-only on-chain call. mcpId = keccak256(slug). Duration 0 = perpetual.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-[11px] text-gb-muted">Slug
                <input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 w-full rounded-lg bg-black/30 px-2.5 py-1.5 font-mono text-sm text-slate-100 ring-1 ring-white/[0.08]" />
              </label>
              <label className="text-[11px] text-gb-muted">Price (ETH)
                <input value={priceEth} onChange={(e) => setPriceEth(e.target.value)} className="mt-1 w-full rounded-lg bg-black/30 px-2.5 py-1.5 font-mono text-sm text-slate-100 ring-1 ring-white/[0.08]" />
              </label>
              <label className="text-[11px] text-gb-muted">payTo
                <input value={payTo} onChange={(e) => setPayTo(e.target.value)} placeholder="0x…" className="mt-1 w-full rounded-lg bg-black/30 px-2.5 py-1.5 font-mono text-sm text-slate-100 ring-1 ring-white/[0.08]" />
              </label>
              <label className="text-[11px] text-gb-muted">Duration (days, 0 = perpetual)
                <input value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="mt-1 w-full rounded-lg bg-black/30 px-2.5 py-1.5 font-mono text-sm text-slate-100 ring-1 ring-white/[0.08]" />
              </label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-gb-muted">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (purchasable)
            </label>
            <button
              onClick={registerMcp}
              disabled={busy || !contract}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brass/90 px-3 py-2 text-sm font-medium text-white transition enabled:hover:bg-brass disabled:opacity-50"
            >
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><ShieldCheck className="h-4 w-4" /> registerMcp</>}
            </button>
            {msg && <p className="mt-2 break-all text-[11px] text-emerald-300">{msg}</p>}
            {err && <p className="mt-2 text-[11px] text-rose-300">{err}</p>}
          </div>

          {/* Entitlements overview */}
          <div className="liquid-glass rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-100">Entitlements held</h2>
            {held.length === 0 ? (
              <p className="mt-1 text-xs text-gb-muted">No agent holds a premium capability yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {held.map((a) => (
                  <li key={`${a.registry}:${a.agentId}`} className="flex items-center gap-2 text-sm text-slate-200">
                    <span className="font-mono text-[11px] text-gb-muted">#{a.agentId}</span>
                    <span>{a.name || "—"}</span>
                    <span className="ml-auto flex flex-wrap items-center gap-1.5">
                      {(a.entitlements ?? []).map((slug) => (
                        <span key={slug} className="inline-flex items-center gap-1 rounded-full bg-brass/12 px-2 py-0.5 text-[11px] text-brassLight ring-1 ring-brass/25">
                          {slug} <Check className="h-3 w-3" />
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
