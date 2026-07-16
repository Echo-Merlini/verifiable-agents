"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSignMessage, useSendTransaction, useSignTypedData, useSwitchChain, useChainId, useAccount, usePublicClient } from "wagmi";
import { Send, ShieldCheck, ShieldX, Maximize2, Loader2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

export type ChatMsg =
  | { role: "user" | "assistant"; text: string }
  | { role: "approval"; approvalId: string; tool: string; input: Record<string, unknown>; riskSummary: string };

const DECLINE_REASONS = [
  { value: "user_rejected",         label: "Rejected" },
  { value: "slippage_too_high",      label: "Slippage too high" },
  { value: "contract_unverified",    label: "Contract unverified" },
  { value: "suspicious_destination", label: "Suspicious dest." },
  { value: "amount_too_large",       label: "Amount too large" },
  { value: "unknown",                label: "Other" },
];

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum", 10: "Optimism", 56: "BNB Chain", 100: "Gnosis",
  137: "Polygon", 8453: "Base", 42161: "Arbitrum", 43114: "Avalanche",
};

function ApprovalCard({
  approvalId, tool, input, riskSummary,
  ownerAddress, registry, agentId,
  onResolved,
}: {
  approvalId: string; tool: string; input: Record<string, unknown>; riskSummary: string;
  ownerAddress?: string; registry: string; agentId: string;
  onResolved: (action: "approved" | "declined") => void;
}) {
  const { signMessageAsync }        = useSignMessage();
  const { sendTransactionAsync }    = useSendTransaction();
  const { switchChainAsync }        = useSwitchChain();
  const currentChainId              = useChainId();
  const { address: connectedAddress } = useAccount();
  const txPublicClient              = usePublicClient({ chainId: (input.chainId as number) || undefined });
  const { signTypedDataAsync }      = useSignTypedData();
  const [declining, setDeclining]   = useState(false);
  const [reason, setReason]         = useState("user_rejected");
  const [working, setWorking]       = useState(false);
  const [error, setError]           = useState("");
  const [submittedTx, setSubmittedTx] = useState("");
  const [workingStep, setWorkingStep] = useState("");
  const [ageSeconds, setAgeSeconds]   = useState(0);

  const isTx        = tool === "send_transaction";
  const isSignTyped = tool === "sign_typed_data";

  useEffect(() => {
    if (!isTx && !isSignTyped) return;
    const t = setInterval(() => setAgeSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isTx]);

  const resolve = async (action: "approved" | "declined") => {
    setWorking(true);
    setError("");
    setWorkingStep("");
    try {
      let txHash: string | undefined;

      if (action === "approved" && isSignTyped) {
        setWorkingStep("Sign the order in your wallet…");
        const typedSig = await signTypedDataAsync({
          domain:      input.domain as any,
          types:       input.types  as any,
          primaryType: input.primaryType as string,
          message:     input.message as any,
        });
        const approvalMsg = `ens-approval:approved:${approvalId}`;
        const approvalSig = await signMessageAsync({ message: approvalMsg });
        const r2 = await fetch(`${GW_URL}/agent/approval/${approvalId}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approved", signature: approvalSig, note: typedSig }),
        });
        const d2 = await r2.json();
        if (!r2.ok) throw new Error(d2.error || "Failed");
        onResolved("approved");
        setWorking(false);
        return;
      }

      if (action === "approved" && isTx) {
        // Step 1: if refresh params exist, fetch fresh calldata to avoid stale-quote reverts
        let txTo      = input.to      as string;
        let txData    = (input.data   as string) || "0x";
        let txValue   = (input.value  as string) || "0";
        let txGasLimit = input.gasLimit as string | undefined;
        let txChainId  = (input.chainId as number) || undefined;
        if (input.refreshMcp && input.refreshTool && input.refreshArgs) {
          setWorkingStep("Fetching fresh swap quote…");
          const fr = await fetch(`${GW_URL}/agent/approval/${approvalId}/fresh-calldata`, { method: "POST" });
          if (fr.ok) {
            const fd = await fr.json();
            txTo       = fd.to      ?? txTo;
            txData     = fd.data    ?? txData;
            txValue    = fd.value   ?? txValue;
            txGasLimit = fd.gasLimit ? String(fd.gasLimit) : txGasLimit;
            txChainId  = fd.chainId ?? txChainId;
            if (fd.canAfford === false) {
              const shortEth = fd.shortfallWei
                ? (Number(BigInt(fd.shortfallWei)) / 1e18).toFixed(5)
                : "some";
              throw new Error(`Insufficient balance for the network fee. You need ~${shortEth} more ETH on this chain.`);
            }
            if (fd.gasEstimateWei) {
              const gasEth = (Number(BigInt(fd.gasEstimateWei)) / 1e18).toFixed(5);
              setWorkingStep(`Estimated fee: ~${gasEth} ETH — confirm in MetaMask…`);
            } else {
              setWorkingStep("Confirm the transaction in MetaMask…");
            }
          } else {
            setWorkingStep("Confirm the transaction in MetaMask…");
          }
        }
        // Ensure the wallet is on the tx's chain (e.g. a mainnet NFT buy after a
        // Sepolia consult escrow left the wallet on Sepolia) — wagmi rejects a mismatch.
        if (txChainId && currentChainId !== txChainId) {
          setWorkingStep("Switching your wallet to the right network…");
          await switchChainAsync({ chainId: txChainId });
        }
        // If the agent didn't supply a gas limit, estimate it ourselves on the tx's
        // chain and pass it explicitly — the wallet's own estimate often fails right
        // after a network switch (e.g. Seaport NFT buys → "can't calculate the fee").
        if (!txGasLimit && txPublicClient && connectedAddress) {
          try {
            const est = await txPublicClient.estimateGas({
              account: connectedAddress as `0x${string}`,
              to:      txTo   as `0x${string}`,
              data:    txData as `0x${string}`,
              value:   BigInt(txValue),
            });
            txGasLimit = String((est * 13n) / 10n); // +30% headroom
          } catch { /* fall back to wallet estimation */ }
        }
        if (!txGasLimit) setWorkingStep("Confirm the transaction in MetaMask…");
        txHash = await sendTransactionAsync({
          to:      txTo as `0x${string}`,
          data:    txData as `0x${string}`,
          value:   BigInt(txValue),
          chainId: txChainId,
          ...(txGasLimit ? { gas: BigInt(txGasLimit) } : {}),
        });
        if (!txHash) throw new Error("Wallet returned no transaction hash. The transaction was not sent.");
        setSubmittedTx(txHash);
        setWorkingStep("Transaction sent! Now sign the approval…");
      }
      const message = `ens-approval:${action}:${approvalId}`;
      const signature = await signMessageAsync({ message });

      const r = await fetch(`${GW_URL}/agent/approval/${approvalId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: action === "declined" ? reason : undefined,
          signature,
          note: txHash,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      onResolved(action);
    } catch (e: any) {
      const msg = e.message ?? "";
      setError(
        msg.includes("user rejected") || msg.includes("User denied")
          ? "Cancelled."
          : msg || "Error"
      );
    }
    setWorking(false);
  };

  const cardType  = (input.cardType as string) || (isTx ? "tx" : isSignTyped ? "limit_order" : "generic");
  const valueEth  = isTx && input.value
    ? (Number(input.value as string) / 1e18).toFixed(6).replace(/\.?0+$/, "")
    : null;
  const chainName = isTx && input.chainId
    ? (CHAIN_NAMES[input.chainId as number] ?? `Chain ${input.chainId}`)
    : null;

  const THEMES: Record<string, { border: string; bg: string; hBorder: string; hBg: string; dot: string; title: string }> = {
    swap:    { border: "border-amber-500/30",   bg: "bg-amber-500/5",   hBorder: "border-amber-500/20",   hBg: "bg-amber-500/8",   dot: "bg-amber-400",   title: "text-amber-300"   },
    bridge:  { border: "border-amber-500/30", bg: "bg-amber-500/5", hBorder: "border-amber-500/20", hBg: "bg-amber-500/8", dot: "bg-amber-400", title: "text-amber-300" },
    nft_buy: { border: "border-amber-500/30", bg: "bg-amber-500/5", hBorder: "border-amber-500/20", hBg: "bg-amber-500/8", dot: "bg-amber-400", title: "text-amber-300" },
    approve: { border: "border-amber-500/30",  bg: "bg-amber-500/5",  hBorder: "border-amber-500/20",  hBg: "bg-amber-500/8",  dot: "bg-amber-400",  title: "text-amber-300"  },
    tx:      { border: "border-amber-500/30",   bg: "bg-amber-500/5",   hBorder: "border-amber-500/20",   hBg: "bg-amber-500/8",   dot: "bg-amber-400",   title: "text-amber-300"   },
    generic:     { border: "border-amber-500/30",  bg: "bg-amber-500/5",  hBorder: "border-amber-500/20",  hBg: "bg-amber-500/8",  dot: "bg-amber-400",  title: "text-amber-300"  },
    limit_order: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", hBorder: "border-emerald-500/20", hBg: "bg-emerald-500/8", dot: "bg-emerald-400", title: "text-emerald-300" },
    permit:      { border: "border-teal-500/30",    bg: "bg-teal-500/5",    hBorder: "border-teal-500/20",    hBg: "bg-teal-500/8",    dot: "bg-teal-400",    title: "text-teal-300"    },
  };
  const theme = THEMES[cardType] ?? THEMES.generic;

  const HEADER_TITLES: Record<string, string> = {
    swap:    "Swap request",
    bridge:  "Bridge request",
    nft_buy: "NFT purchase",
    approve: "Token approval required",
    tx:      "Transaction request",
    generic:     "Agent wants to execute a write action",
    limit_order: "Limit order",
    permit:      "Token permit",
  };
  const headerTitle = HEADER_TITLES[cardType] ?? HEADER_TITLES.generic;

  const APPROVE_LABELS: Record<string, string> = {
    swap:    "Send Transaction",
    bridge:  "Send Transaction",
    nft_buy: "Buy NFT",
    approve: "Approve Token",
    tx:      "Send Transaction",
    generic:     "Approve",
    limit_order: "Place Order",
    permit:      "Sign Permit",
  };
  const approveLabel = APPROVE_LABELS[cardType] ?? "Approve";
  const cancelLabel  = isTx ? "Cancel" : "Decline";

  return (
    <div className={`rounded-2xl border overflow-hidden text-xs ${theme.border} ${theme.bg}`}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${theme.hBorder} ${theme.hBg}`}>
        <span className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${theme.dot}`} />
        <span className={`font-semibold ${theme.title}`}>{headerTitle}</span>
      </div>

      <div className="p-3 space-y-2.5">

        {/* ── Signature notice: tell the user what this signature DOES ── */}
        {isTx ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-amber-200">
            <span className="shrink-0">⚠</span>
            <span><b>On-chain transaction.</b> Signing sends a real transaction — it moves funds{valueEth ? ` (${valueEth} ETH)` : ""}{chainName ? ` on ${chainName}` : ""} and costs gas. Only approve if you recognise it.</span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-200">
            <span className="shrink-0">✓</span>
            <span><b>Off-chain signature — no funds move, no gas.</b> This only authorises the agent / records a provenance proof (e.g. KYA). Nothing leaves your wallet.</span>
          </div>
        )}

        {/* ── Swap card ─────────────────────────────────────── */}
        {cardType === "swap" && (
          <>
            {!!input.description && <p className="text-white/80 font-medium leading-snug">{input.description as string}</p>}
            {(!!input.amountIn || !!input.amountOut) && (
              <div className="flex items-center gap-2 py-1">
                <span className="text-xl font-bold text-white">{input.amountIn as string}</span>
                <span className="text-white/40 text-lg">→</span>
                <span className="text-xl font-bold text-white">{input.amountOut as string}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-[10px] text-white/40 flex-wrap">
              {!!input.dex && <span>via {input.dex as string}</span>}
              {!!input.gasCostUsd && <span>Gas ~{input.gasCostUsd as string}</span>}
              {chainName        && <span>{chainName}</span>}
            </div>
            <div>
              <span className="text-white/30 uppercase tracking-wide text-[10px]">Contract</span>
              <p className="font-mono text-white/30 mt-0.5 truncate text-[10px]">{input.to as string}</p>
            </div>
          </>
        )}

        {/* ── Bridge card ───────────────────────────────────── */}
        {cardType === "bridge" && (
          <>
            {!!input.description && <p className="text-white/80 font-medium leading-snug">{input.description as string}</p>}
            {(!!input.fromChain || !!input.toChain) && (
              <div className="flex items-center gap-2 py-0.5">
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px]">{input.fromChain as string}</span>
                <span className="text-white/40">→</span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px]">{input.toChain as string}</span>
              </div>
            )}
            {(!!input.amountIn || !!input.amountOut) && (
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white">{input.amountIn as string}</span>
                <span className="text-white/40 text-lg">→</span>
                <span className="text-xl font-bold text-white">{input.amountOut as string}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-[10px] text-white/40 flex-wrap">
              {!!input.dex && <span>via {input.dex as string}</span>}
              {!!input.gasCostUsd && <span>Fees ~{input.gasCostUsd as string}</span>}
            </div>
          </>
        )}

        {/* ── NFT buy card ──────────────────────────────────── */}
        {cardType === "nft_buy" && (
          <>
            <div className="flex gap-3">
              {!!input.nftImage && (
                <img src={input.nftImage as string} alt={input.nftName as string}
                  className="w-16 h-16 rounded-xl object-cover shrink-0 border border-white/10" />
              )}
              <div className="min-w-0 flex flex-col justify-center">
                <p className="text-white/80 font-medium truncate">{input.nftName as string}</p>
                {!!input.nftCollection && <p className="text-white/40 text-[10px] truncate">{input.nftCollection as string}</p>}
                {!!input.nftFloorPrice && <p className="text-white/30 text-[10px] mt-0.5">Floor: {input.nftFloorPrice as string}</p>}
              </div>
            </div>
            {valueEth && valueEth !== "0" && (
              <div className="flex items-baseline gap-1.5 py-0.5">
                <span className="text-2xl font-bold text-white">{valueEth}</span>
                <span className="text-sm text-white/50">ETH</span>
              </div>
            )}
            <div>
              <span className="text-white/30 uppercase tracking-wide text-[10px]">Seaport contract</span>
              <p className="font-mono text-white/30 mt-0.5 truncate text-[10px]">{input.to as string}</p>
            </div>
          </>
        )}

        {/* ── ERC-20 approve card ───────────────────────────── */}
        {cardType === "approve" && (
          <>
            <div className="flex items-center gap-1.5 text-amber-300/80 font-medium">
              <span>Step 1 of 2</span>
              <span className="text-white/20">·</span>
              <span className="text-white/50 font-normal text-[10px]">Token approval before swap</span>
            </div>
            {!!input.description && <p className="text-white/70 leading-snug">{input.description as string}</p>}
            <div className="rounded-lg bg-black/20 p-2.5 space-y-1.5 text-[11px]">
              {!!input.tokenIn && (
                <div className="flex justify-between">
                  <span className="text-white/40">Token</span>
                  <span className="text-white/80 font-medium">{input.tokenIn as string}</span>
                </div>
              )}
              {!!input.amountIn && (
                <div className="flex justify-between">
                  <span className="text-white/40">Amount</span>
                  <span className="text-white/70">{input.amountIn as string}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-white/40">Spender</span>
                <span className="text-white/70">
                  {(input.spenderName as string) || `${(input.spender as string || input.to as string || "").slice(0,8)}…`}
                </span>
              </div>
            </div>
            <p className="text-white/25 text-[10px] leading-relaxed">
              This only grants spending permission — no funds move yet. The swap transaction follows next.
            </p>
          </>
        )}

        {/* ── Generic tx fallback ───────────────────────────── */}
        {cardType === "tx" && (
          <>
            {!!input.description && <p className="text-white/80 font-medium leading-snug">{input.description as string}</p>}
            {valueEth && valueEth !== "0" && (
              <div className="flex items-baseline gap-1.5 py-1">
                <span className="text-2xl font-bold text-white">{valueEth}</span>
                <span className="text-sm text-white/50">ETH</span>
                {chainName && <span className="text-[10px] text-white/30 ml-1">on {chainName}</span>}
              </div>
            )}
            <div>
              <span className="text-white/30 uppercase tracking-wide text-[10px]">Contract</span>
              <p className="font-mono text-white/30 mt-0.5 truncate text-[10px]">{input.to as string}</p>
            </div>
          </>
        )}

        {/* ── Generic write-tool fallback ───────────────────── */}
        {/* ── Limit order card ─────────────────────────────────── */}
        {(cardType === "limit_order" || cardType === "permit") && (
          <>
            {!!input.description && <p className="text-white/80 font-medium leading-snug">{input.description as string}</p>}
            {(!!input.amountIn || !!input.amountOut) && (
              <div className="flex items-center gap-2 py-1">
                <span className="text-xl font-bold text-white">{input.amountIn as string}</span>
                <span className="text-white/40 text-lg">→</span>
                <span className="text-xl font-bold text-white">{input.amountOut as string}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-[10px] text-white/40 flex-wrap">
              {!!input.dex    && <span>via {input.dex as string}</span>}
              {!!input.expiry && <span>Expires: {input.expiry as string}</span>}
            </div>
            <div className="mt-1 text-[10px] text-emerald-400/70 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-2 py-1.5">
              No gas needed · Signature only · Funds stay in your wallet until filled
            </div>
          </>
        )}

        {cardType === "generic" && (
          <>
            <div>
              <span className="text-white/40 uppercase tracking-wide text-[10px]">Tool</span>
              <p className="font-mono text-amber-300 mt-0.5">{tool}</p>
            </div>
            {Object.keys(input).length > 0 && (
              <div>
                <span className="text-white/40 uppercase tracking-wide text-[10px]">Parameters</span>
                <pre className="mt-0.5 bg-black/30 rounded-lg p-2 text-[10px] text-white/50 overflow-auto max-h-24 font-mono whitespace-pre-wrap">{JSON.stringify(input, null, 2)}</pre>
              </div>
            )}
          </>
        )}

        {/* ── Shared footer fields ──────────────────────────── */}
        {riskSummary && (
          <div>
            <span className="text-white/40 uppercase tracking-wide text-[10px]">Risk</span>
            <p className="text-white/60 mt-0.5 leading-relaxed">{riskSummary}</p>
          </div>
        )}
        {submittedTx && (
          <p className="text-[10px] text-amber-300/70 font-mono break-all">
            Tx: {submittedTx.slice(0,10)}…{submittedTx.slice(-8)} — check Etherscan
          </p>
        )}
        {working && workingStep && <p className="text-[10px] text-white/40 italic">{workingStep}</p>}
        {error && <p className="text-red-400 text-[10px]">{error}</p>}
        {declining && (
          <div className="flex flex-wrap gap-1">
            {DECLINE_REASONS.map(r => (
              <button key={r.value} onClick={() => setReason(r.value)}
                className={"text-[10px] px-2 py-0.5 rounded-full border transition-colors " + (reason === r.value ? "bg-red-500/20 border-red-500/40 text-red-300" : "border-white/10 text-white/40 hover:text-white/70")}>
                {r.label}
              </button>
            ))}
          </div>
        )}
        {(isTx || isSignTyped) && ageSeconds > 20 && !submittedTx && (
          <p className={"text-[10px] font-medium " + (ageSeconds > 45 ? "text-red-400" : "text-amber-400")}>
            {ageSeconds > 45
              ? "Quote likely expired — decline and ask for a fresh swap."
              : "Quote expires soon (" + (60 - ageSeconds) + "s) — send quickly."}
          </p>
        )}

        {/* ── Buttons ───────────────────────────────────────── */}
        <div className="flex gap-2 pt-0.5">
          {!declining ? (
            <>
              <button onClick={() => resolve("approved")} disabled={working}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border disabled:opacity-40 transition-colors ${isTx ? "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-300" : isSignTyped ? "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300" : "bg-green-500/15 hover:bg-green-500/25 border-green-500/30 text-green-300"}`}>
                {working ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                {approveLabel}
              </button>
              <button onClick={() => setDeclining(true)} disabled={working}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 disabled:opacity-40 transition-colors">
                <ShieldX className="w-3 h-3" /> {cancelLabel}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => resolve("declined")} disabled={working}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 disabled:opacity-40 transition-colors">
                {working ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldX className="w-3 h-3" />}
                Confirm
              </button>
              <button onClick={() => setDeclining(false)} disabled={working}
                className="px-3 py-1.5 rounded-xl border border-white/10 text-white/40 hover:text-white/70 transition-colors">
                Back
              </button>
            </>
          )}
        </div>
        <p className="text-[10px] text-white/20">
          {isTx ? "MetaMask opens twice: ① send the transaction, ② sign approval. Gas fees are extra." : isSignTyped ? "Sign the order with your wallet. No gas needed — signature only." : "Sign with your wallet to confirm this decision."}
        </p>
      </div>
    </div>
  );
}

// ── NFT suggestion cards ──────────────────────────────────────────────────────
// The agent emits a ```nft-suggestions fenced block (a JSON array) when it
// recommends NFTs to buy. We parse it out of the assistant message and render a
// gallery of cards with Accept / Decline. Accept replays into the normal
// opensea_buy_nft approval flow; Decline just dismisses the card locally.
type Suggestion = {
  name?: string; collection?: string; image?: string;
  price_eth?: string | number; token_id?: string; contract?: string; chain?: string;
  order_hash?: string; protocol_address?: string;
  traits?: { type: string; value: unknown }[];
};

// Candidate blocks that might hold a suggestions array, in priority order. We're
// lenient because the model doesn't always use the exact ```nft-suggestions fence:
// it may emit ```json, a plain ``` block, or a bare [ {...} ] array.
const SUGGESTION_BLOCK_RES: RegExp[] = [
  /```nft-suggestions\s*([\s\S]*?)```/,        // preferred, tagged fence
  /```(?:json)?\s*(\[\s*\{[\s\S]*?\}\s*\])\s*```/, // any fenced JSON array
  /(\[\s*\{[\s\S]*?"order_hash"[\s\S]*?\}\s*\])/,  // bare array mentioning order_hash
];

function extractSuggestions(text: string): { clean: string; items: Suggestion[] } | null {
  for (const re of SUGGESTION_BLOCK_RES) {
    const m = text.match(re);
    if (!m) continue;
    let items: Suggestion[];
    try {
      const parsed = JSON.parse(m[1].trim());
      items = Array.isArray(parsed) ? parsed : [];
    } catch { continue; }
    items = items.filter((s) => s && s.order_hash && s.protocol_address); // need these to buy
    if (!items.length) continue;
    return { clean: text.replace(m[0], "").trim(), items };
  }
  // Salvage: if the array was truncated (model overran) or unfenced, pull out any
  // COMPLETE {…} objects that carry the buy fields — the cut-off trailing one is skipped.
  const items: Suggestion[] = [];
  const objRe = /\{[^{}]*?"order_hash"[^{}]*?\}/g;
  let om: RegExpExecArray | null;
  while ((om = objRe.exec(text))) {
    try { const o = JSON.parse(om[0]); if (o?.order_hash && o?.protocol_address) items.push(o); } catch { /* skip */ }
  }
  if (items.length) {
    const cut = text.search(/```(?:nft-suggestions)?|\[\s*\{/);
    const clean = (cut >= 0 ? text.slice(0, cut) : text).replace(/```\s*$/, "").trim();
    return { clean, items };
  }
  return null;
}

function SuggestionCard({ s, onAccept, onDecline, disabled }: {
  s: Suggestion; onAccept: () => void; onDecline: () => void; disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2 text-xs">
      <div className="flex gap-3">
        {!!s.image && (
          <img src={s.image} alt={s.name ?? ""} className="w-16 h-16 rounded-xl object-cover shrink-0 border border-white/10" />
        )}
        <div className="min-w-0 flex flex-col justify-center">
          <p className="text-white/80 font-medium truncate">{s.name ?? `#${s.token_id ?? "?"}`}</p>
          {!!s.collection && <p className="text-white/40 text-[10px] truncate">{s.collection}</p>}
          {s.price_eth != null && s.price_eth !== "" && (
            <p className="text-white/80 mt-0.5"><span className="text-lg font-bold">{s.price_eth}</span> <span className="text-white/40 text-[10px]">ETH</span></p>
          )}
        </div>
      </div>
      {!!s.traits?.length && (
        <div className="flex flex-wrap gap-1">
          {s.traits.slice(0, 4).map((t, i) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-md bg-black/20 text-white/40">{t.type}: {String(t.value)}</span>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-0.5">
        <button onClick={onAccept} disabled={disabled}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border bg-green-500/15 hover:bg-green-500/25 border-green-500/30 text-green-300 disabled:opacity-40 transition-colors">
          <ShieldCheck className="w-3 h-3" /> Accept
        </button>
        <button onClick={onDecline} disabled={disabled}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 disabled:opacity-40 transition-colors">
          <ShieldX className="w-3 h-3" /> Decline
        </button>
      </div>
    </div>
  );
}

function SuggestionGallery({ items, onAccept, disabled }: {
  items: Suggestion[]; onAccept: (s: Suggestion) => void; disabled?: boolean;
}) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const visible = items.map((it, idx) => ({ it, idx })).filter(({ idx }) => !dismissed.has(idx));
  if (!visible.length) return <p className="text-[10px] text-white/25 mt-1">No suggestions left — ask for more.</p>;
  return (
    <div className="flex flex-col gap-2 mt-1.5 w-full">
      {visible.map(({ it, idx }) => (
        <SuggestionCard key={idx} s={it} disabled={disabled}
          onAccept={() => onAccept(it)}
          onDecline={() => setDismissed((prev) => new Set(prev).add(idx))} />
      ))}
    </div>
  );
}

export function AgentChat({
  registry, agentId, ownerAddress, authToken, onCreditError,
  compact = false, onReady,
}: {
  registry: string; agentId: string; ownerAddress?: string; authToken?: string;
  onCreditError?: () => void;
  compact?: boolean;
  // Hands the parent a way to send a message programmatically (e.g. an MCP
  // selector card that auto-sends a prompt). Non-invasive: just exposes sendMessage.
  onReady?: (send: (payload: string, displayText?: string) => void) => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [lowCredits, setLowCredits] = useState(false);
  const [lowDismissed, setLowDismissed] = useState(false);
  const sessionId  = useRef(`chat-${agentId}-${Date.now()}`);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const cardRef     = useRef<HTMLDivElement>(null);
  const pollRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const abortRef   = useRef<AbortController | null>(null);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }, [messages]);

  useEffect(() => () => {
    mountedRef.current = false;
    if (pollRef.current) clearTimeout(pollRef.current);
    abortRef.current?.abort();
  }, []);

  const poll = useCallback(async (jobId: string, startedAt: number) => {
    if (!mountedRef.current) return;
    try {
      abortRef.current = new AbortController();
      const jr = await fetch(`${GW_URL}/agent/job/${jobId}`, { signal: abortRef.current.signal });
      const jd = await jr.json();

      if (jd.status === "done") {
        if (!mountedRef.current) return;
        setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", text: jd.result ?? "Done" }; return n; });
        setLoading(false);
        // Check registry credits — warn if running low
        fetch(`${GW_URL}/api/registry/${registry}/credits`).then(r => r.json()).then(d => {
          if (typeof d.credits === "number" && d.credits <= 5) setLowCredits(true);
        }).catch(() => {});
      } else if (jd.status === "error") {
        if (!mountedRef.current) return;
        setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", text: "Error: " + jd.error }; return n; });
        setLoading(false);
      } else if (jd.status === "awaiting_approval") {
        // Fetch approval details and swap the spinner for an approval card
        if (!mountedRef.current) return;
        const ar = await fetch(`${GW_URL}/agent/approval/${jd.approvalId}`, { signal: abortRef.current?.signal });
        const ad = await ar.json();
        if (!mountedRef.current) return;
        setMessages(prev => {
          const n = [...prev];
          const last = n[n.length - 1];
          if (last.role === "approval" && last.approvalId === jd.approvalId) return prev;
          n[n.length - 1] = {
            role: "approval",
            approvalId: jd.approvalId,
            tool: ad.tool ?? "unknown",
            input: ad.input ?? {},
            riskSummary: ad.risk_summary ?? "",
          };
          return n;
        });
        // Keep polling after user resolves — backend will resume to done/error
        pollRef.current = setTimeout(() => poll(jobId, startedAt), 3000);
      } else {
        if (!mountedRef.current) return;
        const secs = Math.floor((Date.now() - startedAt) / 1000);
        setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", text: "⏳ Working on it… (" + secs + "s)" }; return n; });
        pollRef.current = setTimeout(() => poll(jobId, startedAt), 5000);
      }
    } catch (e: any) {
      if (!mountedRef.current || e?.name === "AbortError") return;
      setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", text: "Connection error — try again." }; return n; });
      setLoading(false);
    }
  }, []);

  // Send a message to the agent. `payload` is what the agent receives; `displayText`
  // (optional) is the user bubble shown in the chat — used so an Accepted suggestion
  // shows a friendly "🛒 Buy …" bubble while the agent gets full buy instructions.
  const sendMessage = useCallback(async (payload: string, displayText?: string) => {
    const msg = payload.trim();
    if (!msg || loading) return;
    setMessages(prev => [...prev, { role: "user", text: displayText ?? msg }]);
    setLoading(true);
    try {
      const creditSource = (typeof window !== "undefined"
        && localStorage.getItem(`creditSource:${registry.toLowerCase()}`)) || "pool";
      const r = await fetch(`${GW_URL}/agent/${registry}/${agentId}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Credit-Source": creditSource,
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "tools/call",
          params: { name: "chat", arguments: { message: msg, sessionId: sessionId.current } },
        }),
      });
      const d = await r.json();
      if (d.result?.jobId) {
        setMessages(prev => [...prev, { role: "assistant", text: "⏳ Working on it…" }]);
        pollRef.current = setTimeout(() => poll(d.result.jobId, Date.now()), 5000);
      } else {
        let reply: string;
        const topupUrl = ownerAddress ? `/top-up/?address=${ownerAddress}` : "/top-up/";
        if (d.error?.code === -32002) {
          // pool_exhausted. Only switch a real owner to their own wallet credits — a
          // walletless visitor must NOT get stuck in "wallet" mode (it would never
          // flip back after the pool refills), so we leave their source on pool.
          const wc = typeof d.error?.walletCredits === "number" ? d.error.walletCredits : null;
          if (ownerAddress && typeof window !== "undefined") {
            localStorage.setItem(`creditSource:${registry.toLowerCase()}`, "wallet");
            reply = wc && wc > 0
              ? `The community pool is empty — switched to **your credits** (${wc} left). Send your message again to continue.`
              : `The community pool is empty and you have no personal credits. [Top up here](${topupUrl}) to keep chatting.`;
          } else {
            reply = `This agent's community pool is momentarily empty — try again in a bit.`;
          }
          onCreditError?.();
        } else if (d.error?.code === -32001) {
          // No wallet credits charged — either genuinely out, or unauthenticated. For a
          // walletless visitor this usually means a stale "wallet" override from a past
          // pool-exhaustion — self-heal by resetting to pool so the next send retries it.
          if (!ownerAddress && typeof window !== "undefined") localStorage.removeItem(`creditSource:${registry.toLowerCase()}`);
          onCreditError?.();
          reply = ownerAddress
            ? `Couldn't charge credits. If you have a balance, your session may have expired — **sign in again**. Otherwise [top up here](${topupUrl}).`
            : `Reset your credit source — **send your message again** and it'll use the community pool.`;
        } else {
          reply = d.result?.content?.[0]?.text ?? d.error?.message ?? "No response";
        }
        setMessages(prev => [...prev, { role: "assistant", text: reply }]);
        setLoading(false);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Connection error — try again." }]);
      setLoading(false);
    }
  }, [loading, registry, agentId, ownerAddress, authToken, poll]);

  const send = useCallback(() => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    sendMessage(msg);
  }, [input, loading, sendMessage]);

  // Expose sendMessage to the parent (MCP selector cards auto-send a prompt).
  useEffect(() => { onReady?.(sendMessage); }, [onReady, sendMessage]);

  // Accept on a suggestion card → ask the agent to buy that listing, which runs the
  // normal opensea_buy_nft → approval-card → wallet-sign flow.
  const acceptSuggestion = useCallback((s: Suggestion) => {
    if (loading) return;
    const label = s.name ?? `#${s.token_id ?? ""}`;
    const payload =
      `Buy this listing now using opensea_buy_nft. ` +
      `order_hash: ${s.order_hash}; protocol_address: ${s.protocol_address}; ` +
      `chain: ${s.chain ?? "ethereum"}; buyer_address: ${ownerAddress ?? "my connected wallet"}; ` +
      `nft: ${label}${s.collection ? ` from ${s.collection}` : ""} (${s.contract}:${s.token_id}), price ${s.price_eth ?? "?"} ETH.`;
    sendMessage(payload, `🛒 Buy ${label}`);
  }, [loading, ownerAddress, sendMessage]);

  const chatBase = process.env.NEXT_PUBLIC_CHAT_BASE ?? "/chat";
  const chatPath = `${chatBase}?registry=${registry}&agentId=${agentId}`;

  return (
    <div className={"flex flex-col gap-2 " + (compact ? "pt-3 border-t border-white/8" : "h-full")}>
      {/* Header row with expand link */}
      <div className="flex items-center justify-between">
        {compact && <span className="text-[10px] text-white/25 uppercase tracking-widest">Chat</span>}
        <a href={chatPath}
          className={"flex items-center gap-1 text-[10px] text-white/30 hover:text-amber-300 transition-colors " + (compact ? "" : "ml-auto")}>
          <Maximize2 className="w-3 h-3" />
          {compact ? "Full chat" : ""}
        </a>
      </div>

      {/* Messages */}
      <div className={"flex flex-col gap-2 overflow-y-auto pb-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full " + (compact ? "max-h-52" : "flex-1 min-h-0")}
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.2) transparent" }}>
        {messages.length === 0 && (
          <p className="text-[11px] text-white/25 text-center py-3">Say something…</p>
        )}
        {messages.map((m, i) => {
          if (m.role === "approval") {
            return (
              <div key={i} ref={i === messages.length - 1 ? cardRef : null}>
                <ApprovalCard
                  key={i}
                  approvalId={m.approvalId}
                  tool={m.tool}
                  input={m.input}
                  riskSummary={m.riskSummary}
                  ownerAddress={ownerAddress}
                  registry={registry}
                  agentId={agentId}
                  onResolved={(action) => {
                    setMessages(prev => {
                      const n = [...prev];
                      n[i] = { role: "assistant", text: action === "approved" ? "✅ Approved — continuing…" : "❌ Declined — the agent will adjust its approach." };
                      return n;
                    });
                    if (action === "declined") setLoading(false);
                  }}
                />
              </div>
            );
          }
          if (m.role === "assistant") {
            const sug = extractSuggestions(m.text);
            const body = sug ? sug.clean : m.text;
            return (
              <div key={i} className="flex flex-col items-start gap-1.5 w-full">
                {!!body && (
                  <div className="flex justify-start max-w-[85%]">
                    <div className="px-3 py-2 rounded-2xl text-xs leading-relaxed bg-white/8 text-white/70 rounded-bl-sm">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p:      ({children}) => <p className="mb-1 last:mb-0">{children}</p>,
                          code:   ({inline, children}: any) => inline
                            ? <code className="bg-black/40 rounded px-1 font-mono text-amber-300">{children}</code>
                            : <pre className="bg-black/40 rounded-lg p-2 mt-1 mb-1 overflow-auto font-mono text-[10px] text-white/70 whitespace-pre-wrap"><code>{children}</code></pre>,
                          a:      ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 underline">{children}</a>,
                          ul:     ({children}) => <ul className="list-disc list-inside mb-1 space-y-0.5">{children}</ul>,
                          ol:     ({children}) => <ol className="list-decimal list-inside mb-1 space-y-0.5">{children}</ol>,
                          strong: ({children}) => <strong className="text-white/90 font-semibold">{children}</strong>,
                          h1: ({children}) => <p className="font-semibold text-white/80 mb-1">{children}</p>,
                          h2: ({children}) => <p className="font-semibold text-white/80 mb-1">{children}</p>,
                          h3: ({children}) => <p className="font-medium text-white/70 mb-0.5">{children}</p>,
                        }}
                      >{body}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {sug && (
                  <div className="w-full sm:max-w-[92%] mx-auto">
                    <SuggestionGallery items={sug.items} onAccept={acceptSuggestion} disabled={loading} />
                  </div>
                )}
              </div>
            );
          }
          return (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed bg-amber-500/20 text-white/80 rounded-br-sm">
                {m.text}
              </div>
            </div>
          );
        })}
        {loading && messages[messages.length - 1]?.role !== "approval" && (
          <div className="flex justify-start">
            <div className="bg-white/8 px-3 py-2.5 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Low credits warning */}
      {lowCredits && !lowDismissed && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <button onClick={() => setLowDismissed(true)} title="Dismiss" aria-label="Dismiss"
              className="text-amber-300/50 hover:text-amber-200 transition-colors shrink-0">
              <X className="w-3 h-3" />
            </button>
            <span className="text-amber-300/80 truncate">Low credits — chat may stop soon.</span>
          </div>
          <a href={ownerAddress ? `/top-up/?address=${ownerAddress}` : "/top-up/"} className="text-amber-300 hover:text-amber-200 underline shrink-0">Top up</a>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message…"
          disabled={loading}
          className="flex-1 bg-white/5 border border-white/10 focus:border-white/25 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none transition-colors disabled:opacity-50"
        />
        <button onClick={send} disabled={!input.trim() || loading}
          className="w-7 h-7 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 flex items-center justify-center disabled:opacity-30 transition-colors shrink-0">
          <Send className="w-3 h-3 text-amber-300" />
        </button>
      </div>
    </div>
  );
}
