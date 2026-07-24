"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, sepolia } from "@reown/appkit/networks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

// Reown/WalletConnect projectId — the GobLanding project (works on mobile iOS; the previous
// hardcoded one was unconfigured → "failed to publish payload"). Override via env if needed.
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || "0ef0fb9a8de743a918d511c63bc8e7b8";

// Use current origin so WalletConnect domain verification always matches
const appUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || "https://gateway.ensub.org");

const metadata = {
  name: "ENS Dynamic Kit",
  description: "AI agent identity on Ethereum",
  url: appUrl,
  icons: [`${appUrl}/logo.png`],
};

const wagmiAdapter = new WagmiAdapter({
  networks: [mainnet, sepolia],
  projectId,
  ssr: true,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: [mainnet, sepolia],
  projectId,
  metadata,
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
