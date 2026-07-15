"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useDisconnect,
  useEnsName,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useWalletModal } from "@/hooks/useWalletModal";
import { formatEther, namehash, type Address } from "viem";
import { useNFTs, verifyAndFetchToken, type NFTItem } from "@/hooks/useNFTs";
import { useCollectionRegistry } from "@/hooks/useCollectionRegistry";
import { useOwnedEnsNames } from "@/hooks/useOwnedEnsNames";
import {
  AGENT_FACTORY_ABI,
  AGENT_REGISTRY_ABI,
  ENS_RESOLVER_ABI,
  FACTORY_ADDRESS,
  GATEWAY_URL,
  REGISTRY_CHAIN_ID,
  buildEnsip25TextKey,
  buildAgentRegistry,
  isZero,
} from "@/lib/erc8004";
import { ArrowRight, Bot, Check, ChevronDown, Globe, Link2, Loader2, Wallet } from "lucide-react";
import { getPublicRegistry } from "@/lib/api";
import { getRegistryPersonalities } from "@/lib/api";
import { usePageRecords } from "@/hooks/usePageRecords";
import { NavMenu } from "@/components/NavMenu";

type Step = "gallery" | "configure" | "minting" | "success";

const ENS_PUBLIC_RESOLVER = "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63" as const;

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Background ────────────────────────────────────────────────────────────────
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

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
    </span>
  );
}

// ── Connect button — mounted guard prevents hydration mismatch ────────────────
function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { open } = useWalletModal();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-10 w-36 rounded-full liquid-glass animate-pulse" />;
  }

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
      >
        <LiveDot />
        <span className="font-mono">{shortAddr(address)}</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => open()}
      className="liquid-glass-strong rounded-full px-5 py-2.5 flex items-center gap-2 text-sm font-medium text-white hover:scale-105 active:scale-95 transition-transform"
    >
      <Wallet className="w-4 h-4" />
      <span>Connect Wallet</span>
    </button>
  );
}

