"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { CurveTradeJson } from "@/types/curve";

type Stats = { live: number; graduated: number; volume24hEth: number };

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function CoopRightRail() {
  const [trades, setTrades] = useState<CurveTradeJson[]>([]);
  const [stats, setStats] = useState<Stats>({ live: 0, graduated: 0, volume24hEth: 0 });
  const [loading, setLoading] = useState(true);
  const { fmt } = useCurrency();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/curve/trades?limit=12", { cache: "no-store" });
      const data = (await res.json()) as { trades?: CurveTradeJson[]; stats?: Stats };
      setTrades(data.trades ?? []);
      if (data.stats) setStats(data.stats);
    } catch {
      /* keep last values */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 5_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <aside className="hidden w-72 shrink-0 border-l border-coop-straw/25 bg-coop-surface/40 px-4 py-6 dark:border-coop-700 dark:bg-coop-900/30 xl:block">
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-coop-wood/80 dark:text-coop-shell/70">
        Coop stats
      </h2>
      <dl className="mt-4 space-y-3 rounded-xl border border-coop-straw/30 bg-coop-surface p-4 text-sm dark:border-coop-700 dark:bg-coop-900/50">
        <div className="flex justify-between gap-2">
          <dt className="text-coop-wood/75 dark:text-coop-shell/65">Live tokens</dt>
          <dd className="font-semibold text-coop-ink dark:text-coop-shell">
            {loading ? "…" : stats.live}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-coop-wood/75 dark:text-coop-shell/65">Graduated</dt>
          <dd className="font-semibold text-coop-ink dark:text-coop-shell">
            {loading ? "…" : stats.graduated}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-coop-wood/75 dark:text-coop-shell/65">24h volume</dt>
          <dd className="font-semibold text-coop-ink dark:text-coop-shell">
            {loading ? "…" : fmt(stats.volume24hEth)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-coop-wood/75 dark:text-coop-shell/65">Chain</dt>
          <dd className="font-semibold text-coop-sky dark:text-coop-yolk-soft">
            Robinhood
          </dd>
        </div>
      </dl>

      <h2 className="mt-8 font-display text-sm font-bold uppercase tracking-wide text-coop-wood/80 dark:text-coop-shell/70">
        Live trades
      </h2>
      {trades.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-coop-straw/40 bg-coop-surface-warm/30 px-3 py-6 text-center text-xs leading-relaxed text-coop-wood/70 dark:border-coop-700 dark:bg-coop-800/40 dark:text-coop-shell/55">
          <p className="text-2xl" aria-hidden>
            🐣
          </p>
          <p className="mt-2">Buys and sells will stream here the moment tokens start trading.</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {trades.map((t) => (
            <li key={`${t.txHash}-${t.logIndex}`}>
              <Link
                href={`/coin/${t.token}`}
                className="flex items-center gap-2 rounded-lg border border-coop-straw/25 bg-coop-surface px-2.5 py-1.5 text-xs transition hover:border-coop-yolk/60 dark:border-coop-700 dark:bg-coop-900/50"
              >
                {t.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ipfsToHttp(t.imageUrl)}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-coop-yolk/25 text-[9px] font-bold text-coop-wood dark:text-coop-yolk-soft">
                    {(t.tokenSymbol ?? "?").slice(0, 2)}
                  </span>
                )}
                <span
                  className={`font-bold ${
                    t.isBuy
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-500 dark:text-red-400"
                  }`}
                >
                  {t.isBuy ? "BUY" : "SELL"}
                </span>
                <span className="truncate font-semibold text-coop-ink dark:text-coop-shell">
                  {t.tokenSymbol ?? "?"}
                </span>
                <span className="ml-auto whitespace-nowrap font-mono text-coop-wood/75 dark:text-coop-shell/60">
                  {fmt(Number(t.ethWei) / 1e18)}
                </span>
                <span className="whitespace-nowrap text-coop-wood/50 dark:text-coop-shell/40">
                  {timeAgo(t.ts)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
