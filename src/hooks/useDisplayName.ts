"use client";

import { useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useEffect, useState } from "react";
import { getGatewayUrl } from "./useGatewayEnv";

export function useDisplayName(address?: string): string | null {
  const { data: ensName } = useEnsName({
    address: address as `0x${string}` | undefined,
    chainId: mainnet.id,
    query: { enabled: !!address },
  });

  const [subName, setSubName] = useState<string | null>(null);

  // Always fetch gateway reverse — dinamic.eth subdomain takes priority over
  // the primary ENS name so the platform identity shows first on agent cards
  useEffect(() => {
    if (!address) { setSubName(null); return; }
    let cancelled = false;
    fetch(`${getGatewayUrl()}/reverse/${address}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setSubName(d?.name ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [address]);

  if (!address) return null;
  if (subName) return subName;
  if (ensName) return ensName;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
