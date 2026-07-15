"use client";

import { useState, useEffect, useCallback } from "react";
import { type Address } from "viem";
import { AGENT_FACTORY_ABI, FACTORY_ADDRESS, isZero } from "@/lib/erc8004";

export interface NFTItem {
  contractAddress: string;
  tokenId: string;
  name: string;
  collectionName: string;
  image: string;
  tokenURI: string;
  description: string;
}

export interface NonEnumerableCollection {
  contractAddress: string;
  collectionName: string;
}

const ERC721_ABI = [
  { name: "balanceOf",           type: "function", inputs: [{ name: "owner",   type: "address"  }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "tokenOfOwnerByIndex", type: "function", inputs: [{ name: "owner",   type: "address"  }, { name: "index", type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "tokenURI",            type: "function", inputs: [{ name: "tokenId", type: "uint256"  }], outputs: [{ type: "string"  }], stateMutability: "view" },
  { name: "name",                type: "function", inputs: [],                                      outputs: [{ type: "string"  }], stateMutability: "view" },
] as const;

function normalizeURI(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  if (uri.startsWith("ar://"))   return `https://arweave.net/${uri.slice(5)}`;
  return uri;
}

async function fetchMetadata(rawURI: string): Promise<{ name?: string; image?: string; description?: string }> {
  try {
    const uri = normalizeURI(rawURI);
    if (!uri) return {};
    if (uri.startsWith("data:application/json")) {
      const b64 = uri.split(",")[1];
      return JSON.parse(atob(b64));
    }
    const res = await fetch(uri, { signal: AbortSignal.timeout(8000) });
    return await res.json();
  } catch {
    return {};
  }
}

const ERC721_OWN_ABI = [
  { name: "ownerOf", type: "function", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }], stateMutability: "view" },
] as const;

async function fetchOnChain(ownerAddress: Address): Promise<{ nfts: NFTItem[]; nonEnumerable: NonEnumerableCollection[] }> {
  if (isZero(FACTORY_ADDRESS)) return { nfts: [], nonEnumerable: [] };

  const { createPublicClient, http } = await import("viem");
  const { mainnet } = await import("viem/chains");
  const pub = createPublicClient({ chain: mainnet, transport: http("https://ethereum.publicnode.com") });

  let collections: Address[] = [];
  try {
    collections = (await pub.readContract({
      address: FACTORY_ADDRESS,
      abi: AGENT_FACTORY_ABI,
      functionName: "allCollections",
    })) as Address[];
  } catch {
    return { nfts: [], nonEnumerable: [] };
  }

  const results: NFTItem[] = [];
  const nonEnumerable: NonEnumerableCollection[] = [];

  await Promise.all(
    collections.map(async (collection) => {
      const collectionName = await pub.readContract({ address: collection, abi: ERC721_ABI, functionName: "name" }).catch(() => "Unknown Collection") as string;

      // Check if collection supports ERC721Enumerable by probing tokenOfOwnerByIndex(owner, 0)
      let isEnumerable = false;
      try {
        await pub.readContract({ address: collection, abi: ERC721_ABI, functionName: "tokenOfOwnerByIndex", args: [ownerAddress, 0n] });
        isEnumerable = true;
      } catch {
        isEnumerable = false;
      }

      if (!isEnumerable) {
        // Surface for manual token ID entry regardless of balance
        nonEnumerable.push({ contractAddress: collection, collectionName });
        return;
      }

      // Full enumeration for ERC721Enumerable collections
      try {
        const rawBalance = await pub.readContract({ address: collection, abi: ERC721_ABI, functionName: "balanceOf", args: [ownerAddress] });
        const balance = Number(rawBalance);
        if (balance === 0) return;

        const tokenIds = await Promise.all(
          Array.from({ length: balance }, (_, i) =>
            pub.readContract({ address: collection, abi: ERC721_ABI, functionName: "tokenOfOwnerByIndex", args: [ownerAddress, BigInt(i)] })
          )
        );
        const tokenURIs = await Promise.all(
          tokenIds.map(id =>
            pub.readContract({ address: collection, abi: ERC721_ABI, functionName: "tokenURI", args: [id] }).catch(() => "")
          )
        );
        const metadatas = await Promise.all(tokenURIs.map(fetchMetadata));
        tokenIds.forEach((tokenId, i) => {
          results.push({
            contractAddress: collection,
            tokenId: tokenId.toString(),
            name: metadatas[i]?.name || `#${tokenId}`,
            collectionName,
            image: normalizeURI(metadatas[i]?.image || ""),
            tokenURI: tokenURIs[i] as string,
            description: metadatas[i]?.description || "",
          });
        });
      } catch {
        // enumeration failed mid-way — already confirmed Enumerable, skip silently
      }
    })
  );

  return { nfts: results, nonEnumerable };
}

export async function verifyAndFetchToken(collection: Address, tokenId: string, ownerAddress: Address): Promise<NFTItem | null> {
  const { createPublicClient, http } = await import("viem");
  const { mainnet } = await import("viem/chains");
  const pub = createPublicClient({ chain: mainnet, transport: http("https://ethereum.publicnode.com") });
  try {
    const [ownerOf, collectionName, tokenURI] = await Promise.all([
      pub.readContract({ address: collection, abi: ERC721_OWN_ABI, functionName: "ownerOf", args: [BigInt(tokenId)] }),
      pub.readContract({ address: collection, abi: ERC721_ABI, functionName: "name" }).catch(() => "Unknown Collection"),
      pub.readContract({ address: collection, abi: ERC721_ABI, functionName: "tokenURI", args: [BigInt(tokenId)] }).catch(() => ""),
    ]);
    if ((ownerOf as string).toLowerCase() !== ownerAddress.toLowerCase()) return null;
    const meta = await fetchMetadata(tokenURI as string);
    let image = normalizeURI(meta?.image || "");
    let name = meta?.name || "";
    let description = meta?.description || "";
    // If tokenURI metadata is missing an image, try OpenSea as fallback
    if (!image) {
      const osMeta = await fetchOpenSeaToken(collection, tokenId);
      if (osMeta) {
        if (!image) image = osMeta.image;
        if (!name) name = osMeta.name;
        if (!description) description = osMeta.description;
      }
    }
    return {
      contractAddress: collection,
      tokenId,
      name: name || `#${tokenId}`,
      collectionName: collectionName as string,
      image,
      tokenURI: tokenURI as string,
      description,
    };
  } catch {
    return null;
  }
}

async function fetchRegisteredCollections(): Promise<Address[]> {
  if (isZero(FACTORY_ADDRESS)) return [];
  const { createPublicClient, http } = await import("viem");
  const { mainnet } = await import("viem/chains");
  const pub = createPublicClient({ chain: mainnet, transport: http("https://ethereum.publicnode.com") });
  return (await pub.readContract({
    address: FACTORY_ADDRESS,
    abi: AGENT_FACTORY_ABI,
    functionName: "allCollections",
  })) as Address[];
}

function mapAlchemyNft(nft: any): NFTItem {
  return {
    contractAddress: nft.contract.address,
    tokenId: nft.tokenId,
    name: nft.name || nft.raw?.metadata?.name || `#${nft.tokenId}`,
    collectionName: nft.contract.openSeaMetadata?.collectionName || nft.contract.name || "Unknown",
    image: normalizeURI(nft.image?.cachedUrl || nft.image?.originalUrl || nft.raw?.metadata?.image || ""),
    tokenURI: nft.raw?.tokenUri || "",
    description: nft.description || nft.raw?.metadata?.description || "",
  };
}

async function fetchAlchemy(ownerAddress: Address, contractAddresses?: Address[]): Promise<NFTItem[]> {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!apiKey) throw new Error("no-key");
  const chainSlug = process.env.NEXT_PUBLIC_ALCHEMY_CHAIN || "eth-mainnet";
  const contractFilter = contractAddresses?.length
    ? "&" + contractAddresses.map(a => `contractAddresses[]=${a}`).join("&")
    : "";
  const base = `https://${chainSlug}.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${ownerAddress}&withMetadata=true&pageSize=100${contractFilter}`;

  const all: NFTItem[] = [];
  let pageKey: string | undefined;
  const MAX_PAGES = 10;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = pageKey ? `${base}&pageKey=${encodeURIComponent(pageKey)}` : base;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Alchemy ${res.status}`);
    const data = await res.json();
    all.push(...(data.ownedNfts || []).map(mapAlchemyNft));
    pageKey = data.pageKey;
    if (!pageKey) break;
  }

  return all;
}

async function fetchOpenSea(ownerAddress: Address): Promise<NFTItem[]> {
  const apiKey = process.env.NEXT_PUBLIC_OPENSEA_API_KEY;
  if (!apiKey) throw new Error("no-key");
  const url = `https://api.opensea.io/api/v2/chain/ethereum/account/${ownerAddress}/nfts?limit=200`;
  const res = await fetch(url, {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`OpenSea ${res.status}`);
  const data = await res.json();
  return (data.nfts || []).map((nft: any) => ({
    contractAddress: nft.contract,
    tokenId: nft.identifier,
    name: nft.name || `#${nft.identifier}`,
    collectionName: nft.collection || "Unknown",
    image: normalizeURI(nft.display_image_url || nft.image_url || ""),
    tokenURI: nft.token_standard || "",
    description: nft.description || "",
  }));
}

async function fetchOpenSeaToken(collection: Address, tokenId: string): Promise<{ image: string; name: string; description: string } | null> {
  const apiKey = process.env.NEXT_PUBLIC_OPENSEA_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.opensea.io/api/v2/chain/ethereum/contract/${collection}/nfts/${tokenId}`,
      { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const nft = data.nft;
    if (!nft) return null;
    return {
      image: normalizeURI(nft.display_image_url || nft.image_url || ""),
      name: nft.name || `#${tokenId}`,
      description: nft.description || "",
    };
  } catch {
    return null;
  }
}