// ── Step pill ─────────────────────────────────────────────────────────────────
function StepPill({
  number, label, active, done,
}: { number: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
        done ? "bg-green-500/20 border border-green-500/40 text-green-400"
             : active ? "bg-white/15 border border-white/30 text-white"
             : "bg-white/4 border border-white/10 text-white/25"
      }`}>
        {done ? <Check className="w-3.5 h-3.5" /> : number}
      </div>
      <span className={`text-xs transition-colors hidden sm:block ${active ? "text-white/70" : "text-white/25"}`}>
        {label}
      </span>
    </div>
  );
}

// ── Collection status banner ──────────────────────────────────────────────────
function CollectionStatusBanner({ status }: { status: ReturnType<typeof useCollectionRegistry> }) {
  if (status.state === "loading") {
    return (
      <div className="liquid-glass rounded-2xl p-3 text-xs text-white/40 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        Checking collection registry…
      </div>
    );
  }
  if (status.state === "not-onboarded") {
    return (
      <div className="rounded-2xl p-4 border border-red-500/20 bg-red-500/5">
        <p className="text-sm font-medium text-red-400">Collection not onboarded</p>
        <p className="text-xs text-white/40 mt-1 leading-relaxed">
          An admin needs to deploy an ERC-8004 registry for this collection first.
        </p>
      </div>
    );
  }
  if (status.state === "delisted") {
    return (
      <div className="rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5">
        <p className="text-sm font-medium text-amber-400">Collection delisted</p>
        <p className="text-xs text-white/40 mt-1 leading-relaxed">
          This collection's registry exists on-chain but is no longer accepting new agents here.
        </p>
      </div>
    );
  }
  return (
    <div className="liquid-glass rounded-2xl px-4 py-3 flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-widest text-white/40">Registry</span>
      <span className="font-mono text-xs text-white/50">
        {status.registry.slice(0, 8)}…{status.registry.slice(-6)}
      </span>
      <LiveDot />
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, textarea = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; textarea?: boolean;
}) {
  const cls = "w-full bg-black/40 border border-white/10 focus:border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors";
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-widest text-white/40">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
          className={`${cls} resize-none`} placeholder={placeholder} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className={cls} placeholder={placeholder} />
      )}
    </div>
  );
}

// ── ENS name detection ───────────────────────────────────────────────────────
const GW_URL_AGENT = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const parentName = process.env.NEXT_PUBLIC_ENS_NAME || "dinamic.eth";

function EnsNameField({ address, value, onChange }: {
  address: Address | undefined;
  value: string;
  onChange: (v: string) => void;
}) {
  const { names, loading, parentName } = useOwnedEnsNames(address);

  if (loading) {
    return (
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-widest text-white/40">ENS Name (optional)</label>
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5">
          <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />
          <span className="text-sm text-white/30">Detecting ENS names…</span>
        </div>
      </div>
    );
  }

  if (names.length === 0) {
    return (
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-widest text-white/40">ENS Name (optional)</label>
        <div className="flex items-center gap-2 bg-black/20 border border-white/6 rounded-xl px-4 py-2.5 opacity-50">
          <Globe className="w-3.5 h-3.5 text-white/20 shrink-0" />
          <span className="text-sm text-white/30">No ENS names detected in this wallet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-widest text-white/40">
        ENS Name (optional)
        <span className="ml-2 text-amber-400/60 normal-case tracking-normal">
          {names.length} found
          {names.some(n => n.endsWith(`.${parentName}`)) && (
            <span className="ml-1 text-amber-300/60">· incl. {parentName} subdomain ✦</span>
          )}
        </span>
      </label>
      <div className="relative">
        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-black/40 border border-white/10 focus:border-white/30 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white outline-none transition-colors appearance-none cursor-pointer"
        >
          <option value="">— None —</option>
          {names.map(n => (
            <option key={n} value={n}>
              {n}{n.endsWith(`.${parentName}`) ? " ✦" : ""}
            </option>
          ))}
        </select>
      </div>
      {value && (
        <p className="text-[10px] text-white/30 flex items-center gap-1.5">
          <Check className="w-3 h-3 text-green-400" />
          ENSIP-25 bidirectional link will be set after minting
        </p>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AgentBridgePage() {
  const { address, isConnected } = useAccount();
  const { open } = useWalletModal();
  const { nfts, nonEnumerableCollections, loading: nftsLoading, error: nftsError, source: nftsSource } = useNFTs(address);
  const tr       = usePageRecords("agent.dinamic.eth");
  const icon     = tr.icon;
  const avatar   = tr.avatar;
  const cardBg   = tr.card_bg;
  const videoUrl = tr.video;

  const [manualTokenId, setManualTokenId] = useState<Record<string, string>>({});
  const [manualLookupState, setManualLookupState] = useState<Record<string, "idle"|"loading"|"notOwned"|"found">>({});
  const { data: primaryEnsName } = useEnsName({ address, chainId: 1 });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [step, setStep] = useState<Step>("gallery");
  const [selected, setSelected] = useState<NFTItem | null>(null);
  const [collectionFilter, setCollectionFilter] = useState("");

  const [agentName, setAgentName]     = useState("");
  const [agentDesc, setAgentDesc]     = useState("");
  const [ensName, setEnsName]         = useState("");
  const [mcpEndpoint, setMcpEndpoint]     = useState("");
  const [a2aEndpoint, setA2aEndpoint]     = useState("");
  const [personalityId, setPersonalityId] = useState("");
  const [customPrompt, setCustomPrompt]   = useState("");
  const [personalities, setPersonalities] = useState<any[]>([]);
  const [registryConfig, setRegistryConfig] = useState<{ mcp_endpoint: string; a2a_endpoint: string; name: string } | null>(null);

  // Auto-fill primary ENS name when it resolves (only if user hasn't typed anything)
  useEffect(() => {
    if (primaryEnsName && !ensName) setEnsName(primaryEnsName);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryEnsName]);

  const registryStatus = useCollectionRegistry(selected?.contractAddress as Address | undefined);
  const onboardedRegistry = registryStatus.state === "onboarded" ? registryStatus.registry : undefined;

  useEffect(() => {
    if (onboardedRegistry) {
      getRegistryPersonalities(onboardedRegistry).then((data: any) => {
        if (Array.isArray(data)) setPersonalities(data);
      });
    }
  }, [onboardedRegistry]);

  // Fetch registry config (MCP/A2A) when the selected NFT's registry is known
  useEffect(() => {
    if (!onboardedRegistry) { setRegistryConfig(null); return; }
    getPublicRegistry(onboardedRegistry).then((cfg) => {
      if (cfg && !cfg.error) {
        setRegistryConfig(cfg);
        setMcpEndpoint(cfg.mcp_endpoint || "");
        setA2aEndpoint(cfg.a2a_endpoint || "");
      }
    }).catch(() => {});
  }, [onboardedRegistry]);

  const { data: mintPrice, isLoading: mintPriceLoading } = useReadContract({
    address: onboardedRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "mintPrice",
    query: { enabled: Boolean(onboardedRegistry) },
  });

  const [mintedAgentId, setMintedAgentId]     = useState<bigint | null>(null);
  const [mintedRegistry, setMintedRegistry]   = useState<Address | null>(null);
  const [postingToGateway, setPostingToGateway] = useState(false);
  const [ensLinking, setEnsLinking]           = useState(false);
  const [ensLinked, setEnsLinked]             = useState(false);
  const [pinning, setPinning]                 = useState(false);
  const [pinnedURI, setPinnedURI]             = useState<string | null>(null);

  const { writeContract: mintAgent, data: mintHash, isPending: mintPending, error: mintError } = useWriteContract();
  const { isLoading: mintConfirming, isSuccess: mintConfirmed, data: mintReceipt } =
    useWaitForTransactionReceipt({ hash: mintHash });
  const { writeContract: setEnsRecord, data: ensHash, isPending: ensPending, error: ensWriteError } = useWriteContract();
  const { isSuccess: ensConfirmed } = useWaitForTransactionReceipt({ hash: ensHash });

  useEffect(() => {
    if (mintConfirmed && mintReceipt) {
      // Registered(uint256 indexed agentId, string agentURI, address indexed owner)
      const REGISTERED_TOPIC = "0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a";
      const regLog = mintReceipt.logs.find(l => l.topics[0]?.toLowerCase() === REGISTERED_TOPIC);
      const rawId = regLog?.topics[1];
      if (rawId) {
        const agentId = BigInt(rawId);
        setMintedAgentId(agentId);
        postAgentToGateway(agentId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mintConfirmed, mintReceipt]);

  useEffect(() => { if (ensConfirmed) setEnsLinked(true); }, [ensConfirmed]);

  async function handleImageError(e: React.SyntheticEvent<HTMLImageElement>, contractAddress: string, tokenId: string) {
    const target = e.currentTarget;
    if (target.dataset.fallbackTried) return;
    target.dataset.fallbackTried = "1";
    const apiKey = process.env.NEXT_PUBLIC_OPENSEA_API_KEY;
    if (!apiKey) return;
    try {
      const res = await fetch(
        `https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}/nfts/${tokenId}`,
        { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return;
      const data = await res.json();
      const url = data.nft?.display_image_url || data.nft?.image_url;
      if (url) {
        target.src = url;
        setSelected(prev =>
          prev?.contractAddress.toLowerCase() === contractAddress.toLowerCase() && prev?.tokenId === tokenId
            ? { ...prev, image: url }
            : prev
        );
      }
    } catch {}
  }

  function handleSelect(nft: NFTItem) {
    setSelected(nft);
    setAgentName(nft.name);
    setAgentDesc(nft.description);
    setStep("configure");
  }

  async function handleManualLookup(contractAddress: string) {
    if (!address) return;
    const tokenId = (manualTokenId[contractAddress] || "").trim();
    if (!tokenId || isNaN(Number(tokenId))) return;
    setManualLookupState(s => ({ ...s, [contractAddress]: "loading" }));
    const nft = await verifyAndFetchToken(contractAddress as `0x${string}`, tokenId, address);
    if (!nft) {
      setManualLookupState(s => ({ ...s, [contractAddress]: "notOwned" }));
      return;
    }
    setManualLookupState(s => ({ ...s, [contractAddress]: "found" }));
    handleSelect(nft);
  }

  async function handleMint() {
    if (!selected || !address || registryStatus.state !== "onboarded" || mintPrice === undefined) return;
    setStep("minting");
    setMintedRegistry(registryStatus.registry);

    // Pin agent metadata to IPFS before minting
    let agentURI: string | undefined;
    try {
      setPinning(true);
      const res = await fetch(`${GW_URL_AGENT}/api/claim/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName,
          description: agentDesc,
          image: selected.image,
          source_contract: selected.contractAddress,
          source_token_id: selected.tokenId,
          ...(mcpEndpoint ? { mcp_endpoint: mcpEndpoint } : {}),
          ...(a2aEndpoint ? { a2a_endpoint: a2aEndpoint } : {}),
        }),
      });
      const pin = await res.json();
      if (pin.uri) { agentURI = pin.uri; setPinnedURI(pin.uri); }
    } catch {}
    finally { setPinning(false); }

    mintAgent({
      address: registryStatus.registry,
      abi: AGENT_REGISTRY_ABI,
      functionName: "registerWithSource",
      args: agentURI
        ? [agentURI, BigInt(selected.tokenId)]
        : [BigInt(selected.tokenId)],
      value: mintPrice,
    });
  }

  async function postAgentToGateway(agentId: bigint) {
    if (!selected || !address || !mintedRegistry) return;
    if (!GATEWAY_URL) { setStep("success"); return; }
    setPostingToGateway(true);
    const services = [
      ...(ensName     ? [{ name: "ENS", endpoint: ensName,     version: "v1"        }] : []),
      ...(mcpEndpoint ? [{ name: "MCP", endpoint: mcpEndpoint, version: "2025-06-18" }] : []),
      ...(a2aEndpoint ? [{ name: "A2A", endpoint: a2aEndpoint, version: "0.3.0"      }] : []),
    ];
    try {
      await fetch(`${GATEWAY_URL}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agentId.toString(), ownerAddress: address,
          agentURI: `${GATEWAY_URL}/agent/${mintedRegistry}/${agentId}`,
          name: agentName, description: agentDesc, image: selected.image,
          sourceContract: selected.contractAddress, sourceTokenId: selected.tokenId,
          services, chainId: REGISTRY_CHAIN_ID, registry: mintedRegistry,
          personalityId: personalityId || undefined,
          customPrompt:  customPrompt  || undefined,
        }),
      });
    } catch {}
    finally { setPostingToGateway(false); setStep("success"); }
  }

  function handleEnsLink() {
    if (!ensName || !mintedAgentId || !mintedRegistry) return;
    setEnsLinking(true);
    setEnsRecord({
      address: ENS_PUBLIC_RESOLVER,
      abi: ENS_RESOLVER_ABI,
      functionName: "setText",
      args: [namehash(ensName), buildEnsip25TextKey(REGISTRY_CHAIN_ID, mintedRegistry, mintedAgentId), "1"],
    });
  }

  // Unique collections with their contract addresses
  const collectionMap = new Map<string, string>(); // name → contractAddress
  for (const n of nfts) {
    if (!collectionMap.has(n.collectionName)) collectionMap.set(n.collectionName, n.contractAddress);
  }
  const uniqueCollections = [...collectionMap.keys()];

  // All registered collections from factory — for the supported-collections panel
  const ERC721_NAME_ABI = [{ name: "name", type: "function", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }] as const;
  const { data: allRegisteredCollections } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: AGENT_FACTORY_ABI,
    functionName: "allCollections",
    query: { enabled: !isZero(FACTORY_ADDRESS) },
  });
  const registeredAddrs = (allRegisteredCollections as Address[] | undefined) ?? [];
  const { data: registeredNames_ } = useReadContracts({
    contracts: registeredAddrs.map(addr => ({
      address: addr,
      abi: ERC721_NAME_ABI,
      functionName: "name" as const,
    })),
    query: { enabled: registeredAddrs.length > 0 },
  });
  const ownedContracts = new Set(nfts.map(n => n.contractAddress.toLowerCase()));
  const unownedCollections = registeredAddrs
    .map((addr, i) => ({
      address: addr as string,
      name: (registeredNames_?.[i]?.result as string | undefined) ?? shortAddr(addr),
    }))
    .filter(c => !ownedContracts.has(c.address.toLowerCase()));

  // Batch-lookup which collections have a registered registry
  const { data: lookupResults } = useReadContracts({
    contracts: uniqueCollections.map(name => ({
      address: FACTORY_ADDRESS,
      abi: AGENT_FACTORY_ABI,
      functionName: "lookup" as const,
      args: [collectionMap.get(name) as Address],
    })),
    query: { enabled: uniqueCollections.length > 0 },
  });

  const registeredNames = new Set<string>(
    uniqueCollections.filter((name, i) => {
      const r = lookupResults?.[i];
      if (r?.status !== "success") return false;
      const [registry] = r.result as [Address, boolean];
      return registry !== "0x0000000000000000000000000000000000000000";
    })
  );

  // Registered collections first, then alphabetical within each group
  const collections = [...uniqueCollections].sort((a, b) => {
    const aReg = registeredNames.has(a) ? 0 : 1;
    const bReg = registeredNames.has(b) ? 0 : 1;
    if (aReg !== bReg) return aReg - bReg;
    return a.localeCompare(b);
  });

  const filtered = collectionFilter ? nfts.filter(n => n.collectionName === collectionFilter) : nfts;
  const STEPS: { key: Step; label: string }[] = [
    { key: "gallery",   label: "Select NFT"  },
    { key: "configure", label: "Configure"   },
    { key: "minting",   label: "Minting"     },
    { key: "success",   label: "Done"        },
  ];
  const stepIdx = STEPS.findIndex(s => s.key === step);

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col font-display">
      <NavMenu currentPath="agent" />

      {videoUrl ? (
        <>
          <video src={videoUrl} autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover z-0" />
          <div className="fixed inset-0 z-0 bg-black/50" />
        </>
      ) : (
        <GradientBg />
      )}

      {/* ── Nav ────────────────────────────────────────── */}
      <div className="relative z-10 px-5 py-4 flex items-center justify-between border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white/70" />
          </div>
          <div>
            <span className="text-sm font-semibold text-white">ERC-8004 Bridge</span>
            <span className="ml-2 text-[10px] text-white/30 font-mono">agent.dinamic.eth</span>
          </div>
        </div>
        <ConnectButton />
      </div>

      {/* ── Not connected wall ──────────────────────────── */}
      {mounted && !isConnected && (
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 min-h-[80vh] p-8 text-center">
          <div className="liquid-glass-strong rounded-3xl p-10 max-w-md w-full space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-white/8 border border-white/10 flex items-center justify-center mx-auto">
              <Bot className="w-7 h-7 text-white/40" />
            </div>
            <div>
              <h1 className="text-3xl font-medium tracking-[-0.05em] text-white mb-3">
                Bridge Your NFT<br />
                <em className="font-serif not-italic text-white/50">Into an Agent</em>
              </h1>
              <p className="text-sm text-white/40 leading-relaxed">
                ERC-8004 lets you attach a trustless on-chain agent identity to any NFT you hold.
                Connect your wallet to browse your collection.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="liquid-glass rounded-full px-3 py-1.5 text-xs text-white/60">ERC-8004</span>
              <span className="liquid-glass rounded-full px-3 py-1.5 text-xs text-white/60">ENSIP-25</span>
              <span className="liquid-glass rounded-full px-3 py-1.5 text-xs text-white/60">Non-custodial</span>
            </div>
            <button
              onClick={() => open()}
              className="w-full liquid-glass-strong rounded-full py-3 flex items-center justify-center gap-3 text-sm font-medium text-white hover:scale-105 active:scale-95 transition-transform"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
              <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Connected flow ──────────────────────────────── */}
      {mounted && isConnected && (
        <div className="relative z-10 flex flex-col flex-1">

          {/* Step bar */}
          <div className="px-5 py-4 flex items-center gap-4 border-b border-white/6">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-3">
                <StepPill number={i + 1} label={s.label} active={step === s.key} done={i < stepIdx} />
                {i < STEPS.length - 1 && <div className="w-8 h-px bg-white/10 hidden sm:block" />}
              </div>
            ))}
          </div>

          {/* ── Step 1: Gallery ──────────────────────────── */}
          {step === "gallery" && (
            <div className="flex flex-col lg:flex-row flex-1">

              {/* Left info panel */}
              <div className="w-full lg:w-64 xl:w-72 shrink-0 p-5 lg:border-r border-white/8">
                <div className="liquid-glass-strong rounded-3xl p-5 space-y-4">
                  <div className="w-10 h-10 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white/40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white mb-1">Select an NFT</p>
                    <p className="text-xs text-white/40 leading-relaxed">
                      Pick an NFT from an onboarded collection. Ownership is verified live — nothing is locked or transferred.
                    </p>
                  </div>
                  {collections.length > 1 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-widest text-white/30">Filter</p>
                      <button
                        onClick={() => setCollectionFilter("")}
                        className={`w-full text-left text-xs px-3 py-2 rounded-xl transition-colors ${
                          !collectionFilter ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5"
                        }`}
                      >
                        All collections
                      </button>
                      {collections.map(c => (
                        <button
                          key={c}
                          onClick={() => setCollectionFilter(c)}
                          className={`w-full text-left text-xs px-3 py-2 rounded-xl transition-colors flex items-center justify-between gap-2 ${
                            collectionFilter === c ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5"
                          }`}
                        >
                          <span className="truncate">{c}</span>
                          {registeredNames.has(c) && (
                            <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/20">
                              Agent-ready
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {unownedCollections.length > 0 && (
                    <div className="space-y-1 pt-3 border-t border-white/6">
                      <p className="text-[10px] uppercase tracking-widest text-white/20 px-1">Also supported</p>
                      {unownedCollections.map(c => (
                        <div key={c.address} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-white/25">
                          <span className="text-xs truncate">{c.name}</span>
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-white/4 text-white/20 border border-white/6 whitespace-nowrap">no NFT</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* NFT grid */}
              <div className="flex-1 p-5 overflow-auto">
                {nftsLoading && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className="liquid-glass rounded-2xl overflow-hidden">
                        <div className="aspect-square bg-white/5 animate-pulse" />
                        <div className="p-3 space-y-1.5">
                          <div className="h-3 w-3/4 rounded-full bg-white/5 animate-pulse" />
                          <div className="h-2.5 w-1/2 rounded-full bg-white/4 animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {nftsError && nftsSource !== "onchain" && (
                  <div className="rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5 mb-4">
                    <p className="text-amber-400 text-sm">{nftsError}</p>
                  </div>
                )}
                {nftsSource === "onchain" && (
                  <div className="rounded-2xl px-4 py-2 border border-white/8 bg-white/3 mb-4 flex items-center gap-2">
                    <span className="text-xs text-white/30">Showing NFTs from onboarded collections · on-chain</span>
                  </div>
                )}
                {!nftsLoading && filtered.length === 0 && nonEnumerableCollections.length === 0 && (
                  <div className="space-y-8">
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white/20" />
                      </div>
                      <p className="text-white/30 text-sm">No supported NFTs in this wallet.</p>
                      <p className="text-white/20 text-xs max-w-xs">Hold an NFT from one of the supported collections below, or switch to a wallet that does.</p>
                    </div>
                    {unownedCollections.length > 0 && (
                      <div className="space-y-4">
                        <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">Supported Collections</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {unownedCollections.map(c => (
                            <div key={c.address} className="liquid-glass rounded-2xl p-4 space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/6 flex items-center justify-center shrink-0">
                                  <Bot className="w-4 h-4 text-white/25" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white/70 truncate">{c.name}</p>
                                  <p className="text-[10px] font-mono text-white/25">{c.address.slice(0,6)}…{c.address.slice(-4)}</p>
                                </div>
                              </div>
                              <p className="text-xs text-white/25 leading-relaxed">Hold a token from this collection to bridge it as an ERC-8004 agent.</p>
                              <a
                                href={`https://opensea.io/assets/ethereum/${c.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-white/4 hover:bg-white/8 transition-colors text-xs text-white/40 hover:text-white/70"
                              >
                                View on OpenSea <ArrowRight className="w-3 h-3" />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Manual token ID entry for non-Enumerable ERC-721 collections */}
                {!nftsLoading && nonEnumerableCollections.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {nonEnumerableCollections.map(col => (
                      <div key={col.contractAddress} className="rounded-2xl p-4 border border-white/8 bg-white/3">
                        <p className="text-sm font-medium text-white mb-1">{col.collectionName}</p>
                        <p className="text-xs text-white/40 mb-3">This collection doesn't support automatic enumeration. Enter your token ID to continue.</p>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            placeholder="Token ID (e.g. 42)"
                            value={manualTokenId[col.contractAddress] || ""}
                            onChange={e => setManualTokenId(s => ({ ...s, [col.contractAddress]: e.target.value }))}
                            onKeyDown={e => e.key === "Enter" && handleManualLookup(col.contractAddress)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
                          />
                          <button
                            onClick={() => handleManualLookup(col.contractAddress)}
                            disabled={manualLookupState[col.contractAddress] === "loading" || !manualTokenId[col.contractAddress]?.trim()}
                            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-gb-accentD hover:bg-gb-accent disabled:opacity-40 transition-colors"
                          >
                            {manualLookupState[col.contractAddress] === "loading" ? "Checking…" : "Verify"}
                          </button>
                        </div>
                        {manualLookupState[col.contractAddress] === "notOwned" && (
                          <p className="text-xs text-red-400 mt-2">Token not owned by this wallet</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filtered.map(nft => (
                    <button
                      key={`${nft.contractAddress}-${nft.tokenId}`}
                      onClick={() => handleSelect(nft)}
                      className="liquid-glass rounded-2xl overflow-hidden text-left hover:bg-white/8 hover:scale-[1.02] transition-all group"
                    >
                      <div className="aspect-square bg-white/4 relative overflow-hidden">
                        {nft.image ? (
                          <img src={nft.image} alt={nft.name}
                            onError={(e) => handleImageError(e, nft.contractAddress, nft.tokenId)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Bot className="w-8 h-8 text-white/15" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-white truncate">{nft.name}</p>
                        <p className="text-xs text-white/40 truncate">{nft.collectionName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Configure ───────────────────────── */}
          {step === "configure" && selected && (
            <div className="flex flex-col lg:flex-row flex-1 p-5 gap-5">

              {/* NFT preview */}
              <div className="w-full lg:w-72 xl:w-80 shrink-0">
                <div className="liquid-glass-strong rounded-3xl overflow-hidden">
                  <div className="aspect-square bg-white/4">
                    {selected.image ? (
                      <img src={selected.image} alt={selected.name}
                        onError={(e) => handleImageError(e, selected.contractAddress, selected.tokenId)}
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Bot className="w-12 h-12 text-white/15" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="font-medium text-white">{selected.name}</p>
                      <p className="text-xs text-white/40">{selected.collectionName}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="liquid-glass rounded-full px-3 py-1 text-[10px] font-mono text-white/40">
                        {shortAddr(selected.contractAddress)}
                      </span>
                      <span className="liquid-glass rounded-full px-3 py-1 text-[10px] text-white/40">
                        #{selected.tokenId}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Config form */}
              <div className="flex-1 space-y-4">
                <CollectionStatusBanner status={registryStatus} />

                <div className="liquid-glass-strong rounded-3xl p-6 space-y-4">
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Agent Configuration</p>

                  <Field label="Agent Name" value={agentName} onChange={setAgentName} placeholder="My Agent" />
                  <Field label="Description" value={agentDesc} onChange={setAgentDesc}
                    placeholder="What does this agent do?" textarea />
                  <EnsNameField address={address} value={ensName} onChange={setEnsName} />

                  <div className="h-px bg-white/8" />
                  <p className="text-[10px] uppercase tracking-widest text-white/30">AI Services</p>
                  <Field label="MCP Endpoint" value={mcpEndpoint} onChange={setMcpEndpoint}
                    placeholder="https://mcp.myagent.com/" />
                  <Field label="A2A Endpoint" value={a2aEndpoint} onChange={setA2aEndpoint}
                    placeholder="https://a2a.myagent.com/" />
                  {registryConfig && (registryConfig.mcp_endpoint || registryConfig.a2a_endpoint) && (
                    <p className="text-[10px] text-white/25">Pre-filled from registry defaults · edit to override per-agent</p>
                  )}
                  {!registryConfig && (
                    <p className="text-[10px] text-white/25 italic">Optional — add your own MCP / A2A endpoint after deploying a server</p>
                  )}

                  {(personalities as any[]).length > 0 && (
                    <>
                      <div className="h-px bg-white/8" />
                      <p className="text-[10px] uppercase tracking-widest text-white/30">AI Personality</p>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-white/40">Personality</label>
                        <select
                          value={personalityId}
                          onChange={e => setPersonalityId(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 focus:border-white/30 rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-colors appearance-none cursor-pointer"
                        >
                          <option value="">— No personality —</option>
                          {(personalities as any[]).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.provider})</option>
                          ))}
                        </select>
                      </div>
                      {personalityId && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-white/40">Custom Prompt Override</label>
                          <textarea
                            value={customPrompt}
                            onChange={e => setCustomPrompt(e.target.value)}
                            rows={3}
                            placeholder="Leave blank to use the personality default system prompt"
                            className="w-full bg-black/40 border border-white/10 focus:border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors resize-none font-mono"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Mint price */}
                {registryStatus.state === "onboarded" && (
                  <div className="liquid-glass rounded-2xl px-4 py-3 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-white/40">Mint price</span>
                    <span className="font-mono text-sm text-white">
                      {mintPriceLoading || mintPrice === undefined ? "…"
                        : mintPrice === BigInt(0) ? "Free"
                        : `${formatEther(mintPrice)} ETH`}
                    </span>
                  </div>
                )}

                {/* Preview JSON */}
                {registryStatus.state === "onboarded" && (
                  <details className="liquid-glass rounded-2xl overflow-hidden">
                    <summary className="px-4 py-3 text-[10px] uppercase tracking-widest text-white/30 cursor-pointer hover:text-white/50">
                      Preview registration JSON
                    </summary>
                    <pre className="px-4 pb-4 text-xs overflow-x-auto text-white/30">
                      {JSON.stringify({
                        type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
                        name: agentName, description: agentDesc, image: selected.image,
                        services: [
                          ...(ensName     ? [{ name: "ENS", endpoint: ensName     }] : []),
                          ...(mcpEndpoint ? [{ name: "MCP", endpoint: mcpEndpoint }] : []),
                          ...(a2aEndpoint ? [{ name: "A2A", endpoint: a2aEndpoint }] : []),
                        ],
                        active: true,
                        registrations: [{ agentId: "?",
                          agentRegistry: buildAgentRegistry(REGISTRY_CHAIN_ID, registryStatus.registry) }],
                      }, null, 2)}
                    </pre>
                  </details>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setStep("gallery"); setSelected(null); }}
                    className="liquid-glass rounded-full px-6 py-3 text-sm text-white/70 hover:text-white transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleMint}
                    disabled={!agentName || registryStatus.state !== "onboarded" || mintPriceLoading || mintPrice === undefined}
                    className="flex-1 liquid-glass-strong rounded-full py-3 flex items-center justify-center gap-3 text-sm font-medium text-white disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] transition-transform"
                  >
                    <span>{mintPrice && mintPrice > BigInt(0)
                      ? `Mint for ${formatEther(mintPrice)} ETH`
                      : "Mint ERC-8004 Agent"}</span>
                    <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Minting ─────────────────────────── */}
          {step === "minting" && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="liquid-glass-strong rounded-3xl p-10 max-w-sm w-full text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-white/8 border border-white/10 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-white/50 animate-spin" />
                </div>
                <div>
                  <p className="text-base font-medium text-white">
                    {pinning && "Pinning metadata to IPFS…"}
                    {!pinning && mintPending && "Confirm in wallet…"}
                    {!pinning && mintConfirming && "Waiting for confirmation…"}
                    {!pinning && postingToGateway && "Registering with gateway…"}
                  </p>
                  <p className="text-sm text-white/40 mt-2 leading-relaxed">
                    {pinning && "Uploading agent metadata to IPFS via Pinata."}
                    {!pinning && mintPending && "Your wallet will prompt you to sign the transaction."}
                    {!pinning && mintConfirming && "Transaction submitted — waiting for block confirmation."}
                    {!pinning && postingToGateway && "Storing your agent registration data on the gateway."}
                  </p>
                </div>
                {mintError && (
                  <div className="rounded-2xl p-4 border border-red-500/20 bg-red-500/5 text-left space-y-2">
                    <p className="text-red-400 text-sm">{mintError.message}</p>
                    <button onClick={() => setStep("configure")}
                      className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2">
                      Go back and try again
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Success ─────────────────────────── */}
          {step === "success" && selected && mintedRegistry && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-lg w-full space-y-4">

                {/* Success header */}
                <div className="liquid-glass-strong rounded-3xl p-6 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-3xl bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-white">Agent Registered!</p>
                    <p className="text-sm text-white/40 mt-1">
                      Agent #{mintedAgentId?.toString()} minted on-chain.
                    </p>
                  </div>
                </div>

                {/* Agent summary card */}
                <div className="liquid-glass rounded-3xl overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    {selected.image ? (
                      <img src={selected.image} alt={agentName}
                        onError={(e) => handleImageError(e, selected.contractAddress, selected.tokenId)}
                        className="w-14 h-14 rounded-2xl object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                        <Bot className="w-6 h-6 text-white/30" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{agentName}</p>
                      <p className="text-xs text-white/40">
                        Agent #{mintedAgentId?.toString()} · {selected.collectionName}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-white/8 px-4 py-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-3 h-3 text-white/20 shrink-0" />
                      <span className="font-mono text-[10px] text-white/30 truncate">
                        {shortAddr(selected.contractAddress)} #{selected.tokenId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-white/20 shrink-0" />
                      <span className="font-mono text-[10px] text-white/30 truncate">
                        {buildAgentRegistry(REGISTRY_CHAIN_ID, mintedRegistry)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ENSIP-25 link */}
                {ensName && !ensLinked && (
                  <div className="liquid-glass rounded-3xl p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-white/50" />
                      <p className="text-sm font-medium text-white">Link to ENS Name</p>
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed">
                      Set the ENSIP-25 text record on <strong className="text-white/60">{ensName}</strong> to
                      bidirectionally verify this agent is associated with your ENS name.
                    </p>
                    <p className="font-mono text-[10px] text-white/20 break-all">
                      {mintedAgentId ? buildEnsip25TextKey(REGISTRY_CHAIN_ID, mintedRegistry, mintedAgentId) : "…"}
                    </p>
                    <button
                      onClick={handleEnsLink}
                      disabled={ensPending || ensLinking}
                      className="w-full liquid-glass-strong rounded-full py-3 text-sm font-medium text-white disabled:opacity-40 hover:scale-[1.01] transition-transform"
                    >
                      {ensPending ? "Confirm in wallet…" : "Set ENSIP-25 Text Record"}
                    </button>
                    {ensWriteError && (
                      <p className="text-xs text-red-400 text-center">
                        {ensWriteError.message.includes("denied") || ensWriteError.message.includes("rejected")
                          ? "Transaction rejected in wallet — press the button again to retry."
                          : ensWriteError.message.slice(0, 120)}
                      </p>
                    )}
                  </div>
                )}

                {ensLinked && (
                  <div className="liquid-glass rounded-3xl px-4 py-3 flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-green-400 font-medium">ENSIP-25 record set on {ensName}</p>
                      <p className="text-xs text-white/30 mt-0.5">Bidirectional ENS ↔ agent link established.</p>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setStep("gallery"); setSelected(null); setMintedAgentId(null);
                      setMintedRegistry(null); setAgentName(""); setAgentDesc("");
                      setEnsName(""); setMcpEndpoint(""); setA2aEndpoint("");
                      setEnsLinked(false); setEnsLinking(false);
                    }}
                    className="flex-1 liquid-glass rounded-full py-3 text-sm text-white/70 hover:text-white transition-colors"
                  >
                    Bridge Another
                  </button>
                  {GATEWAY_URL && mintedAgentId !== null && (
                    <a
                      href={`${GATEWAY_URL}/agent/${mintedRegistry}/${mintedAgentId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex-1 liquid-glass rounded-full py-3 text-sm text-center text-white/70 hover:text-white transition-colors"
                    >
                      View JSON
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
