"use client";

import { useAppKit } from "@reown/appkit/react";

export function useWalletModal() {
  const { open } = useAppKit();
  return {
    open: () => open({ view: "Connect" }),
  };
}
