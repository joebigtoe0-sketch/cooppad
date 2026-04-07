/** Fixed presale rules for the web app (still passed as ix args on-chain). */
export const PLATFORM_PRESALE_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

export const PLATFORM_MAX_CONTRIBUTION_LAMPORTS = 2n * 1_000_000_000n; // 2 SOL

/** Placeholder metadata URI until IPFS/Pinata wiring — unique per mint, under 200 chars. */
export function placeholderTokenUri(mintBase58: string): string {
  const base = `https://moonpad.local/m/${mintBase58}`;
  return base.length <= 200 ? base : base.slice(0, 200);
}
