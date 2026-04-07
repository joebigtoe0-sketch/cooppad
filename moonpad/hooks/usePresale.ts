"use client";

import { BorshAccountsCoder, Idl } from "@coral-xyz/anchor";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";

import { MOONPAD_IDL, PROGRAM_ID } from "@/lib/anchor";
import { findPresaleState } from "@/lib/pda";
import type { PresaleOnChainState } from "@/types";

function decodePresale(data: Buffer): PresaleOnChainState | null {
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
    const feePoolPerShareX64 = num(
      raw.feePoolPerShareX64 ?? raw.fee_pool_per_share_x64
    );

    const endSec = Number(raw.endTime ?? raw.end_time ?? 0);
    const startSec = Number(raw.startTime ?? raw.start_time ?? 0);

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
      totalContributors: Number(
        raw.totalContributors ?? raw.total_contributors ?? 0
      ),
      endTime: new Date(endSec * 1000),
      startTime: new Date(startSec * 1000),
      launched: Boolean(raw.launched),
      refundEnabled: Boolean(raw.refundEnabled ?? raw.refund_enabled),
      maxContribution,
      feePoolPerShareX64,
      progressPercent,
    };
  } catch {
    return null;
  }
}

export function usePresale(mintAddress: string | null) {
  const { connection } = useConnection();
  const [state, setState] = useState<PresaleOnChainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mintAddress) {
      setState(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const mint = new PublicKey(mintAddress);
      const [presalePda] = findPresaleState(mint);
      const acc = await connection.getAccountInfo(presalePda, "confirmed");

      if (!acc || !acc.owner.equals(PROGRAM_ID)) {
        setState(null);
        setError("Presale not found for this mint.");
        return;
      }

      const decoded = decodePresale(acc.data);
      if (!decoded) {
        setError("Could not decode presale account (IDL may be out of sync).");
        setState(null);
        return;
      }

      setState(decoded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load presale");
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [connection, mintAddress]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { state, loading, error, refresh };
}
