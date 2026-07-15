/**
 * Mirror of the on-chain curve constants (evm/src/CoopLaunchpad.sol) for display
 * math. Trade quotes always come from the contract's quoteBuy/quoteSell — never
 * recompute them here.
 */
export const VIRTUAL_ETH_RESERVE = 1_250_000_000_000_000_000n; // 1.25 ETH
export const VIRTUAL_TOKEN_RESERVE = 1_073_000_000n * 10n ** 18n;
export const CURVE_TARGET_ETH = 3_500_000_000_000_000_000n; // 3.5 ETH
export const TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;
export const CURVE_FEE_BPS = 100n; // 0.5% platform + 0.5% creator

/** Spot price in ETH per token (float — display only). */
export function priceEthPerToken(vEth: bigint, vToken: bigint): number {
  if (vToken === 0n) return 0;
  return Number(vEth) / Number(vToken);
}

/** Fully-diluted market cap in ETH (float — display only). */
export function marketCapEth(vEth: bigint, vToken: bigint): number {
  return priceEthPerToken(vEth, vToken) * 1e9;
}

/** Curve completion in [0, 1]. */
export function curveProgress(vEth: bigint): number {
  const raised = vEth - VIRTUAL_ETH_RESERVE;
  if (raised <= 0n) return 0;
  const p = Number(raised) / Number(CURVE_TARGET_ETH);
  return p > 1 ? 1 : p;
}

export function raisedEth(vEth: bigint): number {
  const raised = vEth - VIRTUAL_ETH_RESERVE;
  return raised <= 0n ? 0 : Number(raised) / 1e18;
}

export function formatEth(wei: bigint | string, digits = 4): string {
  const v = typeof wei === "string" ? BigInt(wei) : wei;
  return (Number(v) / 1e18).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });
}

export function formatTokenAmount(raw: bigint | string): string {
  const v = typeof raw === "string" ? BigInt(raw) : raw;
  const n = Number(v) / 1e18;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return n.toFixed(2);
}

// --- V2 instant-pool dev-buy quote (mirrors CoopLaunchpadV2 launch math) ---
const V2_INITIAL_TICK = -205_800;
const V2_MAX_TICK = 887_200;
const V2_SUPPLY = 1e9; // whole tokens
const POOL_FEE = 0.01; // 1% Uniswap tier

function sqrtRatioAtTick(tick: number): number {
  return Math.pow(1.0001, tick / 2);
}

/**
 * Estimate how many tokens a dev buy of `ethIn` receives at launch. The launch
 * mints the entire supply single-sided into a Uniswap v3 range, so the dev buy
 * is a swap that walks price up that range. Dev buys are exempt from the Super
 * LP 5% tax, so the same estimate applies to every flavor. Display only —
 * actual output is whatever the swap returns on-chain.
 */
export function quoteDevBuyTokens(ethIn: number): number {
  if (!(ethIn > 0)) return 0;
  const sqrtLower = sqrtRatioAtTick(V2_INITIAL_TICK);
  const sqrtUpper = sqrtRatioAtTick(V2_MAX_TICK);
  // Price starts at the bottom of the range; the position is all token there.
  const L = (V2_SUPPLY * (sqrtLower * sqrtUpper)) / (sqrtUpper - sqrtLower);
  const dy = ethIn * (1 - POOL_FEE); // WETH in, after the pool fee
  const sqrtNew = sqrtLower + dy / L;
  const tokensOut = L * (1 / sqrtLower - 1 / sqrtNew);
  return Math.max(0, Math.min(tokensOut, V2_SUPPLY));
}

/** Dev-buy tokens as a percentage of total supply (for a “X% of supply” hint). */
export function devBuySupplyPct(ethIn: number): number {
  return (quoteDevBuyTokens(ethIn) / V2_SUPPLY) * 100;
}
