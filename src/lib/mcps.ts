/**
 * The demo agent + its MCP toolbox.
 *
 * The selector cards are built dynamically from the gateway's public MCP list
 * (`GET /agent/public-mcps`) — the same source the consult page uses — so the
 * demo always shows the *actual* set of tools the agent can use. `MCP_CONFIG`
 * overlays a nicer label, a short tagline, a hover blurb, the click-prompt, and
 * a brand logo onto each known MCP; anything unconfigured falls back gracefully.
 */

// The demo's featured agent — Bulla Goblin #16, a Pixel Goblins agent on the
// community-metered registry (pool-funded → walletless clicks just work). It's
// deliberately the SAME agent whose attestation is recomputed on /verify.
export const DEMO_AGENT = {
  registry: "0xe0454dfa17a57a84c3e0e2dbfda5318cbbe91e2c",
  agentId: "11",
  name: "Bulla Goblin #16",
  ens: "pixel-goblins.dinamic.eth",
  by: "Pixel Goblins",
  image: "https://i2c.seadn.io/ethereum/0x6559807ffd23965d3af54ee454bc69f113ed06ef/427c13585e375e61c0b73302f11802/5e427c13585e375e61c0b73302f11802.png",
};

export type PublicMcp = { id: string; name: string; description?: string };

export type McpConfig = {
  label: string;       // pretty name on the card
  tagline: string;     // 2–3 words under the name
  blurb: string;       // italic hover description (3–7 short lines)
  prompt: string;      // sent to the agent on click
  display: string;     // the user bubble shown in chat
  logo?: string;       // /logos/*.webp|svg (official brand mark)
  icon?: "recompute" | "forensics"; // lucide fallback where no logo exists
  hidden?: boolean;    // in the public list but not worth surfacing
};

// Keyed by the gateway's MCP id (from /agent/public-mcps).
export const MCP_CONFIG: Record<string, McpConfig> = {
  "f8ee90057b5b7578": {
    label: "OpenSea", tagline: "NFT market", logo: "/logos/opensea.webp",
    blurb: "OpenSea NFT marketplace. Reads collection stats, floor prices and live listings, and prepares buy calldata — so the agent can surface real NFTs you can actually purchase.",
    prompt: "Show me some NFTs currently listed in the goblinarinos721 collection on OpenSea, with their images and prices.",
    display: "Goblinarinos NFTs + prices (OpenSea)",
  },
  "277e9e1e17733065": {
    label: "LI.FI", tagline: "Cross-chain", logo: "/logos/lifi.webp",
    blurb: "LI.FI cross-chain router. Finds the best bridge-and-swap route across 30+ chains for ETH and ERC-20 tokens, and returns a ready-to-sign quote with fees and timing.",
    prompt: "Use your LI.FI tool to find the best route to bridge 0.1 ETH from Ethereum to Base, and summarise it.",
    display: "Best route to bridge 0.1 ETH → Base (LI.FI)",
  },
  "a3s25u3omqm0tqjl": {
    label: "Flashbots", tagline: "MEV / blocks", logo: "/logos/flashbots.webp",
    blurb: "Flashbots private-mempool protection. Sends transactions privately, simulates bundles and checks status — shielding trades from front-running and sandwich MEV.",
    prompt: "Use your Flashbots tool to check the latest Ethereum block and its base fee.",
    display: "Latest block + base fee (Flashbots)",
  },
  "jupiter-docs": {
    label: "Solana", tagline: "Solana DeFi", logo: "/logos/solana.svg",
    blurb: "Jupiter — Solana's DeFi hub. Looks up token prices, market cap, liquidity and swap routes across every Solana DEX. Multichain reach, not just Ethereum.",
    prompt: "Use your Solana token tool to look up BONK (mint DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263) and give me its price, market cap and liquidity.",
    display: "BONK price + market cap (Solana)",
  },
  "5a6c1f48-2850-46f8-9e18-4577197f500d": {
    label: "Recompute Kit", tagline: "Verify by recompute", icon: "recompute",
    blurb: "The house verifier. Re-derives a claim yourself from the primary artifact, pinned to an exact reference, with the evidence attached. Don't trust — recompute.",
    prompt: "Use your Recompute Kit tool to explain, step by step, how you would verify an on-chain attestation by recomputing it from the primary artifact.",
    display: "How to verify by recomputing (Recompute Kit)",
  },
  "60651853-eb38-4b85-818f-7203f67ae52c": {
    label: "1inch", tagline: "DEX aggregator", logo: "/logos/1inch.webp",
    blurb: "1inch DEX aggregator. Finds the best swap price across dozens of liquidity sources, plus limit orders and portfolio data. Swaps ask for your wallet to sign.",
    prompt: "Use your 1inch tool to show me the best price to swap 1 ETH into USDC on Ethereum — a price quote only, don't prepare a transaction.",
    display: "Best price 1 ETH → USDC (1inch)",
  },
  "0ebe0db5-7da0-4b66-a401-f50c976cc72c": {
    label: "Symbiosis", tagline: "Cross-chain swaps", logo: "/logos/symbiosis.webp",
    blurb: "Symbiosis Finance cross-chain swaps. Returns read-only quotes and calldata to move value between chains in a single step.",
    prompt: "Use your Symbiosis tool to quote a cross-chain swap of 100 USDC from Ethereum to Arbitrum, and summarise the route.",
    display: "Quote 100 USDC → Arbitrum (Symbiosis)",
  },
  "d0041cfe-a5e5-4782-afc3-8dcf7c03edd0": {
    label: "Forensics", tagline: "Trace funds", icon: "forensics",
    blurb: "Crypto Forensics. Traces fund flows in and out of flagged addresses across chains and serves a scam-victim recovery playbook — following the money to downstream wallets.",
    prompt: "Use your forensics tool to fetch the scam-victim recovery playbook and summarise the first steps a victim should take.",
    display: "Scam-victim recovery playbook (Forensics)",
  },
  // Present in the public list but the agent has no working Alchemy tool → hide.
  "alchemy-mcp": { hidden: true, label: "Alchemy", tagline: "", blurb: "", prompt: "", display: "" },
};

