import { defineChain, type Chain } from "viem";

/**
 * Robinhood Chain (Arbitrum Orbit L2, gas in ETH). Mainnet live since 2026-07-01,
 * Uniswap v2/v3/v4 deployed from day one. Etherscan does not index 4663 — the
 * canonical explorer is Blockscout.
 */
export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ??
          "https://rpc.mainnet.chain.robinhood.com",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL ??
          "https://rpc.testnet.chain.robinhood.com",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Testnet Explorer",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: true,
});

/**
 * Canonical Uniswap v2 on Robinhood Chain mainnet — verified live against
 * rpc.mainnet.chain.robinhood.com on 2026-07-14 (router.factory() and
 * router.WETH() cross-checked). Testnet has no public Uniswap v2; we deploy
 * our own stack there (evm/script/DeployLocal.s.sol works on any RPC).
 */
export const UNISWAP_V2_ROBINHOOD_MAINNET = {
  factory: "0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f",
  router: "0x89e5db8b5aa49aa85ac63f691524311aeb649eba",
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
} as const;

/** Local anvil stack (scripts/dev-evm-stack in evm/ deploys Uniswap + launchpad). */
export const localAnvil = defineChain({
  id: 31337,
  name: "Anvil (local)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_LOCAL_RPC_URL ?? "http://127.0.0.1:8545"],
    },
  },
  testnet: true,
});

const chainsByKey: Record<string, Chain> = {
  robinhood: robinhoodChain,
  robinhoodTestnet: robinhoodTestnet,
  local: localAnvil,
};

/** Active chain, selected with NEXT_PUBLIC_EVM_CHAIN=robinhood|robinhoodTestnet|local. */
export function activeChain(): Chain {
  const key = process.env.NEXT_PUBLIC_EVM_CHAIN?.trim() || "local";
  const chain = chainsByKey[key];
  if (!chain) {
    throw new Error(
      `Unknown NEXT_PUBLIC_EVM_CHAIN "${key}" (expected robinhood | robinhoodTestnet | local)`
    );
  }
  return chain;
}

export function launchpadAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS?.trim();
  if (!addr || !addr.startsWith("0x")) {
    throw new Error(
      "NEXT_PUBLIC_LAUNCHPAD_ADDRESS is not set — deploy evm/script/Deploy.s.sol and set it"
    );
  }
  return addr as `0x${string}`;
}

export function isEvmConfigured(): boolean {
  const addr = process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS?.trim();
  return Boolean(addr && addr.startsWith("0x") && addr.length === 42);
}

export function explorerUrl(kind: "tx" | "address" | "token", value: string): string {
  const base = activeChain().blockExplorers?.default.url;
  if (!base) return "";
  return `${base}/${kind === "tx" ? "tx" : kind === "token" ? "token" : "address"}/${value}`;
}
