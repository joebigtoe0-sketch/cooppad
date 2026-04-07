import type { Connection, Keypair, Transaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

export type SendSignedTransactionOptions = {
  additionalSigners?: Keypair[];
  /**
   * When true, does not fetch a new blockhash (keeps e.g. platform partial signatures
   * from `/api/presale/prepare-initialize`). `tx` must already have `recentBlockhash`.
   */
  preserveBlockhash?: boolean;
  /** Required for confirmation when `preserveBlockhash` is true */
  lastValidBlockHeight?: number;
};

export async function sendSignedTransaction(
  connection: Connection,
  wallet: WalletContextState,
  tx: Transaction,
  options?: SendSignedTransactionOptions
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  let blockhash: string;
  let lastValidBlockHeight: number;

  if (options?.preserveBlockhash) {
    if (!tx.recentBlockhash) {
      throw new Error("Transaction missing recentBlockhash");
    }
    blockhash = tx.recentBlockhash;
    if (options.lastValidBlockHeight === undefined) {
      throw new Error(
        "lastValidBlockHeight is required when preserveBlockhash is true"
      );
    }
    lastValidBlockHeight = options.lastValidBlockHeight;
  } else {
    const bh = await connection.getLatestBlockhash("confirmed");
    blockhash = bh.blockhash;
    lastValidBlockHeight = bh.lastValidBlockHeight;
    tx.recentBlockhash = blockhash;
  }

  tx.feePayer = wallet.publicKey;

  for (const kp of options?.additionalSigners ?? []) {
    tx.partialSign(kp);
  }

  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return sig;
}
