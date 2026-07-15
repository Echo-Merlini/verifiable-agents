"use client";

import { useState, useEffect } from "react";

export const GATEWAY_ENVS = {
  production: {
    label: "Production (public)",
    url: "https://gateway.ensub.org",
    rpc: "Ethereum Mainnet",
    rpcUrl: "https://cloudflare-eth.com",
    chainId: 1,
    color: "bg-green-500",
  },
  local: {
    label: "Local Dev (NAS direct — use this from localhost)",
    url: "http://192.168.68.52:8787",
    rpc: "Ethereum Mainnet",
    rpcUrl: "https://cloudflare-eth.com",
    chainId: 1,
    color: "bg-amber-500",
  },
} as const;

export type GatewayEnvKey = keyof typeof GATEWAY_ENVS;

const STORAGE_KEY = "ens-kit-gateway-env";

export function getGatewayUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_GATEWAY_URL || GATEWAY_ENVS.production.url;
  }
  const env = (localStorage.getItem(STORAGE_KEY) as GatewayEnvKey) || "production";
  return GATEWAY_ENVS[env]?.url ?? GATEWAY_ENVS.production.url;
}

export function useGatewayEnv() {
  const [envKey, setEnvKey] = useState<GatewayEnvKey>("production");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as GatewayEnvKey | null;
    if (stored && stored in GATEWAY_ENVS) setEnvKey(stored);
  }, []);

  const setEnv = (key: GatewayEnvKey) => {
    localStorage.setItem(STORAGE_KEY, key);
    setEnvKey(key);
  };

  return { envKey, env: GATEWAY_ENVS[envKey], setEnv, envs: GATEWAY_ENVS };
}
