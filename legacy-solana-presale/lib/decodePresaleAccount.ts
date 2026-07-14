import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import { MOONPAD_IDL } from "@/lib/anchor";
import type { PresaleDecoded } from "@/types";

/** First 8 bytes of PresaleState account (Anchor account discriminator). */
export const PRESALE_STATE_DISCRIMINATOR = Buffer.from([
  32, 18, 85, 188, 213, 180, 10, 241,
]);

export function decodePresaleAccount(data: Buffer): PresaleDecoded | null {
  try {
    const coder = new BorshAccountsCoder(MOONPAD_IDL as Idl);
    const raw = coder.decode("PresaleState", data) as Record<string, unknown>;

    const num = (v: unknown) =>
      typeof v === "bigint"
        ? v
        : typeof v === "number"
          ? BigInt(v)
          : BigInt(String(v));

    const totalRaised = num(raw.totalRaised ?? raw.total_raised);
    const raiseTarget = num(raw.raiseTarget ?? raw.raise_target);
    const maxContribution = num(raw.maxContribution ?? raw.max_contribution);
    const totalSupply = num(raw.totalSupply ?? raw.total_supply);
    const lpTokensAmount = num(raw.lpTokensAmount ?? raw.lp_tokens_amount);
    const distributionAmount = num(
      raw.distributionAmount ?? raw.distribution_amount
    );
    const tokensPerLamportX64 = num(
      raw.tokensPerLamportX64 ?? raw.tokens_per_lamport_x64
    );
    const feePoolPerShareX64 = num(
      raw.feePoolPerShareX64 ?? raw.fee_pool_per_share_x64
    );

    const endSec = Number(raw.endTime ?? raw.end_time ?? 0);
    const startSec = Number(raw.startTime ?? raw.start_time ?? 0);
    const goalSec = Number(raw.goalReachedAt ?? raw.goal_reached_at ?? 0);
    const goalReachedAt =
      goalSec > 0 ? new Date(goalSec * 1000) : null;

    const mintPk = raw.mint as PublicKey;
    const mintStr =
      mintPk && typeof (mintPk as PublicKey).toBase58 === "function"
        ? (mintPk as PublicKey).toBase58()
        : String(raw.mint);

    const creatorPk = raw.creator as PublicKey;
    const creatorStr =
      creatorPk && typeof (creatorPk as PublicKey).toBase58 === "function"
        ? (creatorPk as PublicKey).toBase58()
        : String(raw.creator);

    const treasuryPk = raw.treasury as PublicKey;
    const treasuryStr =
      treasuryPk && typeof (treasuryPk as PublicKey).toBase58 === "function"
        ? (treasuryPk as PublicKey).toBase58()
        : String(raw.treasury ?? "");

    const poolPk = raw.pool as PublicKey;
    const poolStr =
      poolPk && typeof (poolPk as PublicKey).toBase58 === "function"
        ? (poolPk as PublicKey).toBase58()
        : String(raw.pool ?? "");

    const posNftPk = raw.positionNftMint ?? raw.position_nft_mint;
    const positionNftMintPk = posNftPk as PublicKey;
    const positionNftMintStr =
      positionNftMintPk &&
      typeof (positionNftMintPk as PublicKey).toBase58 === "function"
        ? (positionNftMintPk as PublicKey).toBase58()
        : String(posNftPk ?? "");

    const progressPercent =
      raiseTarget > 0n
        ? Math.min(100, Number((totalRaised * 100n) / raiseTarget))
        : 0;

    return {
      mint: mintStr,
      tokenName: String(raw.tokenName ?? raw.token_name ?? ""),
      tokenTicker: String(raw.tokenTicker ?? raw.token_ticker ?? ""),
      tokenUri: String(raw.tokenUri ?? raw.token_uri ?? ""),
      description: String(raw.description ?? ""),
      creator: creatorStr,
      treasury: treasuryStr,
      totalRaised,
      raiseTarget,
      totalSupply,
      lpTokensAmount,
      distributionAmount,
      tokensPerLamportX64,
      totalContributors: Number(
        raw.totalContributors ?? raw.total_contributors ?? 0
      ),
      endTime: new Date(endSec * 1000),
      startTime: new Date(startSec * 1000),
      launched: Boolean(raw.launched),
      refundEnabled: Boolean(raw.refundEnabled ?? raw.refund_enabled),
      goalReachedAt,
      pool: poolStr,
      positionNftMint: positionNftMintStr,
      maxContribution,
      feePoolPerShareX64,
      progressPercent,
    };
  } catch {
    return null;
  }
}
