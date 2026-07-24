"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { getNonce, verifySiwe } from "@/lib/api";

const TOKEN_KEY = "ens-kit-admin-token";

export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { open } = useAppKit();
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
      // Sign with the WAGMI-connected wallet (not raw window.ethereum) so it works on mobile
      // Safari / WalletConnect, not just the desktop MetaMask extension.
      if (!isConnected || !address) {
        await open(); // opens the wallet modal — WalletConnect deep-links to the wallet app on mobile
        throw new Error("Connect your wallet, then tap Sign In again.");
      }
      const connectedAddress = address as `0x${string}`;

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

      const signature = await signMessageAsync({ message });

      const { token: jwt } = await verifySiwe(message, signature, password);
      localStorage.setItem(TOKEN_KEY, jwt);
      setToken(jwt);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, signMessageAsync, open]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  return { token, login, logout, loading, error, address };
}
