export type ListingStatus =
  | "live"
  | "upcoming"
  | "launching"
  | "filled"
  | "ended"
  | "refund";

export interface PresaleOnChainState {
  mint: string;
  tokenName: string;
  tokenTicker: string;
  tokenUri: string;
  description: string;
  creator: string;
  /** Per-presale platform treasury (SOL); not shown to end users in production UIs. */
  treasury: string;
  totalRaised: bigint;
  raiseTarget: bigint;
  /** Raw token supply (6 decimals), matches mint total. */
  totalSupply: bigint;
  lpTokensAmount: bigint;
  distributionAmount: bigint;
  /** Set at hatch; 0 while presale is open. */
  tokensPerLamportX64: bigint;
  totalContributors: number;
  endTime: Date;
  startTime: Date;
  launched: boolean;
  refundEnabled: boolean;
  /** Unix moment when raise target was first hit; null if not yet. */
  goalReachedAt: Date | null;
  /** Meteora pool (default pubkey until registered after LP setup). */
  pool: string;
  positionNftMint: string;
  maxContribution: bigint;
  feePoolPerShareX64: bigint;
  progressPercent: number;
  /** Set when merging API or client views (see computeListingStatus). */
  listingStatus: ListingStatus;
}

/** Raw on-chain decode before attaching `listingStatus`. */
export type PresaleDecoded = Omit<PresaleOnChainState, "listingStatus">;

export interface ContributionOnChainState {
  amountContributed: bigint;
  claimed: boolean;
  refunded: boolean;
  earlyWithdrew: boolean;
  feeDebtX64: bigint;
  feesCollected: bigint;
}
