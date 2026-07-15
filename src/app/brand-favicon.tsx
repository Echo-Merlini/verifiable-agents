"use client";
import { useEffect } from "react";

const GW_URL   = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const ENS_NAME = process.env.NEXT_PUBLIC_ENS_NAME    || "dinamic.eth";

const SUB_NAMES: Record<string, string> = {
  agents:      `agents.${ENS_NAME}`,
  agent:       `agent.${ENS_NAME}`,
  "my-agents": `my-agents.${ENS_NAME}`,
  spec:        `spec.${ENS_NAME}`,
  feed:        `feed.${ENS_NAME}`,
};

async function fetchIcon(name: string): Promise<string | null> {
  try {
    const r = await fetch(`${GW_URL}/record/${encodeURIComponent(name)}`);
    if (!r.ok) return null;
    const data = await r.json();
    return (data.text_records?.icon as string) || null;
  } catch { return null; }
}

function setFavicon(url: string) {
  document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']").forEach(el => el.remove());
  const link = document.createElement("link");
  link.rel  = "icon";
  link.type = url.endsWith(".svg") || url.includes("svg") ? "image/svg+xml" : "image/png";
  link.href = url;
  document.head.appendChild(link);
}

export function BrandFavicon() {
  useEffect(() => {
    const route    = (window as any).__ENS_ROUTE__ as string | undefined;
    const subLabel = window.location.hostname.split(".")[0];
    const subName  = SUB_NAMES[route ?? ""] ?? SUB_NAMES[subLabel] ?? null;
    const isRoot   = !subName;

    (async () => {
      // Try the current page own icon first, then fall back to root
      const icon =
        (!isRoot && (await fetchIcon(subName!))) ||
        (await fetchIcon(ENS_NAME));
      if (icon) setFavicon(icon);
    })();
  }, []);

  return null;
}
