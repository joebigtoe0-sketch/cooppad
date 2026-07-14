import type { Wallet } from "@coral-xyz/anchor/dist/cjs/provider.js";
import {
  Keypair,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

/**
 * Anchor's package root export omits `Wallet` in browser builds; Next/Turbopack can hit that path
 * for App Router routes. Use this instead of `new Wallet(keypair)` on the server.
 */
export function walletFromKeypair(keypair: Keypair): Wallet {
  const signTransaction: Wallet["signTransaction"] = async (tx) => {
    if (tx instanceof VersionedTransaction) {
      tx.sign([keypair]);
      return tx;
    }
    (tx as Transaction).partialSign(keypair);
    return tx;
  };
  return {
    publicKey: keypair.publicKey,
    signTransaction,
    signAllTransactions: async (txs) =>
      Promise.all(txs.map((t) => signTransaction(t))),
  };
}
