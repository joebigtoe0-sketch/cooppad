"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useMemo, useState } from "react";

import { getMoonpadProgram, getProvider } from "@/lib/anchor";
import { buildContributeTx } from "@/lib/instructions";
import {
  computeMaxNetContributeLamports,
  lamportsToSolInputString,
  LAMPORTS_PER_SOL,
  platformFeeOnTopFromNet,
  PLATFORM_MIN_CONTRIBUTION_LAMPORTS,
} from "@/lib/presaleConstants";
import {
  formatTokensWithTicker,
  rawTokensForNetLamports,
} from "@/lib/presaleTokens";
import { sendSignedTransaction } from "@/lib/sendTransaction";

import { TransactionToast, type ToastKind } from "./TransactionToast";

function parseSolToLamports(s: string): bigint {
  const t = s.trim();
  if (!t) return 0n;
  const [whole, frac = ""] = t.split(".");
  const fracPadded = (frac + "000000000").slice(0, 9);
  return BigInt(whole || "0") * LAMPORTS_PER_SOL + BigInt(fracPadded || "0");
}

function lamportsToSolDisplay(lamports: bigint, fractionDigits = 4): string {
  const n = Number(lamports) / Number(LAMPORTS_PER_SOL);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

const quickBtn =
  "rounded-lg border border-coop-straw/50 bg-white px-2.5 py-1.5 text-xs font-medium text-coop-ink shadow-sm hover:border-coop-sky hover:bg-coop-surface-warm disabled:cursor-not-allowed disabled:opacity-40";

export function BuyWidget({
  mintAddress,
  treasuryPubkey,
  raiseTargetLamports,
  totalRaisedLamports,
  maxContributionLamports,
  myContributedLamports,
  tokenTicker,
  distributionAmountRaw,
  tokensPerLamportX64,
  disabled,
  onSuccess,
}: {
  mintAddress: string;
  /** Per-presale treasury from on-chain presale state */
  treasuryPubkey: string;
  raiseTargetLamports: bigint;
  totalRaisedLamports: bigint;
  maxContributionLamports: bigint;
  myContributedLamports: bigint;
  tokenTicker: string;
  distributionAmountRaw: bigint;
  tokensPerLamportX64: bigint;
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

  const maxNetLamports = useMemo(
    () =>
      computeMaxNetContributeLamports({
        raiseTarget: raiseTargetLamports,
        totalRaised: totalRaisedLamports,
        maxContribution: maxContributionLamports,
        currentContributed: myContributedLamports,
      }),
    [
      raiseTargetLamports,
      totalRaisedLamports,
      maxContributionLamports,
      myContributedLamports,
    ]
  );

  const netLamports = useMemo(() => parseSolToLamports(sol), [sol]);
  const { feeLamports, grossLamports } = useMemo(
    () =>
      netLamports > 0n
        ? platformFeeOnTopFromNet(netLamports)
        : { feeLamports: 0n, grossLamports: 0n },
    [netLamports]
  );

  const tokenQuoteParams = useMemo(
    () => ({
      tokensPerLamportX64,
      distributionAmount: distributionAmountRaw,
      raiseTarget: raiseTargetLamports,
    }),
    [tokensPerLamportX64, distributionAmountRaw, raiseTargetLamports]
  );

  const quotedTokensRaw = useMemo(
    () => rawTokensForNetLamports(netLamports, tokenQuoteParams),
    [netLamports, tokenQuoteParams]
  );

  const quoteUsesFixedRate = tokensPerLamportX64 > 0n;

  function applyNetLamports(wantNet: bigint, label: string) {
    if (maxNetLamports <= 0n) {
      showToast("Nothing left to contribute (raise full or you hit your cap).", "error");
      return;
    }
    const net = wantNet > maxNetLamports ? maxNetLamports : wantNet;
    if (net < PLATFORM_MIN_CONTRIBUTION_LAMPORTS) {
      showToast(
        `Only ${lamportsToSolDisplay(net)} SOL left — below the 0.01 SOL minimum.`,
        "error"
      );
      return;
    }
    setSol(lamportsToSolInputString(net));
    if (net < wantNet) {
      showToast(`Capped to ${lamportsToSolDisplay(net)} SOL (${label}).`, "info");
    }
  }

  async function onJoin() {
    if (!wallet.publicKey || !wallet.signTransaction) {
      showToast("Connect your wallet first.", "error");
      return;
    }
    const lamports = parseSolToLamports(sol);
    if (lamports <= 0n) {
      showToast("Enter a valid SOL amount.", "error");
      return;
    }
    if (lamports < PLATFORM_MIN_CONTRIBUTION_LAMPORTS) {
      showToast("Minimum contribution is 0.01 SOL (credited to your position).", "error");
      return;
    }
    if (lamports > maxNetLamports) {
      showToast(
        `At most ${lamportsToSolDisplay(maxNetLamports)} SOL can be credited right now (raise target or per-wallet max).`,
        "error"
      );
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
      showToast(`Joined this egg! Signature: ${sig.slice(0, 20)}…`, "success");
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

  return (
    <div className="rounded-xl border border-coop-straw/35 bg-coop-surface p-4 shadow-sm shadow-coop-ink/5">
      <h3 className="text-sm font-semibold text-coop-ink">Join this egg</h3>
      <p className="mt-1 text-xs text-coop-wood/80">
        The SOL you enter is credited to your position. A 1% platform fee is
        added on top, so your wallet total is a bit higher (e.g. 2 SOL → about{" "}
        {lamportsToSolDisplay(
          platformFeeOnTopFromNet(2n * LAMPORTS_PER_SOL).grossLamports
        )}{" "}
        SOL).
      </p>
      {netLamports > 0n ? (
        <>
          <p className="mt-1 font-mono text-[11px] text-coop-wood/90">
            Position +{lamportsToSolDisplay(netLamports)} SOL · Fee +
            {lamportsToSolDisplay(feeLamports)} SOL · ≈{" "}
            {lamportsToSolDisplay(grossLamports)} SOL from wallet
          </p>
          {quotedTokensRaw > 0n ? (
            <p className="mt-1 text-[11px] text-coop-wood/90">
              ≈{" "}
              <span className="font-mono font-medium text-coop-ink">
                {formatTokensWithTicker(quotedTokensRaw, tokenTicker)}
              </span>
              {quoteUsesFixedRate ? null : (
                <span className="text-coop-wood/65">
                  {" "}
                  (est. if raise hits target)
                </span>
              )}
            </p>
          ) : null}
        </>
      ) : null}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={sol}
          onChange={(e) => setSol(e.target.value)}
          disabled={disabled || busy}
          className="flex-1 rounded-lg border border-coop-straw/50 bg-white px-3 py-2 font-mono text-sm text-coop-ink shadow-sm outline-none placeholder:text-coop-wood/40 focus:border-coop-sky"
          placeholder="SOL"
        />
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void onJoin()}
          className="rounded-lg bg-coop-yolk px-4 py-2 text-sm font-semibold text-coop-ink shadow-sm hover:bg-coop-orange hover:text-white disabled:opacity-40"
        >
          {busy ? "…" : "Join"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={quickBtn}
          disabled={disabled || busy}
          onClick={() => applyNetLamports(LAMPORTS_PER_SOL / 2n, "raise / wallet cap")}
        >
          0.5 SOL
        </button>
        <button
          type="button"
          className={quickBtn}
          disabled={disabled || busy}
          onClick={() => applyNetLamports(LAMPORTS_PER_SOL, "raise / wallet cap")}
        >
          1 SOL
        </button>
        <button
          type="button"
          className={quickBtn}
          disabled={disabled || busy || maxNetLamports <= 0n}
          onClick={() => applyNetLamports(maxNetLamports, "MAX")}
        >
          MAX
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
