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
  totalContributors: number;
  endTime: Date;
  startTime: Date;
  launched: boolean;
  refundEnabled: boolean;
  maxContribution: bigint;
  feePoolPerShareX64: bigint;
  progressPercent: number;
}

export interface ContributionOnChainState {
  amountContributed: bigint;
  claimed: boolean;
  refunded: boolean;
  earlyWithdrew: boolean;
  feeDebtX64: bigint;
  feesCollected: bigint;
}
