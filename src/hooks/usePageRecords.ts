"use client";

import { useEffect, useState } from "react";
import { getGatewayUrl } from "./useGatewayEnv";

const ENS_NAME = process.env.NEXT_PUBLIC_ENS_NAME || "dinamic.eth";

export type PageRecords = Record<string, string>;

/**
 * Fetches text records for a given ENS subdomain, merged with the parent
 * ENS name records as defaults (child values win).
 *
 * pageName: e.g. "agent.dinamic.eth" or "my-agents.dinamic.eth"
 */
export function usePageRecords(pageName: string): PageRecords {
  const [tr, setTr] = useState<PageRecords>(() => {
    if (typeof window !== "undefined" && (window as any).__PROFILE__) {
      return (window as any).__PROFILE__;
    }
    return {};
  });

  useEffect(() => {
    // If window.__PROFILE__ is set (IPFS-pinned profile), already initialized above
    const embedded = typeof window !== "undefined" ? (window as any).__PROFILE__ : null;
    if (embedded) { return; }

    const gw = getGatewayUrl();
    async function load() {
      try {
        const [pageRes, parentRes] = await Promise.all([
          fetch(`${gw}/record/${encodeURIComponent(pageName)}`),
          fetch(`${gw}/record/${encodeURIComponent(ENS_NAME)}`),
        ]);
        const page   = pageRes.ok   ? await pageRes.json()   : { text_records: {} };
        const parent = parentRes.ok ? await parentRes.json() : { text_records: {} };
        setTr({ ...parent.text_records, ...page.text_records });
      } catch {}
    }
    load();
  }, [pageName]);

  // Set favicon dynamically from icon record
  useEffect(() => {
    const icon = tr.icon;
    if (!icon) return;
    document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']").forEach(el => el.remove());
    const link = document.createElement("link");
    link.rel  = "icon";
    link.type = icon.includes("svg") ? "image/svg+xml" : "image/png";
    link.href = icon;
    document.head.appendChild(link);
  }, [tr.icon]);

  return tr;
}
