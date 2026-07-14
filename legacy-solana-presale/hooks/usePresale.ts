"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";

import { PROGRAM_ID } from "@/lib/anchor";
import { decodePresaleAccount } from "@/lib/decodePresaleAccount";
import { computeListingStatus } from "@/lib/presaleListing";
import type { PresaleOnChainState } from "@/types";

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
      const presalePda = PublicKey.findProgramAddressSync(
        [Buffer.from("presale"), mint.toBuffer()],
        PROGRAM_ID
      )[0];
      const acc = await connection.getAccountInfo(presalePda, "confirmed");

      if (!acc || !acc.owner.equals(PROGRAM_ID)) {
        setState(null);
        setError("Presale not found for this mint.");
        return;
      }

      const decoded = decodePresaleAccount(Buffer.from(acc.data));
      if (!decoded) {
        setError("Could not decode presale account (IDL may be out of sync).");
        setState(null);
        return;
      }

      setState({
        ...decoded,
        listingStatus: computeListingStatus(decoded, new Date()),
      });
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
