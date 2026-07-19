// marketplace.ts — the single data model both /marketplace (buyer) and /console
// (owner/auditor) render. Everything keys off the agent (registry, agentId). The
// reputation is a predicate over public ConsultEscrow facts, recomputed on-chain by the
// gateway (see gateway lib/reputation.ts) — these types mirror that response 1:1.

import { getGatewayUrl } from "@/hooks/useGatewayEnv";

export type ReputationWindow = "complete" | "incomplete";

export interface Reputation {
  registry: string;
  agentId: string;
  successful: number;
  unsuccessful: number;
  stale: number;
  inFlight: number;
  notOnchain: number;
  unverifiable: number;
  bindingVerified?: number;       // jobs whose jobId recomputes from its published salt
  bindingAsserted?: number;       // legacy jobs (no salt) — binding not recomputable
  trials: number;                 // successful + unsuccessful (the Wilson n)
  successRate: number | null;     // point estimate; null when trials = 0
  wilsonLower: number | null;     // 95% lower bound; null when trials = 0
  window: ReputationWindow;
  recompute: {
    method: string;
    escrow: string | null;
    chainId: number | null;
    z: number;
    note: string;
  };
}

export interface MarketAgent {
  registry: string;
  agentId: string;
  name: string;
  description: string;
  image: string;
  consultPrice: string;           // wei
  completionWindow: number;       // seconds
  consultTools: string[];
  reputation: Reputation | null;
  entitlements?: string[];        // premium capability slugs this agent NFT holds (on-chain)
}

export async function fetchMarketAgents(): Promise<MarketAgent[]> {
  try {
    const r = await fetch(`${getGatewayUrl()}/marketplace/agents`);
    if (!r.ok) return [];
    const list = await r.json();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function fetchReputation(registry: string, agentId: string): Promise<Reputation | null> {
  try {
    const r = await fetch(`${getGatewayUrl()}/marketplace/reputation/${registry}/${agentId}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── Premium MCP store ────────────────────────────────────────────────────────
// Purchasable capabilities bound to an agent NFT (carried with the token). Mirrors the
// gateway PremiumMcpView.

export interface PremiumMcp {
  slug: string;
  label: string;
  tagline: string;
  description: string;
  logo: string;
  gates: string[];
  mcpId: string;          // keccak256(slug) — the on-chain id
  price: string;          // wei (live on-chain price if registered, else default)
  active: boolean;
  payTo: string | null;
  registered: boolean;    // registered on-chain yet?
  contract: string | null;
  chainId: number;
}

export interface Entitlement {
  registry: string;
  tokenId: string;
  slug: string;
  mcpId: string;
  entitled: boolean | null; // null = unknown (not deployed / read failed)
  expiry: string | null;
  perpetual: boolean;
  contract: string | null;
  chainId: number;
}

export async function fetchPremiumMcps(): Promise<PremiumMcp[]> {
  try {
    const r = await fetch(`${getGatewayUrl()}/marketplace/mcps`);
    if (!r.ok) return [];
    const list = await r.json();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function fetchEntitlement(registry: string, tokenId: string, slug: string): Promise<Entitlement | null> {
  try {
    const r = await fetch(`${getGatewayUrl()}/marketplace/entitlement/${registry}/${tokenId}/${slug}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── Licensed-MCP audit ───────────────────────────────────────────────────────
export type AuditVerdict = "clean" | "violation" | "unknown";
export interface McpAuditPremiumUse {
  tool: string;
  slug: string;
  entitledAtAction: boolean | null; // recomputed at the action's time (Q1)
  gate: "allow" | "deny" | null;    // recorded gate decision (Q2)
  verdict: AuditVerdict;
}
export interface McpAuditRow {
  id: number;
  actionType: string;
  createdAt: number;
  mcpsUsed: string[];
  premiumUsed: McpAuditPremiumUse[];
  denied: { tool: string; reason: string }[];
  verdict: AuditVerdict;
}
export interface McpAudit {
  registry: string;
  agentId: string;
  rows: McpAuditRow[];
  summary: { actions: number; clean: number; violation: number; unknown: number; enforced: number };
  recompute: { method: string; contract: string | null; chainId: number; note: string };
}

export async function fetchMcpAudit(registry: string, agentId: string): Promise<McpAudit | null> {
  try {
    const r = await fetch(`${getGatewayUrl()}/marketplace/mcp-audit/${registry}/${agentId}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── Presentation helpers (pure) ────────────────────────────────────────────────
// Nothing here invents a number — they only format the Wilson floor + raw counts a
// verifier reproduces from the same escrow reads.

export type RepTone = "strong" | "building" | "early" | "unrated";

/** The confidence-adjusted floor as a whole percent, or null when there is no trial. */
export function repScorePct(rep: Reputation | null | undefined): number | null {
  if (!rep || rep.trials === 0 || rep.wilsonLower === null) return null;
  return Math.round(rep.wilsonLower * 100);
}

/** A qualitative band off the Wilson floor — deliberately conservative (small n reads low). */
export function repTone(rep: Reputation | null | undefined): RepTone {
  const pct = repScorePct(rep);
  if (pct === null) return "unrated";
  if (pct >= 70) return "strong";
  if (pct >= 40) return "building";
  return "early";
}

export const TONE_LABEL: Record<RepTone, string> = {
  strong: "Strong",
  building: "Building",
  early: "Early",
  unrated: "Unrated",
};

/** Tailwind text/border/bg fragments per tone. Semantic hues, NOT the brass accent. */
export const TONE_CLASSES: Record<RepTone, { text: string; ring: string; dot: string }> = {
  strong:   { text: "text-emerald-300", ring: "ring-emerald-400/30", dot: "bg-emerald-400" },
  building: { text: "text-amber-200",   ring: "ring-amber-300/25",   dot: "bg-amber-300" },
  early:    { text: "text-zinc-300",    ring: "ring-zinc-400/20",    dot: "bg-zinc-400" },
  unrated:  { text: "text-zinc-400",    ring: "ring-white/10",       dot: "bg-zinc-500" },
};

export function shortAddr(a: string | null | undefined): string {
  if (!a) return "—";
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
