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

export const MCP_SELECTORS: McpSelector[] = [
  {
    id: "opensea",
    name: "OpenSea",
    tagline: "NFT market data",
    color: "#2081E2",
    prompt: "Use your OpenSea tool to show me a few trending NFT collections right now, with floor prices.",
    display: "Show trending NFT collections (OpenSea)",
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
    id: "alchemy",
    name: "Alchemy",
    tagline: "Chain data",
    color: "#4E5BF2",
    prompt: "Use your Alchemy tool to fetch the current Ethereum block number and gas price.",
    display: "Current ETH block + gas (Alchemy)",
  },
  {
    id: "flashbots",
    name: "Flashbots",
    tagline: "MEV / private txs",
    color: "#FF5C34",
    prompt: "Use your Flashbots tool to check the latest block and explain how a private bundle would be submitted.",
    display: "Check latest block + private bundles (Flashbots)",
  },
];

// The demo's featured agent — Trustless Pioneer (Genesis universal-agent mint).
export const DEMO_AGENT = {
  registry: "0xe91934ab1f6a40cc1bb4cd530feff56dfe524963",
  agentId: "1",
  name: "Trustless Pioneer",
  ens: "dinamic.eth",
  by: "Trustless-ai",
};
