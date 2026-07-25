"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { mainnet } from "@reown/appkit/networks";
import { type Hex } from "viem";
import { TopNav } from "@/components/TopNav";

// One-click ENSIP-25 agent-registration record for "Eth Global LX Agent '26" (RKB #5) on
// trustless-ai.eth — written to the name's ACTUAL resolver (0xF291), where standard resolution
// reads. (The dinamic app / old MCP wrote to the PublicResolver 0x231b0ee1, which the name
// doesn't point to, so it was invisible.) Non-custodial: the owner's own wallet signs.
const RESOLVER = "0xF29100983E058B709F3D539b0c765937B804AC15" as const;
const NAME = "trustless-ai.eth";
const NODE = "0x10fa3d22935a94b65bcfe085f719a5db6afe733511213f4f76d0bd2206b9bfb0" as Hex;
const KEY = "agent-registration[0x000100000101148b5af3a59f81c7e16617e8eb824bc6ffb792a2c3][5]";
const VALUE = "1";
const SET_TEXT_ABI = [{
  type: "function", name: "setText", stateMutability: "nonpayable",
  inputs: [{ name: "node", type: "bytes32" }, { name: "key", type: "string" }, { name: "value", type: "string" }],
  outputs: [],
}] as const;

export default function SetRecordPage() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [hash, setHash] = useState<Hex | undefined>();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash });

  async function submit() {
    setErr(""); setBusy(true);
    try {
      if (chainId !== mainnet.id) await switchChainAsync({ chainId: mainnet.id });
      const h = await writeContractAsync({
        address: RESOLVER, abi: SET_TEXT_ABI, functionName: "setText",
        args: [NODE, KEY, VALUE], chainId: mainnet.id,
      });
      setHash(h);
    } catch (e: unknown) {
      const m = e as { shortMessage?: string; message?: string };
      setErr(m?.shortMessage || m?.message || String(e));
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <TopNav />
      <div className="mx-auto max-w-xl px-5 py-14">
        <h1 className="font-display text-2xl text-paper">Set the ENSIP-25 agent record</h1>
        <p className="mt-2 text-[13px] text-gb-muted">
          Writes the agent-registration record to <span className="text-paper/80">{NAME}</span>&apos;s <span className="text-paper/80">active</span> resolver, so it&apos;s readable by standard ENS resolution. Non-custodial — your own wallet signs, and you must own {NAME}.
        </p>
        <div className="mt-5 space-y-1 rounded-2xl border border-white/10 bg-white/[0.02] p-5 font-mono text-[11px]">
          <div><span className="text-paper/40">name </span><span className="text-paper/80">{NAME}</span></div>
          <div><span className="text-paper/40">resolver </span><span className="break-all text-paper/80">{RESOLVER}</span></div>
          <div><span className="text-paper/40">key </span><span className="break-all text-paper/80">{KEY}</span></div>
          <div><span className="text-paper/40">value </span><span className="text-paper/80">{VALUE}</span></div>
        </div>
        <div className="mt-5">
          {!isConnected ? (
            <button onClick={() => open()} className="rounded-full bg-brass px-5 py-2.5 text-[13px] font-medium text-ink hover:bg-brassLight">
              Connect wallet
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] text-gb-muted">Connected: <span className="font-mono text-paper/80">{address}</span></p>
              <button onClick={submit} disabled={busy || mining} className="rounded-full bg-brass px-5 py-2.5 text-[13px] font-medium text-ink hover:bg-brassLight disabled:opacity-50">
                {busy ? "Confirm in wallet…" : mining ? "Mining…" : "Sign & set record"}
              </button>
            </div>
          )}
        </div>
        {hash && (
          <p className="mt-4 text-[12px]">
            <a className="text-brassLight underline decoration-brassLight/30 underline-offset-2" href={`https://etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">
              {isSuccess ? "✓ Confirmed on-chain" : "View transaction"} — {hash.slice(0, 16)}…
            </a>
          </p>
        )}
        {err && <p className="mt-4 text-[12px] text-red-300">{err}</p>}
      </div>
    </main>
  );
}
