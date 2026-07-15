"use client";

import { useState, useEffect } from "react";
import { useEnsName } from "wagmi";
import type { Address } from "viem";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const PARENT_NAME = process.env.NEXT_PUBLIC_ENS_NAME || "dinamic.eth";
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "";

// ENS name-holding contracts on mainnet:
//  - BaseRegistrar: unwrapped `.eth` second-level registrations (registrant = owner)
//  - NameWrapper:   wrapped names (2LDs + subnames), owner holds an ERC-1155
const ENS_BASE_REGISTRAR = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";
const ENS_NAME_WRAPPER   = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";

/** All `.eth` names the wallet holds, via the Alchemy NFT API (free tier). */
async function fetchOwnedEnsViaAlchemy(address: Address): Promise<string[]> {
  if (!ALCHEMY_KEY) return [];
  const base = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`;
  const qs =
    `owner=${address}` +
    `&contractAddresses[]=${ENS_BASE_REGISTRAR}` +
    `&contractAddresses[]=${ENS_NAME_WRAPPER}` +
    `&withMetadata=true&pageSize=100`;
  try {
    const res = await fetch(`${base}?${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    const out: string[] = [];
    for (const nft of data.ownedNfts ?? []) {
      // Alchemy resolves the ENS name into `name` (fallback: raw metadata title).
      const raw: string | undefined = nft?.name ?? nft?.raw?.metadata?.name ?? nft?.title;
      if (!raw) continue;
      const name = raw.trim().toLowerCase();
      // Keep only well-formed `.eth` names (skip "unknown", empty, or malformed labels).
      if (name.endsWith(".eth") && /^[a-z0-9.-]+\.eth$/.test(name)) out.push(name);
    }
    return out;
  } catch {
    return [];
  }
}

export function useOwnedEnsNames(address: Address | undefined) {
  const { data: primaryName } = useEnsName({ address, chainId: 1 });
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) { setNames([]); return; }
    setLoading(true);

    Promise.all([
      // claimed `*.dinamic.eth` subdomain(s) tracked by the gateway
      fetch(`${GW_URL}/api/claim/mine?address=${address}`).then(r => r.json()).catch(() => ({})),
      // every `.eth` name the wallet holds on-chain
      fetchOwnedEnsViaAlchemy(address),
    ])
      .then(([mine, owned]) => {
        const all: string[] = [];
        const push = (n?: string) => {
          if (n && !all.includes(n)) all.push(n);
        };
        // primary (reverse) name first, then gateway subdomain, then all owned names
        push(primaryName || undefined);
        if (mine?.label) push(`${mine.label}.${PARENT_NAME}`);
        for (const n of owned) push(n);
        setNames(all);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, primaryName]);

  return { names, loading, parentName: PARENT_NAME };
}
