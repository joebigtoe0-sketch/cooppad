import { PublicKey } from "@solana/web3.js";

import { PROGRAM_ID, TOKEN_METADATA_PROGRAM } from "./anchor";

export function findPresaleState(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("presale"), mint.toBuffer()],
    PROGRAM_ID
  );
}

export function findVault(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), mint.toBuffer()],
    PROGRAM_ID
  );
}

export function findTokenVault(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("token_vault"), mint.toBuffer()],
    PROGRAM_ID
  );
}

export function findFeeVault(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("fee_vault"), mint.toBuffer()],
    PROGRAM_ID
  );
}

export function findContribution(
  mint: PublicKey,
  contributor: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("contribution"), mint.toBuffer(), contributor.toBuffer()],
    PROGRAM_ID
  );
}

/** Metaplex metadata PDA for `mint` (seeds: `metadata`, program id, mint). */
export function findMetadataPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM
  );
}
