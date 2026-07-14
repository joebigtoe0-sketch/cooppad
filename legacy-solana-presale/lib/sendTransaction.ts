import type { Connection, Keypair, Transaction } from "@solana/web3.js";
import { SendTransactionError } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

function signatureBase58ForFeePayer(tx: Transaction): string | undefined {
  const fp = tx.feePayer;
  if (!fp) return undefined;
  const entry = tx.signatures.find((s) => s.publicKey.equals(fp));
  const buf = entry?.signature;
  if (!buf) return undefined;
  return bs58.encode(buf);
}

function isAlreadyProcessedError(e: unknown): boolean {
  const msg =
    e instanceof SendTransactionError
      ? e.transactionError.message
      : e instanceof Error
        ? e.message
        : String(e);
  return msg.includes("already been processed");
}

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

  let sig: string;
  try {
    sig = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 0,
    });
  } catch (e: unknown) {
    if (isAlreadyProcessedError(e)) {
      const recovered = signatureBase58ForFeePayer(signed);
      if (!recovered) throw e;
      sig = recovered;
    } else {
      if (e instanceof SendTransactionError) {
        const logs = await e.getLogs(connection).catch(() => [] as string[]);
        if (logs.length) {
          throw new Error(
            `${e.message}\n--- simulation logs (tail) ---\n${logs.slice(-50).join("\n")}`
          );
        }
      }
      throw e;
    }
  }

  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return sig;
}
