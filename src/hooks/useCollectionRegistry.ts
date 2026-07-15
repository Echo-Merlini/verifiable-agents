"use client";

import { useReadContract } from "wagmi";
import { type Address } from "viem";
import { AGENT_FACTORY_ABI, FACTORY_ADDRESS, isZero } from "@/lib/erc8004";

export type CollectionRegistryStatus =
  | { state: "loading" }
  | { state: "not-onboarded" }
  | { state: "delisted"; registry: Address }
  | { state: "onboarded"; registry: Address };

/**
 * Resolve the per-collection `AgentIdentityRegistry` for a given source ERC-721
 * via the factory's `lookup(collection)`.
 *
 * Returns a tagged status object so the caller can render disabled/enabled UI
 * without worrying about address zero or delisted collections.
 */
export function useCollectionRegistry(
  collection: Address | undefined
): CollectionRegistryStatus {
  const enabled = Boolean(collection) && !isZero(FACTORY_ADDRESS);

  const { data, isLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: AGENT_FACTORY_ABI,
    functionName: "lookup",
    args: collection ? [collection] : undefined,
    query: { enabled },
  });

  if (!enabled || isLoading) return { state: "loading" };

  const [registry, isDelisted] = (data ?? [
    "0x0000000000000000000000000000000000000000",
    false,
  ]) as readonly [Address, boolean];

  if (isZero(registry)) return { state: "not-onboarded" };
  if (isDelisted) return { state: "delisted", registry };
  return { state: "onboarded", registry };
}
