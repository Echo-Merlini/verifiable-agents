# Recompute Kit Bots — hackathon mint art

Placeholder art for the **Recompute Kit Bots** genesis collection (task #82). Base bot
is on-brand Vértice (ink/brass, recompute-refresh emblem, "DON'T TRUST · RECOMPUTE").
You'll make the variants; each variant is one SVG, pinned to IPFS, mintable on its own.

## Preview
Open `recompute-bot-base.svg` in any browser (double-click the file) — it's self-contained,
800×800, renders anywhere an NFT renderer would.

## Make a variant (≈30 seconds)
1. Copy `recompute-bot-base.svg` → `recompute-bot-<name>.svg`
2. Edit the `<style>` block at the top — realistically just two roles change:
   - `.shell0` / `.shell1` → the body colour
   - `.eye0` / `.eye1` **and** `.accent` / `.accentS` → the glow + trim (keep them matched)
3. Leave `.ink*` outlines black. Done.

### Sample palettes (drop-in)
| Variant | `.shell0` / `.shell1` (body) | `.eye0` / `.eye1` + `.accent` (glow/trim) |
|---------|------------------------------|-------------------------------------------|
| **Brass** (base) | `#F6F6F8` / `#C9CCD4` | `#E0A24C` / `#A15E1E` |
| **Emerald** | `#F6F6F8` / `#C9CCD4` | `#34D399` / `#059669` |
| **Cyan** | `#F6F6F8` / `#C9CCD4` | `#22D3EE` / `#0891B2` |
| **Magenta** | `#F6F6F8` / `#C9CCD4` | `#F0349E` / `#9D174D` |
| **Violet** | `#F6F6F8` / `#C9CCD4` | `#A78BFA` / `#6D28D9` |
| **Obsidian** (dark body) | `#2A2E38` / `#15171d` | `#E0A24C` / `#A15E1E` |
| **Molten** (brass body) | `#E0A24C` / `#A15E1E` | `#F6F6F8` / `#C9CCD4` |

> `.accent` uses `fill:`, `.accentS` uses `stroke:` — set both to the same colour (e.g.
> `.accent{fill:#34D399}` and `.accentS{stroke:#34D399}`).

### Sponsor logos
Leave the lower band (below the emblem, above the wordmark) for a sponsor row when you have
the logos — there's clear space at y≈650–700. Drop them in as `<image>` or inline `<path>`.

## Pin + metadata (for the mint)
Each variant SVG gets its own IPFS pin (Pinata — see `reference_pinata`), and one metadata
JSON per variant:

```json
{
  "name": "Recompute Kit Bot — Emerald",
  "description": "A verifiable agent you recompute, not trust. Minting binds this bot as your agent on the Verifiable Agents genesis registry. Don't trust. Recompute.",
  "image": "ipfs://<VARIANT_IMAGE_CID>/recompute-bot-emerald.svg",
  "attributes": [
    { "trait_type": "Collection", "value": "Recompute Kit Bots" },
    { "trait_type": "Variant", "value": "Emerald" }
  ]
}
```

Pin each metadata JSON too → you get a `tokenURI` per variant. The genesis mint lets a minter
pass their chosen variant's `tokenURI` at register time (the `register(string agentURI, …)`
overload), so **people mint whichever colour they like** — exactly the flow you described.

## Next (my side, on your go)
- Deploy the themed `GenesisAgentRegistry` (`GENESIS_NAME="Recompute Kit Bots"`) — mainnet,
  **SAFE deployer `0xFf9a…ca14`**, not the compromised baked key.
- Register it in the gateway; point `/mint` at it; then #83 connect-wallet detection.
