// AgentMarketEscrow — client bindings. Listings recompute from the event log (Listed / PriceChanged /
// Sold / Cancelled), so the "for sale" state is re-derived from chain, nothing trusted in between.
import { createPublicClient, http, type Address } from "viem";
import { mainnet } from "viem/chains";

export const AGENT_MARKET_ADDRESS = (process.env.NEXT_PUBLIC_AGENT_MARKET_ESCROW || "") as string;
export const agentMarketConfigured = /^0x[0-9a-fA-F]{40}$/.test(AGENT_MARKET_ADDRESS);
export const AGENT_MARKET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_AGENT_MARKET_CHAIN_ID || "1");
export const AGENT_MARKET_FEE_BPS = Number(process.env.NEXT_PUBLIC_AGENT_MARKET_FEE_BPS || "250");

// getLogs-capable mainnet RPC (public nodes gut eth_getLogs; a Tenderly-style gateway serves full range).
const MARKET_RPC = process.env.NEXT_PUBLIC_AGENT_MARKET_RPC
  || process.env.NEXT_PUBLIC_MAINNET_RPC
  || "https://mainnet.gateway.tenderly.co";
const FROM_BLOCK = BigInt(process.env.NEXT_PUBLIC_AGENT_MARKET_FROM_BLOCK || "0");

export const AGENT_MARKET_ABI = [
  { type: "function", name: "list", stateMutability: "nonpayable",
    inputs: [{ name: "nft", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "price", type: "uint256" }],
    outputs: [{ type: "uint256" }] },
  { type: "function", name: "setPrice", stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }, { name: "newPrice", type: "uint256" }], outputs: [] },
  { type: "function", name: "buy", stateMutability: "payable",
    inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "cancel", stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "event", name: "Listed", inputs: [
    { name: "id", type: "uint256", indexed: true }, { name: "seller", type: "address", indexed: true },
    { name: "nft", type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: false },
    { name: "price", type: "uint256", indexed: false } ] },
  { type: "event", name: "PriceChanged", inputs: [
    { name: "id", type: "uint256", indexed: true }, { name: "oldPrice", type: "uint256", indexed: false },
    { name: "newPrice", type: "uint256", indexed: false } ] },
  { type: "event", name: "Sold", inputs: [
    { name: "id", type: "uint256", indexed: true }, { name: "buyer", type: "address", indexed: true },
    { name: "seller", type: "address", indexed: true }, { name: "nft", type: "address", indexed: false },
    { name: "tokenId", type: "uint256", indexed: false }, { name: "price", type: "uint256", indexed: false },
    { name: "fee", type: "uint256", indexed: false } ] },
  { type: "event", name: "Cancelled", inputs: [{ name: "id", type: "uint256", indexed: true }] },
] as const;

// ERC-721 approve — the seller approves the escrow for their agent token before listing.
export const ERC721_APPROVE_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "getApproved", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

export type Listing = {
  id: bigint;
  seller: string;
  nft: string;
  tokenId: string;
  price: bigint;
  active: boolean;
};

const marketClient = createPublicClient({ chain: mainnet, transport: http(MARKET_RPC) });

/// Re-derive the current set of ACTIVE listings by folding the event log — Listed opens one,
/// PriceChanged updates its price, Sold/Cancelled close it. Anyone can recompute the same set.
export async function fetchActiveListings(): Promise<Listing[]> {
  if (!agentMarketConfigured) return [];
  const address = AGENT_MARKET_ADDRESS as Address;
  const opts = { address, fromBlock: FROM_BLOCK, toBlock: "latest" as const };
  const [listed, priced, sold, cancelled] = await Promise.all([
    marketClient.getContractEvents({ ...opts, abi: AGENT_MARKET_ABI, eventName: "Listed" }),
    marketClient.getContractEvents({ ...opts, abi: AGENT_MARKET_ABI, eventName: "PriceChanged" }),
    marketClient.getContractEvents({ ...opts, abi: AGENT_MARKET_ABI, eventName: "Sold" }),
    marketClient.getContractEvents({ ...opts, abi: AGENT_MARKET_ABI, eventName: "Cancelled" }),
  ]);

  const map = new Map<string, Listing>();
  for (const e of listed) {
    const a = e.args as { id: bigint; seller: string; nft: string; tokenId: bigint; price: bigint };
    map.set(a.id.toString(), { id: a.id, seller: a.seller, nft: a.nft, tokenId: a.tokenId.toString(), price: a.price, active: true });
  }
  for (const e of priced) {
    const a = e.args as { id: bigint; newPrice: bigint };
    const l = map.get(a.id.toString()); if (l) l.price = a.newPrice;
  }
  for (const e of [...sold, ...cancelled]) {
    const a = e.args as { id: bigint };
    const l = map.get(a.id.toString()); if (l) l.active = false;
  }
  return [...map.values()].filter((l) => l.active).sort((a, b) => Number(b.id - a.id));
}

export const explorerTx = (hash: string) =>
  `${AGENT_MARKET_CHAIN_ID === 1 ? "https://etherscan.io" : "https://sepolia.etherscan.io"}/tx/${hash}`;
