"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount } from "wagmi";
import { getNonce, verifySiwe } from "@/lib/api";

const TOKEN_KEY = "ens-kit-admin-token";

export function useAuth() {
  const { address } = useAccount();
const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return;
    try {
      const payload = JSON.parse(atob(stored.split(".")[1]));
      if (payload.exp && payload.exp < Date.now() / 1000) {
        localStorage.removeItem(TOKEN_KEY);
        return;
      }
    } catch { localStorage.removeItem(TOKEN_KEY); return; }
    setToken(stored);
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (password?: string) => {
    setLoading(true);
    setError(null);
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error("MetaMask not found. Install it at metamask.io.");

      // Always request accounts via raw provider — works whether wagmi is connected or not
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      const connectedAddress = (accounts[0] ?? address) as `0x${string}`;
      if (!connectedAddress) throw new Error("No account available.");

      const nonce = await getNonce();
      const domain = window.location.host;
      const message = [
        `${domain} wants you to sign in with your Ethereum account:`,
        connectedAddress,
        "",
        "Sign in to ENS Offchain Kit Admin",
        "",
        `URI: ${window.location.origin}`,
        "Version: 1",
        "Chain ID: 1",
        `Nonce: ${nonce}`,
        `Issued At: ${new Date().toISOString()}`,
      ].join("\n");

      // personal_sign with plain text — MetaMask shows the readable SIWE message
      const signature: string = await eth.request({
        method: "personal_sign",
        params: [message, connectedAddress],
      });

      const { token: jwt } = await verifySiwe(message, signature, password);
      localStorage.setItem(TOKEN_KEY, jwt);
      setToken(jwt);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  return { token, login, logout, loading, error, address };
}
