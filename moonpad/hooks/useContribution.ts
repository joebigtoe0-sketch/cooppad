"use client";

import { BorshAccountsCoder, Idl } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";

import { MOONPAD_IDL, PROGRAM_ID } from "@/lib/anchor";
import { findContribution } from "@/lib/pda";
import type { ContributionOnChainState } from "@/types";

function decodeContribution(data: Buffer): ContributionOnChainState | null {
  try {
    const coder = new BorshAccountsCoder(MOONPAD_IDL as Idl);
    const raw = coder.decode("ContributionState", data) as Record<
      string,
      unknown
    >;

    const num = (v: unknown) =>
      typeof v === "bigint"
        ? v
        : typeof v === "number"
          ? BigInt(v)
          : BigInt(String(v));

    return {
      amountContributed: num(
        raw.amountContributed ?? raw.amount_contributed ?? 0
      ),
      claimed: Boolean(raw.claimed),
      refunded: Boolean(raw.refunded),
      earlyWithdrew: Boolean(raw.earlyWithdrew ?? raw.early_withdrew),
      feeDebtX64: num(raw.feeDebtX64 ?? raw.fee_debt_x64 ?? 0),
      feesCollected: num(raw.feesCollected ?? raw.fees_collected ?? 0),
    };
  } catch {
    return null;
  }
}

export function useContribution(mintAddress: string | null) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [state, setState] = useState<ContributionOnChainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mintAddress || !publicKey) {
      setState(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const mint = new PublicKey(mintAddress);
      const [pda] = findContribution(mint, publicKey);
      const acc = await connection.getAccountInfo(pda, "confirmed");

      if (!acc || !acc.owner.equals(PROGRAM_ID)) {
        setState({
          amountContributed: 0n,
          claimed: false,
          refunded: false,
          earlyWithdrew: false,
          feeDebtX64: 0n,
          feesCollected: 0n,
        });
        return;
      }

      const decoded = decodeContribution(acc.data);
      if (!decoded) {
        setError("Could not decode contribution account.");
        setState(null);
        return;
      }

      setState(decoded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contribution");
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [connection, mintAddress, publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, loading, error, refresh };
}
