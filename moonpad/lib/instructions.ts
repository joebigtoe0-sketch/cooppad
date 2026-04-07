import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { BN, Program, type Idl } from "@coral-xyz/anchor";

import { DAMM_V2_PROGRAM, PLATFORM_AUTHORITY } from "./anchor";
import {
  findContribution,
  findFeeVault,
  findPresaleState,
  findTokenVault,
  findVault,
} from "./pda";
import { utf8PadFixed } from "./presaleEncoding";

const RENT = new PublicKey("SysvarRent111111111111111111111111111111111");

export type MoonpadProgram = Program<Idl>;

export interface InitPresaleParams {
  tokenName: string;
  tokenTicker: string;
  tokenUri: string;
  description: string;
  durationSeconds: number;
  maxContribution: bigint;
  twitter: string;
  telegram: string;
  website: string;
}

export type InitializePresaleAccounts = {
  treasury: PublicKey;
  /** Defaults to `PLATFORM_AUTHORITY` from env when omitted (must match on-chain constant). */
  platformAuthority?: PublicKey;
};

export async function buildInitializePresaleTx(
  program: MoonpadProgram,
  creator: PublicKey,
  mint: PublicKey,
  params: InitPresaleParams,
  accounts: InitializePresaleAccounts
): Promise<Transaction> {
  const [presaleState] = findPresaleState(mint);
  const [tokenVault] = findTokenVault(mint);
  const [vault] = findVault(mint);
  const [feeVault] = findFeeVault(mint);
  const platformAuthority =
    accounts.platformAuthority ?? PLATFORM_AUTHORITY;

  return await program.methods
    .initializePresale({
      tokenName: utf8PadFixed(params.tokenName, 32),
      tokenTicker: utf8PadFixed(params.tokenTicker, 10),
      tokenUri: utf8PadFixed(params.tokenUri, 200),
      description: utf8PadFixed(params.description, 256),
      durationSeconds: new BN(params.durationSeconds.toString()),
      maxContribution: new BN(params.maxContribution.toString()),
      twitter: utf8PadFixed(params.twitter, 100),
      telegram: utf8PadFixed(params.telegram, 100),
      website: utf8PadFixed(params.website, 100),
    })
    .accounts({
      creator,
      platformAuthority,
      presaleState,
      mint,
      tokenVault,
      vault,
      feeVault,
      treasury: accounts.treasury,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: RENT,
    })
    .transaction();
}

export async function buildContributeTx(
  program: MoonpadProgram,
  contributor: PublicKey,
  mint: PublicKey,
  amountLamports: bigint,
  treasury: PublicKey
): Promise<Transaction> {
  const [presaleState] = findPresaleState(mint);
  const [vault] = findVault(mint);
  const [contributionState] = findContribution(mint, contributor);

  return await program.methods
    .contribute(new BN(amountLamports.toString()))
    .accounts({
      contributor,
      mint,
      presaleState,
      vault,
      contributionState,
      treasury,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildWithdrawContributionTx(
  program: MoonpadProgram,
  contributor: PublicKey,
  mint: PublicKey,
  treasury: PublicKey
): Promise<Transaction> {
  const [presaleState] = findPresaleState(mint);
  const [vault] = findVault(mint);
  const [contributionState] = findContribution(mint, contributor);

  return await program.methods
    .withdrawContribution()
    .accounts({
      contributor,
      mint,
      presaleState,
      vault,
      contributionState,
      treasury,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildClaimTokensTx(
  program: MoonpadProgram,
  contributor: PublicKey,
  mint: PublicKey
): Promise<Transaction> {
  const [presaleState] = findPresaleState(mint);
  const [tokenVault] = findTokenVault(mint);
  const [contributionState] = findContribution(mint, contributor);
  const contributorTokenAccount = getAssociatedTokenAddressSync(
    mint,
    contributor
  );

  return await program.methods
    .claimTokens()
    .accounts({
      contributor,
      mint,
      presaleState,
      tokenVault,
      contributionState,
      contributorTokenAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .transaction();
}

export async function buildEnableRefundTx(
  program: MoonpadProgram,
  caller: PublicKey,
  mint: PublicKey
): Promise<Transaction> {
  const [presaleState] = findPresaleState(mint);

  return await program.methods
    .enableRefund()
    .accounts({
      caller,
      mint,
      presaleState,
    })
    .transaction();
}

export async function buildClaimRefundTx(
  program: MoonpadProgram,
  contributor: PublicKey,
  mint: PublicKey
): Promise<Transaction> {
  const [presaleState] = findPresaleState(mint);
  const [vault] = findVault(mint);
  const [contributionState] = findContribution(mint, contributor);

  return await program.methods
    .claimRefund()
    .accounts({
      contributor,
      mint,
      presaleState,
      vault,
      contributionState,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildCollectMyFeesTx(
  program: MoonpadProgram,
  contributor: PublicKey,
  mint: PublicKey
): Promise<Transaction> {
  const [presaleState] = findPresaleState(mint);
  const [feeVault] = findFeeVault(mint);
  const [contributionState] = findContribution(mint, contributor);

  return await program.methods
    .collectMyFees()
    .accounts({
      contributor,
      mint,
      presaleState,
      feeVault,
      contributionState,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

/** On-chain CPI not implemented yet — tx will fail until program is upgraded. */
export async function buildLaunchPresaleTx(
  program: MoonpadProgram,
  caller: PublicKey,
  mint: PublicKey
): Promise<Transaction> {
  const [presaleState] = findPresaleState(mint);
  const [vault] = findVault(mint);
  const [tokenVault] = findTokenVault(mint);

  return await program.methods
    .launchPresale()
    .accounts({
      caller,
      mint,
      presaleState,
      vault,
      tokenVault,
      dammV2Program: DAMM_V2_PROGRAM,
    })
    .transaction();
}

/** On-chain CPI not implemented yet — tx will fail until program is upgraded. */
export async function buildClaimPoolFeesTx(
  program: MoonpadProgram,
  caller: PublicKey
): Promise<Transaction> {
  return await program.methods
    .claimPoolFees()
    .accounts({
      caller,
      dammV2Program: DAMM_V2_PROGRAM,
    })
    .transaction();
}
