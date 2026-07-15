"use client";

import { useState, useEffect } from "react";
import { useWalletClient, useAccount, useReadContract, useChainId, useSwitchChain } from "wagmi";
import { parseEther, formatEther, type Hex } from "viem";
import { Loader2, Sparkles } from "lucide-react";
import {
  GENESIS_REGISTRY_ABI, GENESIS_REGISTRY_ADDRESS, GENESIS_CHAIN_ID,
  GENESIS_PHASE, GENESIS_PHASE_LABEL, isZero,
} from "@/lib/erc8004";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

export default function AdminGenesisPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();

  const registry = GENESIS_REGISTRY_ADDRESS;
  const ready = !isZero(registry);
  const readOpts = { address: registry, abi: GENESIS_REGISTRY_ABI, chainId: GENESIS_CHAIN_ID } as const;

  const { data: phase, refetch: rPhase } = useReadContract({ ...readOpts, functionName: "phase", query: { enabled: ready } });
  const { data: publicPrice, refetch: rPub } = useReadContract({ ...readOpts, functionName: "publicPrice", query: { enabled: ready } });
  const { data: allowlistPrice, refetch: rAl } = useReadContract({ ...readOpts, functionName: "allowlistPrice", query: { enabled: ready } });
  const { data: maxSupply, refetch: rMax } = useReadContract({ ...readOpts, functionName: "maxSupply", query: { enabled: ready } });
  const { data: totalSupply, refetch: rTot } = useReadContract({ ...readOpts, functionName: "totalSupply", query: { enabled: ready } });
  const { data: allowlistRoot, refetch: rRoot } = useReadContract({ ...readOpts, functionName: "allowlistRoot", query: { enabled: ready } });

  const [pubPriceInput, setPubPriceInput] = useState("");
  const [alPriceInput, setAlPriceInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function write(label: string, fn: string, args: readonly unknown[]) {
    if (!walletClient) return;
    setMsg(null); setBusy(label);
    try {
      if (chainId !== GENESIS_CHAIN_ID) await switchChainAsync({ chainId: GENESIS_CHAIN_ID });
      const hash = await walletClient.writeContract({
        address: registry, abi: GENESIS_REGISTRY_ABI, functionName: fn as any, args: args as any,
      });
      setMsg(`${label} sent: ${hash.slice(0, 10)}…`);
      setTimeout(() => { rPhase(); rPub(); rAl(); rMax(); rTot(); rRoot(); }, 4000);
    } catch (e: any) {
      setMsg(e?.shortMessage || e?.message || `${label} failed`);
    }
    setBusy(null);
  }

  async function syncRootFromGateway() {
    setMsg("Fetching allowlist root from gateway…");
    try {
      const r = await fetch(`${GW_URL}/api/genesis/allowlist-proof?address=0x0000000000000000000000000000000000000001`);
      const d = await r.json();
      if (!d.root) throw new Error("No root returned");
      await write("setAllowlistRoot", "setAllowlistRoot", [d.root as Hex]);
    } catch (e: any) {
      setMsg(e?.message || "Root sync failed");
    }
  }

  if (!mounted) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-amber-300" />
          <h1 className="text-xl font-semibold">Genesis registry — controls</h1>
        </div>
        <p className="text-xs text-white/40 mb-6">
          {ready ? registry : "NEXT_PUBLIC_GENESIS_REGISTRY_ADDRESS not set"} · chain {GENESIS_CHAIN_ID}
        </p>

        {!ready ? (
          <p className="text-amber-400 text-sm">Set the genesis registry address env and reload.</p>
        ) : !isConnected ? (
          <p className="text-amber-400 text-sm">Connect the owner wallet to manage the registry.</p>
        ) : (
          <div className="space-y-6">
            {/* status */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm grid grid-cols-2 gap-2">
              <Stat label="Phase" value={GENESIS_PHASE_LABEL[Number(phase ?? 0)]} />
              <Stat label="Supply" value={`${totalSupply ?? 0n}${maxSupply && (maxSupply as bigint) > 0n ? ` / ${maxSupply}` : " / ∞"}`} />
              <Stat label="Public price" value={publicPrice !== undefined ? `${formatEther(publicPrice as bigint)} ETH` : "…"} />
              <Stat label="Allowlist price" value={allowlistPrice !== undefined ? `${formatEther(allowlistPrice as bigint)} ETH` : "…"} />
              <Stat label="Allowlist root" value={allowlistRoot ? `${(allowlistRoot as string).slice(0, 10)}…` : "unset"} full />
            </div>

            {/* phase */}
            <Section title="Phase">
              <div className="flex gap-2">
                {(["Closed", "Allowlist", "Public"] as const).map((p) => (
                  <button key={p} disabled={!!busy}
                    onClick={() => write(`setPhase ${p}`, "setPhase", [GENESIS_PHASE[p]])}
                    className={`flex-1 py-2 rounded-lg text-sm ${
                      Number(phase ?? 0) === GENESIS_PHASE[p] ? "bg-amber-600" : "bg-white/10 hover:bg-white/15"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </Section>

            {/* prices */}
            <Section title="Prices (ETH)">
              <Row input={pubPriceInput} setInput={setPubPriceInput} placeholder="public price, e.g. 0.001"
                busy={busy === "setPublicPrice"} onClick={() => write("setPublicPrice", "setPublicPrice", [parseEther(pubPriceInput || "0")])} label="Set public" />
              <Row input={alPriceInput} setInput={setAlPriceInput} placeholder="allowlist price, e.g. 0"
                busy={busy === "setAllowlistPrice"} onClick={() => write("setAllowlistPrice", "setAllowlistPrice", [parseEther(alPriceInput || "0")])} label="Set allowlist" />
            </Section>

            {/* max supply */}
            <Section title="Max supply (0 = unlimited)">
              <Row input={maxInput} setInput={setMaxInput} placeholder="e.g. 1000"
                busy={busy === "setMaxSupply"} onClick={() => write("setMaxSupply", "setMaxSupply", [BigInt(maxInput || "0")])} label="Set cap" />
            </Section>

            {/* allowlist root */}
            <Section title="Allowlist root">
              <button disabled={!!busy} onClick={syncRootFromGateway}
                className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm">
                {busy === "setAllowlistRoot" ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Sync root from gateway allowlist"}
              </button>
              <p className="text-xs text-white/40 mt-1">
                Reads the current list from the gateway (GENESIS_ALLOWLIST / data/genesis-allowlist.json) and pins its Merkle root on-chain.
              </p>
            </Section>

            {msg && <p className="text-xs text-white/60 break-all">{msg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-white/40 text-xs">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Row({ input, setInput, placeholder, onClick, busy, label }: {
  input: string; setInput: (v: string) => void; placeholder: string; onClick: () => void; busy: boolean; label: string;
}) {
  return (
    <div className="flex gap-2">
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder}
        className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-amber-400/50" />
      <button disabled={busy} onClick={onClick}
        className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm disabled:opacity-40">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
      </button>
    </div>
  );
}
