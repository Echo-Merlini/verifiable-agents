import { ShieldCheck, Fingerprint, Database } from "lucide-react";
import type { McpCard } from "@/lib/mcps";

/**
 * Renders an MCP's brand mark: the official logo (bundled in /public/logos) where
 * one exists, a themed lucide icon for our own tools (Recompute Kit, Forensics),
 * or a lettermark as a last resort. Logos sit on a neutral dark chip so their true
 * brand colours show.
 */
export function McpLogo({ card, className = "h-6 w-6", fill = false }: { card: McpCard; className?: string; fill?: boolean }) {
  if (card.logo) {
    // Logos that carry their own background fill the (square) chip edge-to-edge; transparent
    // marks stay centered. `fill` is only passed by square-chip call sites (demo, mint).
    if (fill && card.fill) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={card.logo} alt={card.label} className="h-full w-full object-cover rounded-[inherit]" />;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={card.logo} alt={card.label} className={`${className} object-contain`} />;
  }
  if (card.icon === "recompute") return <ShieldCheck className={`${className} text-brassLight`} />;
  if (card.icon === "forensics") return <Fingerprint className={`${className} text-gb-faint`} />;
  if (card.icon === "storage")   return <Database className={`${className} text-brassLight`} />;
  return <span className="font-display font-semibold text-sm text-paper">{card.label[0]?.toUpperCase()}</span>;
}
