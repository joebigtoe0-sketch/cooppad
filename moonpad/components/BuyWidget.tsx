"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useState } from "react";

import { getMoonpadProgram, getProvider } from "@/lib/anchor";
import { buildContributeTx } from "@/lib/instructions";
import { sendSignedTransaction } from "@/lib/sendTransaction";

import { TransactionToast, type ToastKind } from "./TransactionToast";

const LAMPORTS_PER_SOL = 1_000_000_000n;

function parseSolToLamports(s: string): bigint {
  const t = s.trim();
  if (!t) return 0n;
  const [whole, frac = ""] = t.split(".");
  const fracPadded = (frac + "000000000").slice(0, 9);
  return BigInt(whole || "0") * LAMPORTS_PER_SOL + BigInt(fracPadded || "0");
}

export function BuyWidget({
  mintAddress,
  treasuryPubkey,
  disabled,
  onSuccess,
}: {
  mintAddress: string;
  /** Per-presale treasury from on-chain presale state */
  treasuryPubkey: string;
  disabled?: boolean;
  onSuccess?: () => void;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [sol, setSol] = useState("0.1");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    kind: ToastKind;
    show: boolean;
  }>({ msg: "", kind: "info", show: false });

  const showToast = (msg: string, kind: ToastKind) => {
    setToast({ msg, kind, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 5000);
  };

  async function onContribute() {
    if (!wallet.publicKey || !wallet.signTransaction) {
      showToast("Connect your wallet first.", "error");
      return;
    }
    const lamports = parseSolToLamports(sol);
    if (lamports <= 0n) {
      showToast("Enter a valid SOL amount.", "error");
      return;
    }

    setBusy(true);
    try {
      const provider = getProvider(wallet, connection);
      const program = getMoonpadProgram(provider);
      const mint = new PublicKey(mintAddress);
      const tx = await buildContributeTx(
        program,
        wallet.publicKey,
        mint,
        lamports,
        new PublicKey(treasuryPubkey)
      );
      const sig = await sendSignedTransaction(connection, wallet, tx);
      showToast(`Contributed! Signature: ${sig.slice(0, 20)}…`, "success");
      onSuccess?.();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Transaction failed",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  const platformNote = "A 1% platform fee is deducted from your contribution.";

  return (
    <div className="rounded-xl border border-zinc-800 bg-moon-900/40 p-4">
      <h3 className="text-sm font-medium text-white">Contribute</h3>
      <p className="mt-1 text-xs text-zinc-500">{platformNote}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={sol}
          onChange={(e) => setSol(e.target.value)}
          disabled={disabled || busy}
          className="flex-1 rounded-lg border border-zinc-700 bg-moon-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-violet-500"
          placeholder="SOL"
        />
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void onContribute()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          {busy ? "…" : "Buy"}
        </button>
      </div>
      <TransactionToast
        message={toast.msg}
        kind={toast.kind}
        visible={toast.show}
      />
    </div>
  );
}