// Preferred display order — validated walletless read-only tools first.
export const MCP_ORDER: string[] = [
  "f8ee90057b5b7578",                       // OpenSea
  "277e9e1e17733065",                       // LI.FI
  "a3s25u3omqm0tqjl",                       // Flashbots
  "jupiter-docs",                           // Solana
  "5a6c1f48-2850-46f8-9e18-4577197f500d",   // Recompute Kit
  "60651853-eb38-4b85-818f-7203f67ae52c",   // 1inch
  "0ebe0db5-7da0-4b66-a401-f50c976cc72c",   // Symbiosis
  "d0041cfe-a5e5-4782-afc3-8dcf7c03edd0",   // Forensics
];

export type McpCard = McpConfig & { id: string };

// Build cards from a bare list of MCP ids (e.g. an agent's selected tools from its
// NFT metadata) — reuses the same config overlay + ordering as the public list.
export function buildCardsFromIds(ids: string[]): McpCard[] {
  return buildMcpCards(ids.map((id) => ({ id, name: id })));
}

// Turn the gateway's public MCP list into ordered, display-ready cards.
export function buildMcpCards(mcps: PublicMcp[]): McpCard[] {
  const cards: McpCard[] = mcps
    .filter((m) => !MCP_CONFIG[m.id]?.hidden)
    .map((m) => {
      const cfg = MCP_CONFIG[m.id];
      if (cfg) return { id: m.id, ...cfg };
      // Graceful fallback for an MCP we haven't curated yet.
      return {
        id: m.id,
        label: m.name,
        tagline: "Agent tool",
        blurb: m.description || `The ${m.name} tool, available to this agent.`,
        prompt: `Use your ${m.name} tool and show me a quick live example of what it can do.`,
        display: `Try ${m.name}`,
      };
    });
  cards.sort((a, b) => {
    const ia = MCP_ORDER.indexOf(a.id), ib = MCP_ORDER.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return cards;
}
