/** Fixed presale rules for the web app (still passed as ix args on-chain). */
export const PLATFORM_PRESALE_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

export const LAMPORTS_PER_SOL = 1_000_000_000n;

export const PLATFORM_MAX_CONTRIBUTION_LAMPORTS = 2n * LAMPORTS_PER_SOL; // 2 SOL

/** Matches on-chain `MIN_CONTRIBUTION` (0.01 SOL). */
export const PLATFORM_MIN_CONTRIBUTION_LAMPORTS = 10_000_000n;

/** Must match `programs/moonpad` `RAISE_TARGET` (dev build: 0.85 SOL). */
export const ONCHAIN_RAISE_TARGET_LAMPORTS = 850_000_000n;

/**
 * Raise target baked into presales initialized with the older `RAISE_TARGET` constant
 * (85 SOL). Used only to show a hint in the UI — real caps always come from chain.
 */
export const LEGACY_ONCHAIN_RAISE_TARGET_LAMPORTS = 85n * LAMPORTS_PER_SOL;

/** Max net SOL that can be contributed in one tx given raise + per-wallet caps. */
export function computeMaxNetContributeLamports(p: {
  raiseTarget: bigint;
  totalRaised: bigint;
  maxContribution: bigint;
  currentContributed: bigint;
}): bigint {
  const remainingRaise =
    p.raiseTarget > p.totalRaised ? p.raiseTarget - p.totalRaised : 0n;

  let cap = remainingRaise;
  if (p.maxContribution > 0n) {
    const walletLeft = p.maxContribution - p.currentContributed;
    const w = walletLeft > 0n ? walletLeft : 0n;
    cap = cap < w ? cap : w;
  }
  return cap > 0n ? cap : 0n;
}

/** Stable decimal string for an amount input (up to 9 fractional digits). */
export function lamportsToSolInputString(lamports: bigint): string {
  if (lamports <= 0n) return "";
  const whole = lamports / LAMPORTS_PER_SOL;
  const frac = lamports % LAMPORTS_PER_SOL;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/** 1% of net, same integer division as on-chain `net / 100`. */
export function platformFeeOnTopFromNet(netLamports: bigint): {
  feeLamports: bigint;
  grossLamports: bigint;
} {
  const feeLamports = netLamports / 100n;
  return { feeLamports, grossLamports: netLamports + feeLamports };
}

/**
 * Must match on-chain `POST_GOAL_LAUNCH_DELAY_SECS` (60s default dev build; mainnet program uses 3600s).
 * Change only when you deploy a matching program build.
 */
export const POST_GOAL_LAUNCH_DELAY_SECS = 60;

/** Must match `programs/moonpad` `InitializePresaleParams` / `PresaleState` (Metaplex `uri` max 200). */
export const INIT_TOKEN_URI_MAX_BYTES = 200;
export const INIT_DESCRIPTION_MAX_BYTES = 128;
export const INIT_SOCIAL_MAX_BYTES = 48;
export const INIT_WEBSITE_MAX_BYTES = 80;

/** Placeholder metadata URI until IPFS/Pinata wiring — unique per mint. */
/** Parse user SOL amount (e.g. "0.5" or "2") into net lamports; empty → 0n; invalid → null. */
export function parseSolAmountToNetLamports(input: string): bigint | null {
  const t = input.trim();
  if (!t) return 0n;
  if (!/^\d+(\.\d{1,9})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  const fracPadded = `${frac}000000000`.slice(0, 9);
  return BigInt(whole) * LAMPORTS_PER_SOL + BigInt(fracPadded);
}

export function placeholderTokenUri(mintBase58: string): string {
  const base = `https://moonpad.local/m/${mintBase58}`;
  const enc = new TextEncoder().encode(base);
  if (enc.length <= INIT_TOKEN_URI_MAX_BYTES) return base;
  const slice = enc.slice(0, INIT_TOKEN_URI_MAX_BYTES);
  return new TextDecoder().decode(slice);
}
