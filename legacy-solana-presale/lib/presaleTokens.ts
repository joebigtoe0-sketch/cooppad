/** SPL mint decimals from on-chain `initialize_presale` (`mint::decimals = 6`). */
export const PRESALE_TOKEN_DECIMALS = 6;

const TOKEN_UNIT = 10n ** BigInt(PRESALE_TOKEN_DECIMALS);

export type PresaleTokenQuoteParams = {
  tokensPerLamportX64: bigint;
  distributionAmount: bigint;
  raiseTarget: bigint;
};

/**
 * Raw token amount (smallest units, 6 decimals) credited for a given net SOL
 * contribution. Uses fixed-point rate after hatch; before hatch, estimates
 * pro-rata against the raise target (same split as a full-cap raise).
 */
export function rawTokensForNetLamports(
  netLamports: bigint,
  p: PresaleTokenQuoteParams
): bigint {
  if (netLamports <= 0n) return 0n;
  if (p.tokensPerLamportX64 > 0n) {
    return (netLamports * p.tokensPerLamportX64) >> 64n;
  }
  if (p.raiseTarget <= 0n || p.distributionAmount <= 0n) return 0n;
  return (netLamports * p.distributionAmount) / p.raiseTarget;
}

/** Human-readable amount from on-chain raw (integer + up to 6 decimal places). */
export function formatPresaleTokenHuman(rawAmount: bigint): string {
  if (rawAmount <= 0n) return "0";
  const whole = rawAmount / TOKEN_UNIT;
  const frac = rawAmount % TOKEN_UNIT;
  const wholeStr = whole.toLocaleString();
  if (frac === 0n) return wholeStr;
  const fracStr = frac
    .toString()
    .padStart(PRESALE_TOKEN_DECIMALS, "0")
    .replace(/0+$/, "");
  return `${wholeStr}.${fracStr}`;
}

export function formatTokensWithTicker(rawAmount: bigint, ticker: string): string {
  const t = ticker.trim() || "?";
  return `${formatPresaleTokenHuman(rawAmount)} $${t}`;
}

/** Whole billions of human tokens (raw has 6 decimals): raw / 10^15. */
export function humanTokenBillionsWhole(rawTotalSupply: bigint): bigint {
  return rawTotalSupply / (TOKEN_UNIT * 1_000_000_000n);
}
