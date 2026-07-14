import { Connection, PublicKey, Commitment } from "@solana/web3.js";
import { AnchorProvider, type Idl, Program } from "@coral-xyz/anchor";
import type { WalletContextState } from "@solana/wallet-adapter-react";

import moonpadIdl from "@/public/idl/moonpad.json";

export const MOONPAD_IDL = moonpadIdl as unknown as Idl;

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ??
    "8XvnK9bVHYXqkbwfaRiEFzxyPbKNEZTY1yJzm5JGrctJ"
);

/** Must match `PLATFORM_AUTHORITY_PUBKEY` in `programs/moonpad/src/constants.rs` after deploy. */
export const PLATFORM_AUTHORITY = new PublicKey(
  process.env.NEXT_PUBLIC_PLATFORM_AUTHORITY ??
    "11111111111111111111111111111111"
);

/** Meteora DAMM v2 (cp-amm) — used when launch CPI is wired on-chain */
export const DAMM_V2_PROGRAM = new PublicKey(
  "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG"
);

export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

/** Metaplex Token Metadata program — must match on-chain `TOKEN_METADATA_PROGRAM`. */
export const TOKEN_METADATA_PROGRAM = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export function getConnection(commitment: Commitment = "confirmed") {
  const url =
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
  return new Connection(url, commitment);
}

export function getProvider(
  wallet: WalletContextState,
  connection: Connection
): AnchorProvider {
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error("Wallet not connected");
  }
  return new AnchorProvider(connection, wallet as never, {
    commitment: "confirmed",
  });
}

export function getMoonpadProgram(provider: AnchorProvider): Program {
  return new Program(MOONPAD_IDL as Idl, provider);
}
