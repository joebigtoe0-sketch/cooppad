import type { ListingStatus, PresaleOnChainState } from "@/types";

/** JSON-safe presale row from GET /api/presales */
export type PresaleListItemJson = {
  mint: string;
  tokenName: string;
  tokenTicker: string;
  tokenUri: string;
  description: string;
  creator: string;
  treasury: string;
  totalRaised: string;
  raiseTarget: string;
  totalSupply: string;
  lpTokensAmount: string;
  distributionAmount: string;
  tokensPerLamportX64: string;
  totalContributors: number;
  endTime: string;
  startTime: string;
  launched: boolean;
  refundEnabled: boolean;
  goalReachedAt: string | null;
  pool?: string;
  positionNftMint?: string;
  maxContribution: string;
  feePoolPerShareX64: string;
  progressPercent: number;
  listingStatus: ListingStatus;
};

export function presaleStateToJson(p: PresaleOnChainState): PresaleListItemJson {
  return {
    mint: p.mint,
    tokenName: p.tokenName,
    tokenTicker: p.tokenTicker,
    tokenUri: p.tokenUri,
    description: p.description,
    creator: p.creator,
    treasury: p.treasury,
    totalRaised: p.totalRaised.toString(),
    raiseTarget: p.raiseTarget.toString(),
    totalSupply: p.totalSupply.toString(),
    lpTokensAmount: p.lpTokensAmount.toString(),
    distributionAmount: p.distributionAmount.toString(),
    tokensPerLamportX64: p.tokensPerLamportX64.toString(),
    totalContributors: p.totalContributors,
    endTime: p.endTime.toISOString(),
    startTime: p.startTime.toISOString(),
    launched: p.launched,
    refundEnabled: p.refundEnabled,
    goalReachedAt: p.goalReachedAt ? p.goalReachedAt.toISOString() : null,
    pool: p.pool,
    positionNftMint: p.positionNftMint,
    maxContribution: p.maxContribution.toString(),
    feePoolPerShareX64: p.feePoolPerShareX64.toString(),
    progressPercent: p.progressPercent,
    listingStatus: p.listingStatus,
  };
}

export function jsonToPresaleState(j: PresaleListItemJson): PresaleOnChainState {
  return {
    mint: j.mint,
    tokenName: j.tokenName,
    tokenTicker: j.tokenTicker,
    tokenUri: j.tokenUri,
    description: j.description,
    creator: j.creator,
    treasury: j.treasury,
    totalRaised: BigInt(j.totalRaised),
    raiseTarget: BigInt(j.raiseTarget),
    totalSupply: BigInt(j.totalSupply),
    lpTokensAmount: BigInt(j.lpTokensAmount),
    distributionAmount: BigInt(j.distributionAmount),
    tokensPerLamportX64: BigInt(j.tokensPerLamportX64),
    totalContributors: j.totalContributors,
    endTime: new Date(j.endTime),
    startTime: new Date(j.startTime),
    launched: j.launched,
    refundEnabled: j.refundEnabled,
    goalReachedAt: j.goalReachedAt ? new Date(j.goalReachedAt) : null,
    pool: j.pool ?? "11111111111111111111111111111111",
    positionNftMint: j.positionNftMint ?? "11111111111111111111111111111111",
    maxContribution: BigInt(j.maxContribution),
    feePoolPerShareX64: BigInt(j.feePoolPerShareX64),
    progressPercent: j.progressPercent,
    listingStatus: j.listingStatus ?? "ended",
  };
}
