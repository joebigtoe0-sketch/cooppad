"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

import { activeChain } from "@/lib/evm/chains";

const chain = activeChain();
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

/**
 * With a WalletConnect project id we get the full RainbowKit wallet list;
 * without one (local dev) we fall back to injected wallets only.
 */
export const wagmiConfig = projectId
  ? getDefaultConfig({
      appName: "The Coop",
      projectId,
      chains: [chain],
      transports: { [chain.id]: http() },
      ssr: true,
    })
  : createConfig({
      chains: [chain],
      connectors: [injected()],
      transports: { [chain.id]: http() },
      ssr: true,
    });
