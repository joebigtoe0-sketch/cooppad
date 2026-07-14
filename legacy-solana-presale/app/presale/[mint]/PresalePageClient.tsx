"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useMemo, useState } from "react";

import { BuyWidget } from "@/components/BuyWidget";
import { PresaleAvatar } from "@/components/PresaleAvatar";
import { ProgressBar } from "@/components/ProgressBar";
import { TransactionToast, type ToastKind } from "@/components/TransactionToast";
import { getMoonpadProgram, getProvider } from "@/lib/anchor";
import {
  buildClaimRefundTx,
  buildClaimTokensTx,
  buildCollectMyFeesTx,
  buildEnableRefundTx,
  buildLaunchPresaleTx,
  buildWithdrawContributionTx,
} from "@/lib/instructions";
import { canLaunchPresaleNow, launchUnlockAt } from "@/lib/presaleLaunch";
import { LEGACY_ONCHAIN_RAISE_TARGET_LAMPORTS } from "@/lib/presaleConstants";
import {
  formatPresaleTokenHuman,
  formatTokensWithTicker,
  humanTokenBillionsWhole,
  rawTokensForNetLamports,
} from "@/lib/presaleTokens";
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
  const launchAt =
    state &&
    !state.launched &&
    !state.refundEnabled &&
    state.totalRaised >= state.raiseTarget
      ? launchUnlockAt(state)
      : null;
  const hatchCountdown = useCountdown(launchAt);

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

  type FinishLiquidityResponse = {
    ok?: boolean;
    status?: string;
    messages?: string[];
    poolAddress?: string;
    error?: string;
  };

  function liquidityStepSucceeded(data: FinishLiquidityResponse): boolean {
    if (data.status === "ok") return true;
    if (data.status === "skipped" && data.poolAddress) return true;
    return false;
  }

  async function runFinishLiquidityFromServer(): Promise<FinishLiquidityResponse> {
    const res = await fetch("/api/presale/finish-liquidity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mint }),
    });
    const data = (await res.json()) as FinishLiquidityResponse;
    if (!res.ok) {
      throw new Error(data.error ?? `Pool step HTTP ${res.status}`);
    }
    return data;
  }

  async function launchHatch() {
    if (!wallet.publicKey || !wallet.signTransaction) {
      showToast("Connect wallet", "error");
      return;
    }
    try {
      const program = getMoonpadProgram(getProvider(wallet, connection));
      const m = new PublicKey(mint);
      if (!state?.treasury) {
        throw new Error("Treasury not loaded");
      }
      const tx = await buildLaunchPresaleTx(
        program,
        wallet.publicKey,
        m,
        new PublicKey(state.treasury)
      );
      showToast("Confirm hatch in wallet…", "info");
      await sendSignedTransaction(connection, wallet, tx);
      showToast("Hatch confirmed — creating Meteora pool (server)…", "info");
      const liq = await runFinishLiquidityFromServer();
      if (!liquidityStepSucceeded(liq)) {
        throw new Error(
          (liq.messages ?? []).join("\n") || "DEX pool step did not complete"
        );
      }
      showToast("Meteora pool live — you can claim tokens.", "success");
      await refresh();
      await refreshMy();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Hatch failed", "error");
    }
  }

  async function retryPoolSetup() {
    try {
      showToast("Retrying Meteora pool setup…", "info");
      const liq = await runFinishLiquidityFromServer();
      if (!liquidityStepSucceeded(liq)) {
        throw new Error(
          (liq.messages ?? []).join("\n") || "Pool setup did not complete"
        );
      }
      showToast("Meteora pool ready.", "success");
      await refresh();
      await refreshMy();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Pool retry failed", "error");
    }
  }

  async function withdraw() {
    const program = getMoonpadProgram(getProvider(wallet, connection));
    const m = new PublicKey(mint);
    if (!state?.treasury) {
      throw new Error("Egg treasury not loaded");
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

  const positionQuotedRaw = useMemo(() => {
    if (!state || !my || my.amountContributed <= 0n) return 0n;
    return rawTokensForNetLamports(my.amountContributed, {
      tokensPerLamportX64: state.tokensPerLamportX64,
      distributionAmount: state.distributionAmount,
      raiseTarget: state.raiseTarget,
    });
  }, [state, my]);

  if (loading && !state) {
    return (
      <p className="text-coop-wood/75">Loading egg…</p>
    );
  }

  if (error || !state) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-red-800">{error ?? "Not found"}</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-coop-sky">
          ← Chicken coop
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
    state.totalRaised < state.raiseTarget &&
    my &&
    my.amountContributed > 0n;

  const showHatchCta =
    !state.launched &&
    !state.refundEnabled &&
    state.totalRaised >= state.raiseTarget;

  const hatchReady =
    showHatchCta &&
    state.goalReachedAt &&
    canLaunchPresaleNow(state, new Date());

  const poolLive =
    Boolean(state.pool) && state.pool !== PublicKey.default.toBase58();

  const showClaimTokens =
    state.launched &&
    poolLive &&
    my &&
    my.amountContributed > 0n &&
    !my.claimed;

  const showPoolRetry =
    state.launched && !poolLive && !state.refundEnabled;

  const showEnableRefund =
    !state.launched &&
    !state.refundEnabled &&
    countdown.ended &&
    state.totalRaised < state.raiseTarget;

  const showClaimRefund =
    state.refundEnabled && my && my.amountContributed > 0n && !my.refunded;

  const showCollectFees =
    state.launched && my && my.amountContributed > 0n;

  const statusLabel = state.launched
    ? "Hatched"
    : state.refundEnabled
      ? "Refunds open"
      : state.listingStatus === "launching"
        ? "Hatching soon"
        : "Hatching";

  const supplyBillionsWhole = humanTokenBillionsWhole(state.totalSupply);

  const solscanCluster = connection.rpcEndpoint.includes("devnet")
    ? "devnet"
    : "mainnet-beta";

  const defaultPk = PublicKey.default.toBase58();
  const positionNftRegistered =
    Boolean(state.positionNftMint) && state.positionNftMint !== defaultPk;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/"
          className="text-sm text-coop-wood/80 hover:text-coop-ink"
        >
          ← Chicken coop
        </Link>
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
          <PresaleAvatar mint={mint} name={state.tokenName} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-extrabold text-coop-ink dark:text-coop-shell">
              {state.tokenName}{" "}
              <span className="text-coop-wood/70 dark:text-coop-shell/60">
                (${state.tokenTicker})
              </span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-coop-wood/85 dark:text-coop-shell/70">
              {state.description}
            </p>
            <p className="mt-2 font-mono text-xs text-coop-wood/55 dark:text-coop-shell/45">
              {mint}
            </p>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-coop-wood/85">
          <span className="font-semibold text-coop-ink">Supply</span>{" "}
          {formatPresaleTokenHuman(state.totalSupply)} tokens
          {supplyBillionsWhole > 0n
            ? ` (≈${supplyBillionsWhole.toString()}B)`
            : ""}{" "}
          with 6 on-chain decimals. Half (
          {formatPresaleTokenHuman(state.lpTokensAmount)}) is reserved for
          liquidity (Meteora); half (
          {formatPresaleTokenHuman(state.distributionAmount)}) is for this
          presale.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-coop-straw/35 bg-coop-surface p-4 shadow-sm shadow-coop-ink/5">
          <ProgressBar
            percent={state.progressPercent}
            label="Raise to hatch"
          />
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-coop-wood/80">Raised</dt>
            <dd className="font-mono text-coop-ink">
              {(Number(state.totalRaised) / 1e9).toFixed(4)} SOL
            </dd>
            <dt className="text-coop-wood/80">Target</dt>
            <dd className="font-mono text-coop-ink">
              {(Number(state.raiseTarget) / 1e9).toFixed(2)} SOL
            </dd>
            <dt className="text-coop-wood/80">Chickens</dt>
            <dd className="text-coop-ink">{state.totalContributors}</dd>
            <dt className="text-coop-wood/80">Sale ends</dt>
            <dd className="font-medium text-coop-sky">{countdown.label}</dd>
            {state.listingStatus === "launching" ? (
              <>
                <dt className="text-coop-wood/80">Hatch unlock</dt>
                <dd className="font-medium text-amber-800 dark:text-amber-200">
                  {state.goalReachedAt ? hatchCountdown.label : "—"}
                </dd>
              </>
            ) : null}
            <dt className="text-coop-wood/80">Status</dt>
            <dd className="text-coop-ink">{statusLabel}</dd>
          </dl>
          {state.raiseTarget === LEGACY_ONCHAIN_RAISE_TARGET_LAMPORTS ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-950">
              On-chain target is still{" "}
              <span className="font-mono">85 SOL</span> because this egg was
              created before the program change. The repo constant is now{" "}
              <span className="font-mono">0.85 SOL</span> for dev — upgrade the
              deployed program and lay a new egg to use it.
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          {showHatchCta ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40">
              <h3 className="font-semibold text-amber-950 dark:text-amber-100">
                Raise filled — hatch queue
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-amber-950/85 dark:text-amber-100/80">
                Withdrawals are closed. <span className="font-mono">Hatch now</span>{" "}
                runs <span className="font-mono">launch_presale</span> from your
                wallet, then the app server creates the Meteora pool and
                registers it (needs <span className="font-mono">PLATFORM_AUTHORITY_SECRET</span>{" "}
                and a funded sale treasury). Until the pool is on-chain, token
                claims stay disabled.
              </p>
              {!state.goalReachedAt ? (
                <p className="mt-3 text-xs font-medium text-red-800 dark:text-red-200">
                  This egg predates on-chain goal timestamps — hatch cannot run.
                  Lay a new egg with the current program.
                </p>
              ) : hatchReady ? (
                <button
                  type="button"
                  disabled={!wallet.publicKey}
                  onClick={() => void launchHatch()}
                  className="mt-4 w-full rounded-lg bg-gradient-to-r from-amber-500 to-coop-orange py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-40"
                >
                  Hatch now
                </button>
              ) : (
                <p className="mt-3 text-xs text-amber-900/90 dark:text-amber-100/75">
                  Hatch unlocks in{" "}
                  <span className="font-mono font-semibold">
                    {hatchCountdown.label}
                  </span>
                  .
                </p>
              )}
            </div>
          ) : null}

          {canBuy ? (
            state.treasury ? (
              <BuyWidget
                mintAddress={mint}
                treasuryPubkey={state.treasury}
                raiseTargetLamports={state.raiseTarget}
                totalRaisedLamports={state.totalRaised}
                maxContributionLamports={state.maxContribution}
                myContributedLamports={my?.amountContributed ?? 0n}
                tokenTicker={state.tokenTicker}
                distributionAmountRaw={state.distributionAmount}
                tokensPerLamportX64={state.tokensPerLamportX64}
                onSuccess={() => {
                  void refresh();
                  void refreshMy();
                }}
              />
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                Egg data is missing the treasury field. Deploy the updated
                program and sync the IDL so joins can target the
                per-sale treasury.
              </p>
            )
          ) : (
            <p className="rounded-xl border border-coop-straw/30 bg-coop-surface-warm/60 p-4 text-sm text-coop-wood/90">
              This egg is closed for new joins (ended, hatched, or refunds).
            </p>
          )}

          {wallet.publicKey ? (
            <div className="rounded-xl border border-coop-straw/35 bg-coop-surface p-4 text-sm shadow-sm shadow-coop-ink/5">
              <h3 className="font-semibold text-coop-ink">Your position</h3>
              <p className="mt-2 text-coop-wood/85">
                Sat with:{" "}
                <span className="font-mono text-coop-ink">
                  {my
                    ? (Number(my.amountContributed) / 1e9).toFixed(4)
                    : "0"}{" "}
                  SOL
                </span>
                {positionQuotedRaw > 0n ? (
                  <>
                    {" "}
                    (
                    <span className="font-mono text-coop-ink">
                      {formatTokensWithTicker(
                        positionQuotedRaw,
                        state.tokenTicker
                      )}
                    </span>
                    {state.tokensPerLamportX64 === 0n ? (
                      <span className="text-coop-wood/65">
                        {" "}
                        est. if raise hits target
                      </span>
                    ) : null}
                    )
                  </>
                ) : null}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {showWithdraw ? (
                  <button
                    type="button"
                    onClick={() => void busyAct("Fly the coop", withdraw)}
                    className="rounded-lg bg-coop-wood px-3 py-2 text-xs font-medium text-white hover:opacity-90"
                  >
                    Fly the coop
                  </button>
                ) : null}
                {showClaimTokens ? (
                  <button
                    type="button"
                    onClick={() => void busyAct("Claim tokens", claimTok)}
                    className="rounded-lg bg-coop-grass px-3 py-2 text-xs font-medium text-white hover:opacity-90"
                  >
                    Claim tokens
                  </button>
                ) : null}
                {showEnableRefund ? (
                  <button
                    type="button"
                    onClick={() => void busyAct("Enable refunds", enableRef)}
                    className="rounded-lg bg-coop-orange px-3 py-2 text-xs font-medium text-white hover:opacity-90"
                  >
                    Enable refunds
                  </button>
                ) : null}
                {showClaimRefund ? (
                  <button
                    type="button"
                    onClick={() => void busyAct("Claim refund", claimRef)}
                    className="rounded-lg bg-coop-orange/90 px-3 py-2 text-xs font-medium text-white hover:opacity-90"
                  >
                    Claim refund
                  </button>
                ) : null}
                {showCollectFees ? (
                  <button
                    type="button"
                    onClick={() =>
                      void busyAct("Collect your yolk", collectFees)
                    }
                    className="rounded-lg bg-coop-sky px-3 py-2 text-xs font-medium text-white hover:opacity-90"
                  >
                    Collect your yolk
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {showPoolRetry ? (
            <div className="rounded-xl border border-amber-300/80 bg-amber-50/90 p-4 text-xs text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
              <p className="font-semibold">DEX pool not registered yet</p>
              <p className="mt-2 leading-relaxed opacity-90">
                Token claims stay blocked on-chain until the Meteora pool is
                created and linked. The sale treasury needs enough devnet SOL
                for pool rent and the LP leg (fund the treasury pubkey from your
                egg record if this keeps failing).
              </p>
              <button
                type="button"
                onClick={() => void retryPoolSetup()}
                className="mt-3 w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Retry Meteora pool setup
              </button>
            </div>
          ) : null}

          <div className="rounded-xl border border-dashed border-coop-straw/40 bg-coop-surface-warm/40 p-4 text-xs text-coop-wood/80">
            <p className="font-semibold text-coop-ink">Meteora DAMM v2 (CP-AMM)</p>
            {poolLive && state.pool ? (
              <div className="mt-1 space-y-2 leading-relaxed">
                <p>
                  Pool:{" "}
                  <a
                    href={`https://solscan.io/account/${state.pool}?cluster=${solscanCluster}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-coop-sky underline"
                  >
                    {state.pool.slice(0, 8)}…{state.pool.slice(-6)}
                  </a>{" "}
                  on Solscan (source of truth).
                </p>
                {positionNftRegistered ? (
                  <p>
                    Position NFT mint:{" "}
                    <a
                      href={`https://solscan.io/account/${state.positionNftMint}?cluster=${solscanCluster}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-coop-sky underline"
                    >
                      {state.positionNftMint.slice(0, 8)}…
                      {state.positionNftMint.slice(-6)}
                    </a>
                  </p>
                ) : null}
                <p>
                  Pool <span className="font-mono">creator</span> / fee payer
                  (matches successful pool tx on Solscan):{" "}
                  <a
                    href={`https://solscan.io/account/${state.treasury}?cluster=${solscanCluster}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-coop-sky underline"
                  >
                    {state.treasury.slice(0, 8)}…{state.treasury.slice(-6)}
                  </a>
                </p>
                <p className="text-coop-wood/70">
                  <span className="font-medium text-coop-ink">Why Meteora’s site may hide it:</span>{" "}
                  <a
                    href="https://devnet.meteora.ag/?tab=new"
                    target="_blank"
                    rel="noreferrer"
                    className="text-coop-sky underline"
                  >
                    devnet.meteora.ag
                  </a>{" "}
                  “New” and portfolio views are backed by Meteora’s own indexing; pools created only
                  via SDK (like this flow) are often still missing there even when the chain
                  transaction succeeded. Your wallet also will not necessarily show a normal NFT for
                  this LP position — DAMM v2 tracks liquidity in program accounts; use the{" "}
                  <span className="font-mono">treasury</span> pubkey above if a product keys off{" "}
                  <span className="font-mono">creator</span>.
                </p>
              </div>
            ) : (
              <p className="mt-1">
                After hatch, this app calls the server to sweep LP liquidity and
                open a customizable pool (WSOL + token), then register it
                on-chain. Claim tokens unlocks only after that succeeds.
              </p>
            )}
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
