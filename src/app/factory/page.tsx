"use client";

import { useState, useEffect } from "react";
import {
  useAccount, useDisconnect,
  useReadContract, useWriteContract, useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { useWalletModal } from "@/hooks/useWalletModal";
import { parseEther, formatEther, type Address } from "viem";
import {
  Wallet, Rocket, CheckCircle2, ExternalLink,
  ChevronDown, ChevronUp, Copy, Check, Loader2, AlertCircle,
  Zap, Shield, Coins, ArrowRight, Factory,
} from "lucide-react";
import { useDisplayName } from "@/hooks/useDisplayName";
import { usePageRecords } from "@/hooks/usePageRecords";
import { NavMenu } from "@/components/NavMenu";

const FACADE_ADDRESS = (process.env.NEXT_PUBLIC_FACADE_ADDRESS || "") as Address;
const GW_URL         = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const ENS_NAME       = process.env.NEXT_PUBLIC_ENS_NAME    || "dinamic.eth";

const FACADE_ABI = [
  { type: "function", name: "deploymentFee",  inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "initialCredits", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  {
    type: "function", name: "deployRegistry",
    inputs: [
      { name: "sourceCollection", type: "address" },
      { name: "cfg", type: "tuple", components: [
        { name: "name",            type: "string"  },
        { name: "symbol",          type: "string"  },
        { name: "baseAgentURI",    type: "string"  },
        { name: "registryAdmin",   type: "address" },
        { name: "mintPrice",       type: "uint256" },
        { name: "treasury",        type: "address" },
        { name: "royaltyReceiver", type: "address" },
        { name: "royaltyBps",      type: "uint96"  },
      ]},
    ],
    outputs: [{ name: "registry", type: "address" }],
    stateMutability: "payable",
  },
] as const;

function isAddress(s: string) { return /^0x[0-9a-fA-F]{40}$/.test(s); }
function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }

// ── Shared sub-components ─────────────────────────────────────────────────────

function GradientBg() {
  return (
    <div className="fixed inset-0 z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(99,102,241,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(129,140,248,0.1),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_80%,rgba(79,70,229,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-black/60" />
      {/* What's included card */}
      <div className="relative z-10 w-full px-4 lg:px-6 pb-6">
        <div className="liquid-glass-strong rounded-3xl p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <p className="text-sm font-semibold text-white">Everything included in one deployment fee</p>
              <p className="text-xs text-white/40 mt-0.5">No subscriptions, no hidden costs — one transaction and your registry is live.</p>
            </div>
            <div className="shrink-0 flex items-center gap-2 liquid-glass rounded-2xl px-4 py-2">
              <span className="text-xs text-white/40">Full release price</span>
              <span className="text-sm font-semibold text-amber-300">0.1 ETH</span>
              <span className="text-[10px] text-amber-400/80 border border-amber-400/20 rounded-full px-2 py-0.5 ml-1">Testing rate active</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: "⬡",
                title: "Smart Contract Deploy",
                desc: "A fresh ERC-721 agent registry contract is deployed to Ethereum mainnet — fully owned by you, no proxy, no admin backdoor.",
              },
              {
                icon: "📦",
                title: "IPFS Metadata Storage",
                desc: "Agent metadata and collection assets are pinned to IPFS via Pinata. CIDs are permanent and censorship-resistant.",
              },
              {
                icon: "⚡",
                title: "Gateway Access & Credits",
                desc: "Your registry is registered on the ENSub gateway and receives starter AI credits — enough for your first holders to start chatting immediately.",
              },
              {
                icon: "🔗",
                title: "ENS-KIT/1 Compliance",
                desc: "Agents get offchain ENS subdomains, CCIP-Read resolution, and text records out of the box — compatible with any ENS-aware app.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.04] border border-white/6">
                <span className="text-xl">{icon}</span>
                <p className="text-xs font-semibold text-white/80">{title}</p>
                <p className="text-[11px] text-white/40 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { open }       = useWalletModal();
  const { disconnect } = useDisconnect();
  const displayName    = useDisplayName(address);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-9 w-24 rounded-full liquid-glass animate-pulse" />;

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-xs text-white/70 hover:text-white transition-colors"
        title={address}
      >
        <span className="font-mono">{displayName}</span>
      </button>
    );
  }
  return (
    <button
      onClick={() => open()}
      className="liquid-glass-strong rounded-full px-4 py-2 flex items-center gap-2 text-xs font-medium text-white hover:scale-105 active:scale-95 transition-transform"
    >
      <Wallet className="w-3.5 h-3.5" />
      <span>Connect</span>
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors liquid-glass rounded-full px-2.5 py-1"
    >
      {copied ? <Check className="w-2.5 h-2.5 text-green-400" /> : <Copy className="w-2.5 h-2.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, mono, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-white/50 uppercase tracking-wide">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white/[0.06] border border-white/10 focus:border-white/30 rounded-xl px-3 py-2.5 text-sm text-white/90 placeholder-white/20 outline-none transition-colors ${mono ? "font-mono text-xs" : ""}`}
      />
      {hint && <p className="text-[10px] text-white/30 leading-relaxed">{hint}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FactoryPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected } = useAccount();
  const { open }       = useWalletModal();
  const { disconnect } = useDisconnect();
  const publicClient   = usePublicClient();

  const tr       = usePageRecords(`factory.${ENS_NAME}`);
  const cardBg   = tr.card_bg;
  const videoUrl = tr.video;

  const { data: deploymentFee } = useReadContract({
    address: FACADE_ADDRESS || undefined,
    abi: FACADE_ABI,
    functionName: "deploymentFee",
    query: { enabled: !!FACADE_ADDRESS },
  });
  const { data: initialCredits } = useReadContract({
    address: FACADE_ADDRESS || undefined,
    abi: FACADE_ABI,
    functionName: "initialCredits",
    query: { enabled: !!FACADE_ADDRESS },
  });

  const [sourceCollection, setSourceCollection] = useState("");
  const [name,             setName]             = useState("");
  const [symbol,           setSymbol]           = useState("");
  const [showAdvanced,     setShowAdvanced]      = useState(false);
  const [baseAgentURI,     setBaseAgentURI]      = useState(GW_URL + "/");
  const [mintPriceEth,     setMintPriceEth]      = useState("0.001");
  const [treasury,         setTreasury]          = useState("");
  const [royaltyReceiver,  setRoyaltyReceiver]   = useState("");
  const [royaltyBps,       setRoyaltyBps]        = useState("500");
  const [deployedRegistry, setDeployedRegistry]  = useState<string | null>(null);
  const [deploying,        setDeploying]         = useState(false);
  const [deployError,      setDeployError]       = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    if (!treasury)        setTreasury(address);
    if (!royaltyReceiver) setRoyaltyReceiver(address);
  }, [address]);

  const { writeContractAsync } = useWriteContract();

  const feeEth  = deploymentFee !== undefined ? formatEther(deploymentFee) : null;
  const credits = initialCredits !== undefined ? initialCredits.toString() : null;

  const notDeployed = !FACADE_ADDRESS;

  const canDeploy =
    isConnected && !!FACADE_ADDRESS &&
    isAddress(sourceCollection) && name.trim().length > 0 && symbol.trim().length > 0 &&
    isAddress(treasury) && isAddress(royaltyReceiver) &&
    !deploying && !deployedRegistry;

  async function handleDeploy() {
    if (!canDeploy || deploymentFee === undefined || !address) return;
    setDeploying(true); setDeployError(null);
    try {
      const hash = await writeContractAsync({
        address: FACADE_ADDRESS,
        abi: FACADE_ABI,
        functionName: "deployRegistry",
        value: deploymentFee,
        args: [
          sourceCollection as Address,
          {
            name:            name.trim(),
            symbol:          symbol.trim().toUpperCase(),
            baseAgentURI,
            registryAdmin:   address,
            mintPrice:       parseEther(mintPriceEth || "0"),
            treasury:        treasury as Address,
            royaltyReceiver: royaltyReceiver as Address,
            royaltyBps:      BigInt(Math.round(Number(royaltyBps) || 0)),
          },
        ],
      });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      // PublicDeployed topics: [sig, deployer, sourceCollection, registry]
      const log = receipt.logs.find(l => l.topics.length >= 4);
      const addr = log?.topics[3] ? "0x" + log.topics[3].slice(26) : null;
      setDeployedRegistry(addr ?? "check tx");
      // Activate credits on the gateway (fire-and-forget, non-blocking)
      if (addr && addr !== "check tx") {
        fetch(`${GW_URL}/api/registry/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: hash, registryAddress: addr }),
        }).catch(() => {});
      }
    } catch (e: any) { setDeployError(e.shortMessage ?? e.message); }
    finally { setDeploying(false); }
  }

  if (!mounted) return <div className="min-h-screen bg-black" />;

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col font-display">

      <NavMenu currentPath="factory" />

      {/* Background */}
      {videoUrl ? (
        <>
          <video src={videoUrl} autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover z-0" />
          <div className="fixed inset-0 z-0 bg-black/50" />
        </>
      ) : (
        <GradientBg />
      )}

      {/* Hero header */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center pt-16 pb-10 px-6 text-center">
        <h1 className="text-6xl lg:text-8xl font-medium tracking-[-0.05em] text-white leading-none mb-5">
          factory<em className="font-serif not-italic text-white/60">.dinamic.eth</em>
        </h1>
        <p className="text-sm lg:text-base text-white/40 font-light max-w-lg leading-relaxed">
          Deploy your own agent registry — permissionless, on-chain, fully yours.<br className="hidden sm:block" />
          Each NFT holder in your collection gets a unique AI agent identity.
        </p>

        {/* Stats strip */}
        {!notDeployed && (
          <div className="mt-8 w-full liquid-glass-strong rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-8">
              <div className="text-left">
                <p className="text-xs text-white/40 mb-0.5">Deployment fee</p>
                <p className="text-xl font-semibold text-white">
                  {feeEth !== null ? `${feeEth} ETH` : <Loader2 className="w-4 h-4 animate-spin inline" />}
                </p>
              </div>
              <div className="text-left">
                <p className="text-xs text-white/40 mb-0.5">AI credits included</p>
                <p className="text-xl font-semibold text-white">
                  {credits !== null ? Number(credits).toLocaleString() : <Loader2 className="w-4 h-4 animate-spin inline" />}
                </p>
              </div>
            </div>
            <ConnectButton />
          </div>
        )}
      </div>

      {/* Main content row */}
      <div className="relative z-10 flex flex-col lg:flex-row flex-1 pb-16">

        {/* Left — feature panel */}
        <div className="w-full lg:w-[45%] flex flex-col p-4 lg:p-6">
          <div
            className="liquid-glass-strong rounded-3xl flex flex-col p-6 lg:p-8 relative overflow-hidden gap-6"
            style={cardBg ? { backgroundImage: `url(${cardBg})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          >
            {cardBg && <div className="absolute inset-0 rounded-3xl bg-black/40 backdrop-blur-sm z-0" />}
            <div className="relative z-10 flex flex-col gap-6">

              {/* Nav */}
              <nav className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                    <Factory className="w-4 h-4 text-white/70" />
                  </div>
                  <span className="text-sm font-medium text-white/80">Agent Registry Factory</span>
                </div>
                <div className="hidden lg:block"><ConnectButton /></div>
              </nav>

              {/* Feature list */}
              <div className="flex flex-col gap-4 mt-2">
                {[
                  {
                    icon: <Zap className="w-4 h-4 text-amber-400" />,
                    title: "Permissionless & on-chain",
                    desc: "Your registry is an independent smart contract — fully owned by you, no admin keys, no approvals.",
                  },
                  {
                    icon: <Shield className="w-4 h-4 text-amber-400" />,
                    title: `${credits ? Number(credits).toLocaleString() : "—"} AI credits included`,
                    desc: "Every new registry gets a starter credit pack for agent chat interactions on the gateway.",
                  },
                  {
                    icon: <Coins className="w-4 h-4 text-amber-400" />,
                    title: "You control the economics",
                    desc: "Set your own mint price, treasury address, and royalty parameters at deploy time.",
                  },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex gap-3">
                    <div className="mt-0.5 shrink-0">{icon}</div>
                    <div>
                      <p className="text-sm font-medium text-white/80">{title}</p>
                      <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tech badges */}
              <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-white/8">
                {["ERC-8004", "ERC-721", "ERC-2981", "ENSIP-25", "Non-custodial"].map(b => (
                  <div key={b} className="liquid-glass rounded-full px-3 py-1 text-xs text-white/60">{b}</div>
                ))}
              </div>

              {/* Link to agents */}
              <a href="../agents/"
                className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors w-fit"
              >
                Browse live agents
                <ArrowRight className="w-3 h-3" />
              </a>

            </div>
          </div>
        </div>

        {/* Right — deploy form */}
        <div className="w-full lg:w-[55%] flex flex-col p-4 lg:p-6 lg:pl-0">
          <div className="liquid-glass-strong rounded-3xl p-6 lg:p-8 flex flex-col gap-6">

            {/* Coming soon state */}
            {notDeployed && (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl liquid-glass flex items-center justify-center">
                  <Factory className="w-6 h-6 text-white/30" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white/70">Coming soon</p>
                  <p className="text-xs text-white/30 mt-1">The factory contract is being deployed. Check back shortly.</p>
                </div>
              </div>
            )}

            {/* Deploy form */}
            {!notDeployed && !deployedRegistry && (
              <>
                <div>
                  <p className="text-base font-semibold text-white mb-1">Deploy Your Registry</p>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Link your NFT collection to an on-chain agent registry. Ownership is verified at mint — nothing is locked.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <Field
                    label="NFT Collection Address"
                    value={sourceCollection}
                    onChange={setSourceCollection}
                    placeholder="0x… your ERC-721 contract"
                    mono
                    hint="The existing NFT collection whose holders can claim agent identities."
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Registry Name" value={name} onChange={setName} placeholder="My Goblin Agents" />
                    <Field label="Symbol" value={symbol} onChange={v => setSymbol(v.toUpperCase())} placeholder="MGA" />
                  </div>
                </div>

                {/* Advanced toggle */}
                <button
                  onClick={() => setShowAdvanced(p => !p)}
                  className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors w-fit"
                >
                  {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Advanced settings
                </button>

                {showAdvanced && (
                  <div className="flex flex-col gap-4 pt-1 border-t border-white/8">
                    <Field label="Base Agent URI" value={baseAgentURI} onChange={setBaseAgentURI}
                      placeholder={GW_URL + "/"} hint="Gateway endpoint for agent metadata. Defaults to ENSub gateway." />
                    <Field label="Mint Price (ETH)" value={mintPriceEth} onChange={setMintPriceEth}
                      placeholder="0.001" hint="Price holders pay to mint an agent NFT. Can be 0." />
                    <Field label="Treasury Address" value={treasury} onChange={setTreasury}
                      placeholder={address || "0x…"} mono hint="Receives mint proceeds." />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Royalty Receiver" value={royaltyReceiver} onChange={setRoyaltyReceiver}
                        placeholder={address || "0x…"} mono />
                      <Field label="Royalty BPS" value={royaltyBps} onChange={setRoyaltyBps}
                        placeholder="500" hint="500 = 5%" />
                    </div>
                  </div>
                )}

                {deployError && (
                  <div className="flex gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {deployError}
                  </div>
                )}

                {!isConnected ? (
                  <button
                    onClick={() => open()}
                    className="liquid-glass-strong rounded-full px-6 py-3 flex items-center justify-center gap-2.5 text-sm font-medium text-white hover:scale-105 active:scale-95 transition-transform"
                  >
                    <Wallet className="w-4 h-4" />
                    Connect Wallet to Deploy
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs text-white/35">
                      <span>Connected: <span className="font-mono">{shortAddr(address!)}</span></span>
                      <button onClick={() => disconnect()} className="hover:text-white/60 transition-colors">Disconnect</button>
                    </div>
                    <button
                      onClick={handleDeploy}
                      disabled={!canDeploy}
                      className="liquid-glass-strong rounded-full px-6 py-3 flex items-center justify-center gap-2.5 text-sm font-medium text-white hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-transform"
                    >
                      {deploying ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Deploying…</>
                      ) : (
                        <>
                          <Rocket className="w-4 h-4" />
                          Deploy Registry · {feeEth !== null ? `${feeEth} ETH` : "…"}
                        </>
                      )}
                    </button>
                  </div>
                )}

                <p className="text-[11px] text-white/20 text-center leading-relaxed">
                  Deployment is permanent. You retain full ownership of the registry contract.
                </p>
              </>
            )}

            {/* Success */}
            {deployedRegistry && (
              <div className="flex flex-col items-center gap-6 py-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
                <div>
                  <p className="text-lg font-semibold text-white">Registry deployed!</p>
                  <p className="text-xs text-white/40 mt-1">
                    {credits ? `${Number(credits).toLocaleString()} AI credits are on their way.` : "Credits will be credited shortly."}
                  </p>
                </div>
                <div className="w-full liquid-glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-white/70 truncate">{deployedRegistry}</span>
                  <CopyButton text={deployedRegistry} />
                </div>
                <div className="flex items-center gap-4">
                  <a href="../agents/"
                    className="liquid-glass-strong rounded-full px-5 py-2.5 flex items-center gap-2 text-sm font-medium text-white hover:scale-105 active:scale-95 transition-transform"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    Browse agents
                  </a>
                  <a href={`https://etherscan.io/address/${deployedRegistry}`} target="_blank" rel="noreferrer"
                    className="liquid-glass rounded-full px-4 py-2.5 flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Etherscan
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
