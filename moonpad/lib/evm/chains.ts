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

/**
 * Canonical Coop V2 deployments per chain. Selecting the chain via
 * NEXT_PUBLIC_EVM_CHAIN is the ONLY switch needed to go testnet <-> mainnet —
 * addresses and the indexer start block follow automatically. Env vars
 * (NEXT_PUBLIC_LAUNCHPAD_ADDRESS / NEXT_PUBLIC_ROUTER_ADDRESS /
 * EVM_INDEXER_START_BLOCK) still override for local anvil runs.
 */
const DEPLOYMENTS: Record<
  string,
  { launchpad: `0x${string}`; router: `0x${string}`; startBlock: string } | undefined
> = {
  robinhood: {
    launchpad: "0x39d80E039591dFA0C0C6016987982dd025498cC8",
    router: "0x7490D61Ed78ba14d4535D74aA5EADb44f5921e5a",
    startBlock: "10516434",
  },
  robinhoodTestnet: {
    launchpad: "0x2f52bf3D414828171F46Bf90977BFAe525EB1d93",
    router: "0xAce41967Cca6D0CCde8fDb04c596b76C3462aC5c",
    startBlock: "90481000",
  },
};

function chainKey(): string {
  return process.env.NEXT_PUBLIC_EVM_CHAIN?.trim() || "local";
}

/** Active chain, selected with NEXT_PUBLIC_EVM_CHAIN=robinhood|robinhoodTestnet|local. */
export function activeChain(): Chain {
  const chain = chainsByKey[chainKey()];
  if (!chain) {
    throw new Error(
      `Unknown NEXT_PUBLIC_EVM_CHAIN "${chainKey()}" (expected robinhood | robinhoodTestnet | local)`
    );
  }
  return chain;
}

export function launchpadAddress(): `0x${string}` {
  const env = process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS?.trim();
  if (env && env.startsWith("0x")) return env as `0x${string}`;
  const deployment = DEPLOYMENTS[chainKey()];
  if (deployment) return deployment.launchpad;
  throw new Error(
    "No launchpad for this chain — set NEXT_PUBLIC_LAUNCHPAD_ADDRESS (local/anvil runs need it)"
  );
}

/** CoopRouter — the ETH<->token swap helper the trade widget uses. */
export function routerAddress(): `0x${string}` {
  const env = process.env.NEXT_PUBLIC_ROUTER_ADDRESS?.trim();
  if (env && env.startsWith("0x")) return env as `0x${string}`;
  const deployment = DEPLOYMENTS[chainKey()];
  if (deployment) return deployment.router;
  throw new Error(
    "No router for this chain — set NEXT_PUBLIC_ROUTER_ADDRESS (local/anvil runs need it)"
  );
}

/** First block the indexer scans on a fresh database. */
export function indexerStartBlock(): string | undefined {
  const env = process.env.EVM_INDEXER_START_BLOCK?.trim();
  if (env) return env;
  return DEPLOYMENTS[chainKey()]?.startBlock;
}

export function isEvmConfigured(): boolean {
  try {
    return launchpadAddress().length === 42;
  } catch {
    return false;
  }
}

export function explorerUrl(kind: "tx" | "address" | "token", value: string): string {
  const base = activeChain().blockExplorers?.default.url;
  if (!base) return "";
  return `${base}/${kind === "tx" ? "tx" : kind === "token" ? "token" : "address"}/${value}`;
}
