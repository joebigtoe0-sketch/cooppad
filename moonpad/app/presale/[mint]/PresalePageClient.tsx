"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useState } from "react";

import { BuyWidget } from "@/components/BuyWidget";
import { ProgressBar } from "@/components/ProgressBar";
import { TransactionToast, type ToastKind } from "@/components/TransactionToast";
import { getMoonpadProgram, getProvider } from "@/lib/anchor";
import {
  buildClaimRefundTx,
  buildClaimTokensTx,
  buildCollectMyFeesTx,
  buildEnableRefundTx,
  buildWithdrawContributionTx,
} from "@/lib/instructions";
import { sendSignedTransaction } from "@/lib/sendTransaction";
import { useContribution } from "@/hooks/useContribution";
import { useCountdown } from "@/hooks/useCountdown";
import { usePresale } from "@/hooks/usePresale";

export function PresalePageClient({ mint }: { mint: string }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { state, loading, error, refresh } = usePresale(mint);
  const { state: my, refresh: refreshMy } = useContribution(mint);
  const countdown = useCountdown(state?.endTime ?? null);

  const [toast, setToast] = useState<{
    msg: string;
    kind: ToastKind;
    show: boolean;
  }>({ msg: "", kind: "info", show: false });

  const showToast = (msg: string, kind: ToastKind) => {
    setToast({ msg, kind, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 5000);
  };

  const busyAct = async (label: string, fn: () => Promise<void>) => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      showToast("Connect wallet", "error");
      return;
    }
    try {
      await fn();
      showToast(`${label} confirmed`, "success");
      await refresh();
      await refreshMy();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : `${label} failed`,
        "error"
      );
    }
  };

  async function withdraw() {
    const program = getMoonpadProgram(getProvider(wallet, connection));
    const m = new PublicKey(mint);
    if (!state?.treasury) {
      throw new Error("Presale treasury not loaded");
    }
    const tx = await buildWithdrawContributionTx(
      program,
      wallet.publicKey!,
      m,
      new PublicKey(state.treasury)
    );
    await sendSignedTransaction(connection, wallet, tx);
  }

  async function claimTok() {
    const program = getMoonpadProgram(getProvider(wallet, connection));
    const m = new PublicKey(mint);
    const tx = await buildClaimTokensTx(program, wallet.publicKey!, m);
    await sendSignedTransaction(connection, wallet, tx);
  }

  async function enableRef() {
    const program = getMoonpadProgram(getProvider(wallet, connection));
    const m = new PublicKey(mint);
    const tx = await buildEnableRefundTx(program, wallet.publicKey!, m);
    await sendSignedTransaction(connection, wallet, tx);
  }

  async function claimRef() {
    const program = getMoonpadProgram(getProvider(wallet, connection));
    const m = new PublicKey(mint);
    const tx = await buildClaimRefundTx(program, wallet.publicKey!, m);
    await sendSignedTransaction(connection, wallet, tx);
  }

  async function collectFees() {
    const program = getMoonpadProgram(getProvider(wallet, connection));
    const m = new PublicKey(mint);
    const tx = await buildCollectMyFeesTx(program, wallet.publicKey!, m);
    await sendSignedTransaction(connection, wallet, tx);
  }

  if (loading && !state) {
    return (
      <p className="text-zinc-500">Loading presale…</p>
    );
  }

  if (error || !state) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6">
        <p className="text-red-300">{error ?? "Not found"}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-violet-400">
          ← Home
        </Link>
      </div>
    );
  }

  const canBuy =
    !state.launched &&
    !state.refundEnabled &&
    !countdown.ended &&
    state.totalRaised < state.raiseTarget;

  const showWithdraw =
    !state.launched &&
    !state.refundEnabled &&
    !countdown.ended &&
    my &&
    my.amountContributed > 0n;

  const showClaimTokens =
    state.launched && my && my.amountContributed > 0n && !my.claimed;

  const showEnableRefund =
    !state.launched &&
    !state.refundEnabled &&
    countdown.ended &&
    state.totalRaised < state.raiseTarget;

  const showClaimRefund =
    state.refundEnabled && my && my.amountContributed > 0n && !my.refunded;

  const showCollectFees =
    state.launched && my && my.amountContributed > 0n;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Home
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-white">
          {state.tokenName}{" "}
          <span className="text-zinc-500">(${state.tokenTicker})</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          {state.description}
        </p>
        <p className="mt-2 font-mono text-xs text-zinc-600">{mint}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-moon-900/40 p-4">
          <ProgressBar
            percent={state.progressPercent}
            label="Raise progress"
          />
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-zinc-500">Raised</dt>
            <dd className="font-mono text-white">
              {(Number(state.totalRaised) / 1e9).toFixed(4)} SOL
            </dd>
            <dt className="text-zinc-500">Target</dt>
            <dd className="font-mono text-white">
              {(Number(state.raiseTarget) / 1e9).toFixed(2)} SOL
            </dd>
            <dt className="text-zinc-500">Contributors</dt>
            <dd className="text-white">{state.totalContributors}</dd>
            <dt className="text-zinc-500">Timer</dt>
            <dd className="text-violet-300">{countdown.label}</dd>
            <dt className="text-zinc-500">Status</dt>
            <dd className="text-white">
              {state.launched
                ? "Launched"
                : state.refundEnabled
                  ? "Refunds open"
                  : "Active"}
            </dd>
          </dl>
        </div>

        <div className="space-y-4">
          {canBuy ? (
            state.treasury ? (
              <BuyWidget
                mintAddress={mint}
                treasuryPubkey={state.treasury}
                onSuccess={() => {
                  void refresh();
                  void refreshMy();
                }}
              />
            ) : (
              <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-200/90">
                Presale data is missing the treasury field. Deploy the updated
                program and sync the IDL so contributions can target the
                per-sale treasury.
              </p>
            )
          ) : (
            <p className="rounded-xl border border-zinc-800 bg-moon-900/20 p-4 text-sm text-zinc-500">
              Contributions are closed for this presale (ended, launched, or
              refunds).
            </p>
          )}

          {wallet.publicKey ? (
            <div className="rounded-xl border border-zinc-800 bg-moon-900/40 p-4 text-sm">
              <h3 className="font-medium text-white">Your position</h3>
              <p className="mt-2 text-zinc-400">
                Contributed:{" "}
                <span className="font-mono text-white">
                  {my
                    ? (Number(my.amountContributed) / 1e9).toFixed(4)
                    : "0"}{" "}
                  SOL
                </span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {showWithdraw ? (
                  <button
                    type="button"
                    onClick={() => void busyAct("Withdraw", withdraw)}
                    className="rounded-lg bg-zinc-700 px-3 py-2 text-xs text-white hover:bg-zinc-600"
                  >
                    Early withdraw
                  </button>
                ) : null}
                {showClaimTokens ? (
                  <button
                    type="button"
                    onClick={() => void busyAct("Claim tokens", claimTok)}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-xs text-white hover:bg-emerald-600"
                  >
                    Claim tokens
                  </button>
                ) : null}
                {showEnableRefund ? (
                  <button
                    type="button"
                    onClick={() => void busyAct("Enable refunds", enableRef)}
                    className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white hover:bg-amber-600"
                  >
                    Enable refunds
                  </button>
                ) : null}
                {showClaimRefund ? (
                  <button
                    type="button"
                    onClick={() => void busyAct("Claim refund", claimRef)}
                    className="rounded-lg bg-amber-600 px-3 py-2 text-xs text-white hover:bg-amber-500"
                  >
                    Claim refund
                  </button>
                ) : null}
                {showCollectFees ? (
                  <button
                    type="button"
                    onClick={() => void busyAct("Collect fees", collectFees)}
                    className="rounded-lg bg-violet-800 px-3 py-2 text-xs text-white hover:bg-violet-700"
                  >
                    Collect my fees
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-dashed border-zinc-700 p-4 text-xs text-zinc-500">
            <p className="font-medium text-zinc-400">Meteora launch (soon)</p>
            <p className="mt-1">
              Pool creation and <code>claim_pool_fees</code> CPI are not wired
              on-chain yet — buttons omitted until the program is upgraded.
            </p>
          </div>
        </div>
      </div>

      <TransactionToast
        message={toast.msg}
        kind={toast.kind}
        visible={toast.show}
      />
    </div>
  );
}
