"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import { FlavorBadge } from "@/components/curve/FlavorBadge";
import { coopLaunchpadV2Abi } from "@/lib/evm/abi/coopLaunchpadV2";
import { coopLockerV2Abi } from "@/lib/evm/abi/coopLockerV2";
import { launchpadAddress } from "@/lib/evm/chains";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { CurveTokenJson } from "@/types/curve";

type Holding = { token: CurveTokenJson; balance: string; valueEth: number };

function TokenBadge({ token }: { token: CurveTokenJson }) {
  return (
    <Link href={`/coin/${token.address}`} className="flex min-w-0 items-center gap-2.5">
      {token.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ipfsToHttp(token.imageUrl)}
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-coop-yolk/20 text-[11px] font-extrabold text-coop-wood dark:text-coop-yolk-soft">
          {token.symbol.slice(0, 3)}
        </span>
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="block truncate text-sm font-bold text-coop-ink hover:text-coop-orange dark:text-coop-shell">
            {token.name}
          </span>
          <FlavorBadge flavor={token.flavor} />
        </span>
        <span className="block font-mono text-[10px] text-coop-wood/60 dark:text-coop-shell/50">
          {token.symbol} · {token.phase === "graduated" ? "graduated" : `climbing ${Math.round(token.progress * 100)}%`}
        </span>
      </span>
    </Link>
  );
}

export function PortfolioClient() {
  const { address: account, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { fmt } = useCurrency();

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [created, setCreated] = useState<CurveTokenJson[]>([]);
  const [loading, setLoading] = useState(true);

  const launchpad = launchpadAddress();

  const load = useCallback(async () => {
    if (!account) return;
    try {
      const res = await fetch(`/api/curve/portfolio/${account.toLowerCase()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { holdings?: Holding[]; created?: CurveTokenJson[] };
      setHoldings(data.holdings ?? []);
      setCreated(data.created ?? []);
    } catch {
      /* transient */
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    setLoading(true);
    void load();
    const id = setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  // The locked v3 position's pool fees are collected via the locker and pushed
  // straight to the creator + platform wallets — nothing sits claimable.
  const { data: lockerAddr } = useReadContract({
    abi: coopLaunchpadV2Abi,
    address: launchpad,
    functionName: "locker",
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (confirmed) void load();
  }, [confirmed, load]);

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-dashed border-coop-straw/50 bg-coop-surface-warm/30 px-6 py-16 text-center dark:border-coop-700 dark:bg-coop-800/30">
        <p className="text-4xl" aria-hidden>
          ▤
        </p>
        <p className="mt-3 font-display text-lg font-extrabold text-coop-ink dark:text-coop-shell">
          Connect a wallet to see your portfolio
        </p>
        <p className="mt-1 text-sm text-coop-wood/70 dark:text-coop-shell/60">
          Holdings, tokens you created, and claimable fees all live here.
        </p>
        <button
          type="button"
          onClick={() => openConnectModal?.()}
          className="mt-5 rounded-xl bg-coop-ink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-coop-orange dark:bg-coop-yolk dark:text-coop-950"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  const totalValue = holdings.reduce((s, h) => s + h.valueEth, 0);

  return (
    <div className="space-y-6 pb-8">
      {/* summary row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-coop-wood/60 dark:text-coop-shell/50">
            Holdings value
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-coop-ink dark:text-coop-shell">
            {fmt(totalValue)}
          </p>
        </div>
        <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-coop-wood/60 dark:text-coop-shell/50">
            Tokens held / created
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-coop-ink dark:text-coop-shell">
            {holdings.length} / {created.length}
          </p>
        </div>
        <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-coop-wood/60 dark:text-coop-shell/50">
            Creator fees
          </p>
          <p className="mt-1 text-xs leading-snug text-coop-wood/75 dark:text-coop-shell/60">
            Pool fees pay straight to your wallet whenever anyone hits{" "}
            <span className="font-bold">Collect</span> on your tokens below.
          </p>
        </div>
      </div>

      {/* holdings */}
      <section>
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-coop-wood/80 dark:text-coop-shell/70">
          Holdings
        </h2>
        {loading && holdings.length === 0 ? (
          <div className="mt-3 h-24 animate-pulse rounded-2xl bg-coop-surface-warm/40 dark:bg-coop-800/40" />
        ) : holdings.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-coop-straw/50 bg-coop-surface-warm/30 px-5 py-8 text-center text-sm text-coop-wood/70 dark:border-coop-700 dark:bg-coop-800/30 dark:text-coop-shell/60">
            No tokens yet —{" "}
            <Link href="/" className="font-semibold underline hover:text-coop-orange">
              browse the launchpad
            </Link>{" "}
            to find one.
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-coop-straw/40 bg-coop-surface dark:border-coop-700 dark:bg-coop-900/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-coop-straw/30 text-[10px] uppercase tracking-wider text-coop-wood/50 dark:border-coop-800 dark:text-coop-shell/40">
                  <th className="px-4 py-2.5 font-semibold">Token</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Mcap</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr
                    key={h.token.address}
                    className="border-b border-coop-straw/20 last:border-0 dark:border-coop-800"
                  >
                    <td className="px-4 py-2.5">
                      <TokenBadge token={h.token} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {fmt(h.token.marketCapEth)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {(Number(h.balance) / 1e18).toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-bold">
                      {fmt(h.valueEth)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* created tokens */}
      <section>
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-coop-wood/80 dark:text-coop-shell/70">
          Created by you
        </h2>
        {created.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-coop-straw/50 bg-coop-surface-warm/30 px-5 py-8 text-center text-sm text-coop-wood/70 dark:border-coop-700 dark:bg-coop-800/30 dark:text-coop-shell/60">
            Nothing launched yet —{" "}
            <Link href="/launch" className="font-semibold underline hover:text-coop-orange">
              launch your first token
            </Link>
            . You earn half of your token&apos;s 1% Uniswap fee stream from the very
            first trade — forever.
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-coop-straw/40 bg-coop-surface dark:border-coop-700 dark:bg-coop-900/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-coop-straw/30 text-[10px] uppercase tracking-wider text-coop-wood/50 dark:border-coop-800 dark:text-coop-shell/40">
                  <th className="px-4 py-2.5 font-semibold">Token</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Mcap</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Swap fees</th>
                </tr>
              </thead>
              <tbody>
                {created.map((t) => {
                  return (
                    <tr
                      key={t.address}
                      className="border-b border-coop-straw/20 last:border-0 dark:border-coop-800"
                    >
                      <td className="px-4 py-2.5">
                        <TokenBadge token={t} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {fmt(t.marketCapEth)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={isPending || !lockerAddr}
                          onClick={() =>
                            lockerAddr &&
                            writeContract({
                              abi: coopLockerV2Abi,
                              address: lockerAddr,
                              functionName: "collect",
                              args: [t.address as `0x${string}`],
                            })
                          }
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Collect pool fees
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
