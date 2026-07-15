"use client";

import { useState, useEffect } from "react";
import {
  useAccount, useReadContract, useWriteContract,
  useWaitForTransactionReceipt, useSwitchChain, useChainId,
} from "wagmi";
import { formatEther, type Address, type Hex } from "viem";
import {
  Sparkles, Wallet, Loader2, CheckCircle2, AlertCircle, Upload,
  Coins, Wrench, ExternalLink,
} from "lucide-react";
import {
  GENESIS_REGISTRY_ABI, GENESIS_REGISTRY_ADDRESS, GENESIS_CHAIN_ID,
  GENESIS_PHASE, GENESIS_PHASE_LABEL, GATEWAY_URL, isZero,
} from "@/lib/erc8004";
import { useWalletModal } from "@/hooks/useWalletModal";
import { NavMenu } from "@/components/NavMenu";
import { usePageRecords } from "@/hooks/usePageRecords";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const ENS_NAME = process.env.NEXT_PUBLIC_ENS_NAME || "dinamic.eth";

function GradientBg() {
  return (
    <div className="fixed inset-0 z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(99,102,241,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(129,140,248,0.1),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_80%,rgba(79,70,229,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
}
const EMPTY_META: readonly { metadataKey: string; metadataValue: Hex }[] = [];

type Step = "idle" | "pinning-image" | "pinning-meta" | "minting" | "confirming" | "claiming" | "done";

export default function MintAgentPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const { open: openWallet } = useWalletModal();
  // Inherit the site background/styling — mint-agent records merge with the
  // parent dinamic.eth records, so this picks up the shared `video` background.
  const tr = usePageRecords(`mint-agent.${ENS_NAME}`);
  const videoUrl = tr.video;
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();

  // ── form ──
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [useOwnTools, setUseOwnTools] = useState(false);

  // ── flow state ──
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [trialGranted, setTrialGranted] = useState<number | null>(null);

  const registry = GENESIS_REGISTRY_ADDRESS;
  const registryReady = !isZero(registry);

  // ── on-chain reads ──
  const readOpts = { address: registry, abi: GENESIS_REGISTRY_ABI, chainId: GENESIS_CHAIN_ID } as const;
  const { data: phase } = useReadContract({ ...readOpts, functionName: "phase", query: { enabled: registryReady } });
  const { data: publicPrice } = useReadContract({ ...readOpts, functionName: "publicPrice", query: { enabled: registryReady } });
  const { data: allowlistPrice } = useReadContract({ ...readOpts, functionName: "allowlistPrice", query: { enabled: registryReady } });
  const { data: totalSupply } = useReadContract({ ...readOpts, functionName: "totalSupply", query: { enabled: registryReady } });
  const { data: maxSupply } = useReadContract({ ...readOpts, functionName: "maxSupply", query: { enabled: registryReady } });

  const phaseNum = Number(phase ?? 0);
  const isAllowlist = phaseNum === GENESIS_PHASE.Allowlist;
  const isPublic = phaseNum === GENESIS_PHASE.Public;
  const open = isAllowlist || isPublic;
  const price = (isAllowlist ? allowlistPrice : publicPrice) as bigint | undefined;
  const priceEth = price !== undefined ? formatEther(price) : "…";
  const supplyLeft =
    maxSupply !== undefined && (maxSupply as bigint) > 0n
      ? Number((maxSupply as bigint) - (totalSupply ?? 0n))
      : null;

  const receipt = useWaitForTransactionReceipt({ hash: txHash ?? undefined, chainId: GENESIS_CHAIN_ID });

  // After the mint confirms → claim the free-trial wallet credits.
  useEffect(() => {
    if (step !== "confirming" || !receipt.isSuccess || !txHash) return;
    (async () => {
      setStep("claiming");
      try {
        const r = await fetch(`${GW_URL}/api/genesis/claim-trial`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash }),
        });
        const d = await r.json();
        setTrialGranted(typeof d.creditsGranted === "number" ? d.creditsGranted : 0);
      } catch {
        setTrialGranted(0);
      }
      setStep("done");
    })();
  }, [step, receipt.isSuccess, txHash]);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setImageFile(f);
    setImagePreview(f ? URL.createObjectURL(f) : null);
  }

  const canMint = isConnected && registryReady && open && !!name.trim() && !!imageFile && step === "idle";

  async function handleMint() {
    if (!canMint || !imageFile || !address) return;
    setError(null);
    try {
      if (chainId !== GENESIS_CHAIN_ID) {
        await switchChainAsync({ chainId: GENESIS_CHAIN_ID });
      }

      // 1. pin image
      setStep("pinning-image");
      const fd = new FormData();
      fd.append("file", imageFile);
      const imgRes = await fetch(`${GW_URL}/api/genesis/pin-image`, { method: "POST", body: fd });
      const imgData = await imgRes.json();
      if (!imgData.uri) throw new Error(imgData.error || "Image pin failed");

      // 2. pin metadata
      setStep("pinning-meta");
      const attributes = skills
        .split(",").map((s) => s.trim()).filter(Boolean)
        .map((value) => ({ trait_type: "skill", value }));
      const metaRes = await fetch(`${GW_URL}/api/genesis/pin-metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          image: imgData.uri,
          attributes,
          usesPlatformTools: !useOwnTools,
        }),
      });
      const metaData = await metaRes.json();
      if (!metaData.uri) throw new Error(metaData.error || "Metadata pin failed");

      // 3. mint (allowlist or public)
      setStep("minting");
      let hash: Hex;
      if (isAllowlist) {
        const pr = await fetch(`${GW_URL}/api/genesis/allowlist-proof?address=${address}`);
        const pd = await pr.json();
        if (!pd.listed) throw new Error("Your wallet is not on the allowlist for this phase.");
        hash = await writeContractAsync({
          address: registry, abi: GENESIS_REGISTRY_ABI, functionName: "mintAllowlist",
          args: [metaData.uri, EMPTY_META, (pd.proof ?? []) as readonly Hex[]],
          value: (allowlistPrice as bigint) ?? 0n, chainId: GENESIS_CHAIN_ID,
        });
      } else {
        hash = await writeContractAsync({
          address: registry, abi: GENESIS_REGISTRY_ABI, functionName: "mint",
          args: [metaData.uri, EMPTY_META],
          value: (publicPrice as bigint) ?? 0n, chainId: GENESIS_CHAIN_ID,
        });
      }
      setTxHash(hash);
      setStep("confirming");
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Mint failed");
      setStep("idle");
    }
  }

  if (!mounted) return <div className="min-h-screen bg-black" />;

  const busy = step !== "idle" && step !== "done";
  const stepLabel: Record<Step, string> = {
    idle: "", "pinning-image": "Pinning image to IPFS…", "pinning-meta": "Pinning metadata…",
    minting: "Confirm in your wallet…", confirming: "Waiting for confirmation…",
    claiming: "Granting your free credits…", done: "",
  };

  return (
    <div className="relative min-h-screen flex flex-col font-display text-white">
      <NavMenu currentPath="mint" />

      {videoUrl ? (
        <>
          <video src={videoUrl} autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover z-0" />
          <div className="fixed inset-0 z-0 bg-black/55" />
        </>
      ) : <GradientBg />}

      <div className="relative z-10 flex flex-col items-center pt-16 pb-20 px-4 min-h-screen">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h1 className="text-2xl font-semibold">Mint your agent</h1>
          </div>
          <p className="text-sm text-white/50 mb-6">
            Create a self-sovereign on-chain agent — no NFT required. It's born on the
            full stack: verifiable identity, recompute-checked records, and platform tools.
          </p>

          {/* phase / price banner */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-6 text-sm">
            {!registryReady ? (
              <span className="text-amber-400">Genesis registry not configured yet.</span>
            ) : !open ? (
              <span className="text-amber-400">
                Minting is currently <b>{GENESIS_PHASE_LABEL[phaseNum]}</b> — not open yet. Check back soon.
              </span>
            ) : (
              <div className="flex items-center justify-between">
                <span>
                  Phase: <b className="text-amber-300">{GENESIS_PHASE_LABEL[phaseNum]}</b>
                  {isAllowlist && <span className="text-white/40"> · allowlist only</span>}
                </span>
                <span>
                  {price === 0n ? "Free" : `${priceEth} ETH`}
                  {supplyLeft !== null && <span className="text-white/40"> · {supplyLeft} left</span>}
                </span>
              </div>
            )}
          </div>

          {step === "done" ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="font-medium mb-1">Agent minted!</p>
              {trialGranted && trialGranted > 0 ? (
                <p className="text-sm text-white/60 mb-3">
                  {trialGranted.toLocaleString()} free credits added to your wallet — enough to start using it right away.
                </p>
              ) : (
                <p className="text-sm text-white/60 mb-3">Your agent is live.</p>
              )}
              <div className="flex gap-2 justify-center text-sm">
                <a href="../my-agents/" className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15">My agents</a>
                <a href="../top-up/" className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15">Top up credits</a>
                {txHash && (
                  <a href={`${GENESIS_CHAIN_ID === 1 ? "https://etherscan.io" : "https://sepolia.etherscan.io"}/tx/${txHash}`} target="_blank" rel="noreferrer"
                     className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 inline-flex items-center gap-1">
                    tx <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* image */}
              <label className="block">
                <span className="text-xs font-medium text-white/70">Agent image</span>
                <div className="mt-1 flex items-center gap-3">
                  <div className="w-20 h-20 rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden flex items-center justify-center">
                    {imagePreview
                      ? <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                      : <Upload className="w-5 h-5 text-white/30" />}
                  </div>
                  <input type="file" accept="image/*" onChange={onPickImage} disabled={busy}
                         className="text-xs text-white/60 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white/10 file:text-white" />
                </div>
              </label>

              <Field label="Name" value={name} onChange={setName} placeholder="Wizgob Advisor" disabled={busy} />
              <Field label="Description" value={description} onChange={setDescription} placeholder="What your agent does…" disabled={busy} area />
              <Field label="Skills (comma-separated)" value={skills} onChange={setSkills} placeholder="research, trading, forensics" disabled={busy} />

              {/* platform vs BYO tools */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <ToolPath icon={<Coins className="w-4 h-4" />} active={!useOwnTools} onClick={() => setUseOwnTools(false)}
                  title="Use the platform stack" desc="Runs on our tools + MCP. Metered by per-wallet credits — minting grants you a free trial to start." />
                <ToolPath icon={<Wrench className="w-4 h-4" />} active={useOwnTools} onClick={() => setUseOwnTools(true)}
                  title="Bring your own tools" desc="Point the agent at your own MCP endpoint later (in agent settings). No platform credits consumed." />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
                </div>
              )}

              {!isConnected ? (
                <button onClick={openWallet}
                        className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 font-medium inline-flex items-center justify-center gap-2">
                  <Wallet className="w-4 h-4" /> Connect wallet
                </button>
              ) : (
                <button onClick={handleMint} disabled={!canMint}
                        className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium inline-flex items-center justify-center gap-2">
                  {busy
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{stepLabel[step]}</>
                    : <><Sparkles className="w-4 h-4" />Mint agent{price && price > 0n ? ` · ${priceEth} ETH` : ""}</>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled, area }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; area?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-white/70">{label}</span>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} rows={3}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-amber-400/50 disabled:opacity-50" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-amber-400/50 disabled:opacity-50" />
      )}
    </label>
  );
}

function ToolPath({ icon, title, desc, active, onClick }: {
  icon: React.ReactNode; title: string; desc: string; active: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left flex gap-3 p-2 rounded-lg border transition-colors ${
        active ? "border-amber-400/50 bg-amber-500/10" : "border-transparent hover:bg-white/5"}`}>
      <div className={`mt-0.5 ${active ? "text-amber-300" : "text-white/40"}`}>{icon}</div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-white/50">{desc}</div>
      </div>
    </button>
  );
}