/**
 * Fetch ERC-721 NFTs owned by the connected wallet.
 * Priority: Alchemy → OpenSea → on-chain factory enumeration.
 */
export function useNFTs(ownerAddress: Address | undefined) {
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [nonEnumerableCollections, setNonEnumerableCollections] = useState<NonEnumerableCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"alchemy" | "opensea" | "onchain" | null>(null);

  const fetchNFTs = useCallback(async () => {
    if (!ownerAddress) { setNfts([]); setNonEnumerableCollections([]); return; }
    setLoading(true);
    setError(null);

    // Pre-fetch registered collections to filter Alchemy/OpenSea — avoids pagination
    // issues where onboarded collections fall off the first 100-item page.
    let registeredCollections: Address[] = [];
    try { registeredCollections = await fetchRegisteredCollections(); } catch {}

    // 1. Try Alchemy (filtered to registered collections when available)
    try {
      const items = await fetchAlchemy(ownerAddress, registeredCollections.length ? registeredCollections : undefined);
      setNfts(items);
      setSource("alchemy");
      setLoading(false);
      return;
    } catch (e: any) {
      if (e?.message !== "no-key") setError("Alchemy unavailable — trying OpenSea");
    }

    // 2. Try OpenSea
    try {
      const items = await fetchOpenSea(ownerAddress);
      setNfts(items);
      setSource("opensea");
      setLoading(false);
      return;
    } catch (e: any) {
      if (e?.message !== "no-key") setError("OpenSea unavailable — using on-chain fallback");
    }

    // 3. Fall back to on-chain enumeration from registered collections only
    try {
      const { nfts: items, nonEnumerable } = await fetchOnChain(ownerAddress);
      setNfts(items);
      setNonEnumerableCollections(nonEnumerable);
      setSource("onchain");
      if (items.length === 0 && nonEnumerable.length === 0) setError("No NFTs found in onboarded collections for this wallet");
    } catch (e: any) {
      setError(e?.message || "Failed to fetch NFTs");
      setNfts([]);
    } finally {
      setLoading(false);
    }
  }, [ownerAddress]);

  useEffect(() => { fetchNFTs(); }, [fetchNFTs]);

  return { nfts, nonEnumerableCollections, loading, error, source, refetch: fetchNFTs };
}
