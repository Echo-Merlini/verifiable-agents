/**
 * Curated MCP selectors for the demo agent (Trustless Pioneer).
 *
 * These are the tools already assigned + working on dinamic.eth. The per-agent
 * assignments endpoint is auth-gated, so we curate the set here. Each card, on
 * click, auto-sends `prompt` to the agent → the agent makes a real MCP tool call
 * (read-only, so no wallet signature needed → runs off the community pool).
 * Logos: brand-coloured lettermark chips for now; swap for official SVGs later.
 */
export type McpSelector = {
  id: string;
  name: string;
  tagline: string;
  color: string;       // brand-ish accent for the chip
  prompt: string;      // sent to the agent on click
  display: string;     // shown in the chat as the user's turn
};

// Every card is a READ-ONLY tool call — no wallet signature, no approval gate —
// so it runs straight off the community pool for a walletless visitor. Each prompt
// is validated end-to-end against the live agent (returns real data in ~15s).
export const MCP_SELECTORS: McpSelector[] = [
  {
    id: "opensea",
    name: "OpenSea",
    tagline: "NFT market data",
    color: "#2081E2",
    prompt: "Show me some NFTs currently listed in the goblinarinos721 collection on OpenSea, with their images and prices.",
    display: "Goblinarinos NFTs + prices (OpenSea)",
  },
  {
    id: "lifi",
    name: "LI.FI",
    tagline: "Cross-chain routing",
    color: "#F0349E",
    prompt: "Use your LI.FI tool to find the best route to bridge 0.1 ETH from Ethereum to Base, and summarise it.",
    display: "Best route to bridge 0.1 ETH → Base (LI.FI)",
  },
  {
    id: "flashbots",
    name: "Flashbots",
    tagline: "MEV / blocks",
    color: "#FF5C34",
    prompt: "Use your Flashbots tool to check the latest Ethereum block and its base fee.",
    display: "Latest block + base fee (Flashbots)",
  },
  {
    id: "solana",
    name: "Solana",
    tagline: "Token market data",
    color: "#14F195",
    prompt: "Use your Solana token tool to look up BONK (mint DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263) and give me its price, market cap and liquidity.",
    display: "BONK price + market cap (Solana)",
  },
];

// The demo's featured agent — Bulla Goblin #16, a Pixel Goblins agent on the
// community-metered registry (pool-funded → walletless judge clicks just work).
// Deliberately the SAME agent whose attestation is recomputed on /verify, so the
// agent you drive here is the agent you verify there — the loop closes.
export const DEMO_AGENT = {
  registry: "0xe0454dfa17a57a84c3e0e2dbfda5318cbbe91e2c",
  agentId: "11",
  name: "Bulla Goblin #16",
  ens: "pixel-goblins.dinamic.eth",
  by: "Pixel Goblins",
};
