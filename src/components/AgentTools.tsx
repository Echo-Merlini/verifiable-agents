"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ExternalLink, Loader2, Check, Plus } from "lucide-react";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { MCP_CONFIG, MCP_ORDER, ENTITLEMENT_SLUG_TO_CARD_ID } from "@/lib/mcps";

// The tools an agent actually holds come from two independent places, and a card that
// showed only one of them would be wrong in a way nobody could see:
//   - baked:        the mcps array in its on-chain tokenURI metadata
//   - entitlements: capabilities bought later, keyed on-chain by (registry, tokenId)
// A capability bought in the marketplace shows up only in the second, which is exactly the
// case that sent someone hunting for a tool they had already paid for.
const GW = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const RPC = process.env.NEXT_PUBLIC_MAINNET_RPC || "https://ethereum-rpc.publicnode.com";

const pub = createPublicClient({ chain: mainnet, transport: http(RPC) });
const TOKENURI_ABI = [{
  type: "function", name: "tokenURI", stateMutability: "view",
  inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "string" }],
}] as const;

// Read from the agent's OWN registry — never a hardcoded one. Agents live in several
// registries and reading them all from the genesis address returns another token's metadata.
async function bakedTools(registry: string, tokenId: string): Promise<string[]> {
  try {
    let uri = (await pub.readContract({
      address: registry as `0x${string}`, abi: TOKENURI_ABI, functionName: "tokenURI", args: [BigInt(tokenId)],
    })) as string;
    if (uri.startsWith("ipfs://")) uri = "https://ipfs.io/ipfs/" + uri.slice(7);
    const j = await (await fetch(uri, { signal: AbortSignal.timeout(6000) })).json();
    return Array.isArray(j.mcps) ? j.mcps : [];
  } catch { return []; }
}

async function entitledTools(registry: string, tokenId: string): Promise<string[]> {
  try {
    const all = await (await fetch(`${GW}/marketplace/agents`, { signal: AbortSignal.timeout(8000) })).json();
    const row = (Array.isArray(all) ? all : []).find(
      (a: { registry?: string; agentId?: string }) =>
        String(a.agentId) === String(tokenId) && a.registry?.toLowerCase() === registry.toLowerCase(),
    ) as { entitlements?: string[] } | undefined;
    return (row?.entitlements ?? []).map((s) => ENTITLEMENT_SLUG_TO_CARD_ID[s] ?? s);
  } catch { return []; }
}

export function AgentTools({ registry, tokenId }: { registry: string; tokenId: string }) {
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState<string[] | null>(null);

  const refresh = useCallback(async () => {
    setHeld(null);
    const [baked, ents] = await Promise.all([bakedTools(registry, tokenId), entitledTools(registry, tokenId)]);
    setHeld(Array.from(new Set([...baked, ...ents])));
  }, [registry, tokenId]);

  useEffect(() => { if (open && held === null) void refresh(); }, [open, held, refresh]);

  const heldSet = new Set(held ?? []);
  const available = MCP_ORDER.filter((id) => heldSet.has(id));
  // Respect the catalogue's own `hidden` flag, as buildMcpCards does. A tool marked
  // "in the public list but not worth surfacing" should not be offered for sale here
  // just because this component happens to enumerate MCP_ORDER directly.
  const missing = MCP_ORDER.filter((id) => !heldSet.has(id) && !MCP_CONFIG[id]?.hidden);
  const label = (id: string) => MCP_CONFIG[id]?.label ?? id;

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-gb-faint hover:text-gb-muted"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        Tools
        {held !== null && <span className="ml-1 normal-case tracking-normal text-gb-faint/70">· {available.length} held</span>}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {held === null ? (
            <p className="inline-flex items-center gap-2 font-mono text-[10px] text-gb-faint">
              <Loader2 className="h-3 w-3 animate-spin" /> reading tokenURI + on-chain entitlements…
            </p>
          ) : (
            <>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gb-faint">Available to this agent</p>
                {available.length === 0 ? (
                  <p className="mt-1 text-[11px] text-gb-muted">No tools yet — everything below is purchasable.</p>
                ) : (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {available.map((id) => (
                      <li key={id} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-200">
                        <Check className="h-3 w-3" /> {label(id)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {missing.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gb-faint">Not held — available in the marketplace</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {missing.map((id) => (
                      // Deep-links to the marketplace for THIS agent, so the capability is bought
                      // against the agent you were looking at. Buying against an agent the wallet
                      // does not hold produces a live entitlement that its owner cannot use.
                      <li key={id}>
                        <a
                          href={`/marketplace?registry=${registry}&agent=${tokenId}&mcp=${encodeURIComponent(id)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-paper/70 hover:border-brassLight/40 hover:text-paper"
                        >
                          <Plus className="h-3 w-3" /> {label(id)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <a
                href={`/marketplace?registry=${registry}&agent=${tokenId}`}
                className="inline-flex items-center gap-1 text-[11px] text-brassLight/80 hover:text-brassLight"
              >
                open the marketplace for this agent <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
