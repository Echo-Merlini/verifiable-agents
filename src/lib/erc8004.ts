import { type Hex, type Address } from "viem";

// ── Factory ABI (AgentIdentityRegistryFactory) ──────────────────────

export const AGENT_FACTORY_ABI = [
  {
    type: "function",
    name: "registryOf",
    inputs: [{ name: "collection", type: "address" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "delisted",
    inputs: [{ name: "collection", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lookup",
    inputs: [{ name: "sourceCollection", type: "address" }],
    outputs: [
      { name: "registry", type: "address" },
      { name: "isDelisted", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allCollections",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collectionCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collectionsPaged",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [{ name: "page", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deployRegistry",
    inputs: [
      { name: "sourceCollection", type: "address" },
      {
        name: "cfg",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "baseAgentURI", type: "string" },
          { name: "registryAdmin", type: "address" },
          { name: "mintPrice", type: "uint256" },
          { name: "treasury", type: "address" },
          { name: "royaltyReceiver", type: "address" },
          { name: "royaltyBps", type: "uint96" },
        ],
      },
    ],
    outputs: [{ name: "registry", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "delist",
    inputs: [{ name: "sourceCollection", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "relist",
    inputs: [{ name: "sourceCollection", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "RegistryDeployed",
    inputs: [
      { name: "sourceCollection", type: "address", indexed: true },
      { name: "registry", type: "address", indexed: true },
      { name: "registryAdmin", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "baseAgentURI", type: "string", indexed: false },
      { name: "mintPrice", type: "uint256", indexed: false },
      { name: "treasury", type: "address", indexed: false },
      { name: "royaltyReceiver", type: "address", indexed: false },
      { name: "royaltyBps", type: "uint96", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RegistryDelisted",
    inputs: [
      { name: "sourceCollection", type: "address", indexed: true },
      { name: "registry", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "RegistryRelisted",
    inputs: [
      { name: "sourceCollection", type: "address", indexed: true },
      { name: "registry", type: "address", indexed: true },
    ],
  },
] as const;

// ── Registry ABI (AgentIdentityRegistry) ────────────────────────────

export const AGENT_REGISTRY_ABI = [
  {
    type: "function",
    name: "boundCollection",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "baseAgentURI",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registerWithSource",
    inputs: [{ name: "sourceTokenId", type: "uint256" }],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "registerWithSource",
    inputs: [
      { name: "agentURI", type: "string" },
      { name: "sourceTokenId", type: "uint256" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "setAgentURI",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getMetadata",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
    ],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setMetadata",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
      { name: "metadataValue", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAgentWallet",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSourceNFT",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "sourceContract", type: "address" },
      { name: "sourceTokenId", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasSourceNFT",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isSourceNFTOwnershipValid",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setBaseAgentURI",
    inputs: [{ name: "newBaseURI", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "pause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unpause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ── Economics ─────────────────────────────────────────────────────
  {
    type: "function",
    name: "mintPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "treasury",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "royaltyReceiver",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "royaltyBps",
    inputs: [],
    outputs: [{ name: "", type: "uint96" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_ROYALTY_BPS",
    inputs: [],
    outputs: [{ name: "", type: "uint96" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "royaltyInfo",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "salePrice", type: "uint256" },
    ],
    outputs: [
      { name: "receiver", type: "address" },
      { name: "royaltyAmount", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setMintPrice",
    inputs: [{ name: "newPrice", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setTreasury",
    inputs: [{ name: "newTreasury", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setRoyalty",
    inputs: [
      { name: "newReceiver", type: "address" },
      { name: "newBps", type: "uint96" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  // ── Events ────────────────────────────────────────────────────────
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "SourceNFTLinked",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "sourceContract", type: "address", indexed: true },
      { name: "sourceTokenId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "URIUpdated",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "newURI", type: "string", indexed: false },
      { name: "updatedBy", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "MintPriceUpdated",
    inputs: [
      { name: "oldPrice", type: "uint256", indexed: false },
      { name: "newPrice", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TreasuryUpdated",
    inputs: [
      { name: "oldTreasury", type: "address", indexed: false },
      { name: "newTreasury", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RoyaltyUpdated",
    inputs: [
      { name: "oldReceiver", type: "address", indexed: false },
      { name: "oldBps", type: "uint96", indexed: false },
      { name: "newReceiver", type: "address", indexed: false },
      { name: "newBps", type: "uint96", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MintProceedsForwarded",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "treasury", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

// ── Genesis registry ABI (GenesisAgentRegistry — self-sourced mint) ──

export const GENESIS_REGISTRY_ABI = [
  { type: "function", name: "phase", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "allowlistPrice", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "publicPrice", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "maxSupply", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalSupply", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "allowlistRoot", inputs: [], outputs: [{ name: "", type: "bytes32" }], stateMutability: "view" },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "agentURI", type: "string" },
      {
        name: "metadata",
        type: "tuple[]",
        components: [
          { name: "metadataKey", type: "string" },
          { name: "metadataValue", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "mintAllowlist",
    inputs: [
      { name: "agentURI", type: "string" },
      {
        name: "metadata",
        type: "tuple[]",
        components: [
          { name: "metadataKey", type: "string" },
          { name: "metadataValue", type: "bytes" },
        ],
      },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "payable",
  },
  // admin
  { type: "function", name: "setPhase", inputs: [{ name: "newPhase", type: "uint8" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setAllowlistRoot", inputs: [{ name: "newRoot", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setAllowlistPrice", inputs: [{ name: "newPrice", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setPublicPrice", inputs: [{ name: "newPrice", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setMaxSupply", inputs: [{ name: "newMax", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
] as const;

/** Phase enum mirror (Closed=0, Allowlist=1, Public=2). */
export const GENESIS_PHASE = { Closed: 0, Allowlist: 1, Public: 2 } as const;
export const GENESIS_PHASE_LABEL = ["Closed", "Allowlist", "Public"] as const;

// ── ERC-721 minimal ABI (for source NFT reads) ──────────────────────

export const ERC721_ABI = [
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;

// ── ENSIP-25: Agent Registry ENS Name Verification ──────────────────

/**
 * Encode a registry address as an ERC-7930 interoperable binary address.
 *
 * Layout (per ERC-7930):
 *   Version            : 2 bytes  (0x0001)
 *   ChainType          : 2 bytes  (0x0000 for EIP-155)
 *   ChainReferenceLen  : 1 byte
 *   ChainReference     : variable (big-endian chainId, minimal bytes)
 *   AddressLen         : 1 byte   (0x14 = 20 for EVM)
 *   Address            : 20 bytes
 *
 * Example — mainnet (chainId=1) + 0x8004...432:
 *   0x 0001 0000 01 01 14 8004a169fb4a3325136eb29fa0ceb6d2e539a432
 */
export function encodeErc7930Address(chainId: number, registryAddress: Address): Hex {
  const VERSION = "0001";
  const CHAIN_TYPE_EIP155 = "0000";
  const ADDR_LEN_EVM = "14";

  let chainHex = BigInt(chainId).toString(16);
  if (chainHex.length % 2 === 1) chainHex = "0" + chainHex;
  const chainRefLen = (chainHex.length / 2).toString(16).padStart(2, "0");

  const addr = registryAddress.toLowerCase().replace(/^0x/, "");

  return `0x${VERSION}${CHAIN_TYPE_EIP155}${chainRefLen}${chainHex}${ADDR_LEN_EVM}${addr}` as Hex;
}

/**
 * Build the ENSIP-25 text record key for verifying an agent <-> ENS link.
 *
 * Format: agent-registration[<ERC-7930 encoded registry>][<agentId>]
 */
export function buildEnsip25TextKey(
  chainId: number,
  registryAddress: Address,
  agentId: number | bigint
): string {
  const erc7930 = encodeErc7930Address(chainId, registryAddress);
  return `agent-registration[${erc7930}][${agentId}]`;
}

/**
 * Build the ERC-8004 agentRegistry string.
 * Format: eip155:{chainId}:{registryAddress}
 */
export function buildAgentRegistry(chainId: number, registryAddress: Address): string {
  return `eip155:${chainId}:${registryAddress}`;
}

// ── ENS Public Resolver ABI (for setText) ───────────────────────────

export const ENS_RESOLVER_ABI = [
  {
    type: "function",
    name: "setText",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "text",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;

// ── Config ──────────────────────────────────────────────────────────

/**
 * Base URL of the **live** ens-dynamic-kit gateway, which:
 *   - serves `GET /agent/:registry/:agentId` → ERC-8004 registration JSON
 *     (the URL that on-chain `tokenURI` resolves to)
 *   - owns ingestion of off-chain agent metadata after a mint
 *
 * When unset, the bridge page skips the post-mint upload step and relies
 * on the live gateway's event indexer to pick up the new agent on its own.
 * See `bridge/page.tsx → postAgentToGateway` for the integration hand-off.
 */
export const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "";

/**
 * Address of the deployed `AgentIdentityRegistryFactory` on the target chain.
 * Per-collection registries are resolved at runtime via `factory.lookup(collection)`.
 */
export const FACTORY_ADDRESS =
  (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address) ||
  "0x0000000000000000000000000000000000000000";

export const REGISTRY_CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_REGISTRY_CHAIN_ID || "1",
  10
);

/** The shared GenesisAgentRegistry ("mint your agent") address + chain. */
export const GENESIS_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_GENESIS_REGISTRY_ADDRESS as Address) ||
  "0x0000000000000000000000000000000000000000";

export const GENESIS_CHAIN_ID = parseInt(
  process.env.NEXT_PUBLIC_GENESIS_CHAIN_ID || "11155111", // Sepolia default until mainnet gate
  10
);

export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

export const isZero = (a?: Address | null): boolean =>
  !a || a.toLowerCase() === ZERO_ADDRESS;
