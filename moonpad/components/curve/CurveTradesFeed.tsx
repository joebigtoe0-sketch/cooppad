"use client";

import { useCallback, useEffect, useState } from "react";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import { activeChain } from "@/lib/evm/chains";
import type { CurveTradeJson } from "@/types/curve";

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function CurveTradesFeed({
  address,
  symbol,
}: {
  address: string;
  symbol: string;
}) {
  const [trades, setTrades] = useState<CurveTradeJson[]>([]);
  const { fmt } = useCurrency();
  const explorer = activeChain().blockExplorers?.default.url ?? "";

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/curve/tokens/${address}/trades?limit=40`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { trades?: CurveTradeJson[] };
      setTrades(data.trades ?? []);
    } catch {
      /* transient */
    }
  }, [address]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 5_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
      <h3 className="text-xs font-bold uppercase tracking-wider text-coop-wood/70 dark:text-coop-shell/60">
        Recent trades
      </h3>
      {trades.length === 0 ? (
        <p className="py-6 text-center text-sm text-coop-wood/60 dark:text-coop-shell/50">
          No trades yet.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-coop-wood/50 dark:text-coop-shell/40">
                <th className="py-1.5 pr-3 font-semibold">Trader</th>
                <th className="py-1.5 pr-3 font-semibold">Side</th>
                <th className="py-1.5 pr-3 font-semibold">Value</th>
                <th className="py-1.5 pr-3 font-semibold">{symbol}</th>
                <th className="py-1.5 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr
                  key={`${t.txHash}-${t.logIndex}`}
                  className="border-t border-coop-straw/20 dark:border-coop-800"
                >
                  <td className="py-1.5 pr-3 font-mono">
                    <a
                      href={explorer ? `${explorer}/tx/${t.txHash}` : "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-coop-orange hover:underline"
                    >
                      {short(t.trader)}
                    </a>
                  </td>
                  <td
                    className={`py-1.5 pr-3 font-bold ${
                      t.isBuy
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-500 dark:text-red-400"
                    }`}
                  >
                    {t.isBuy ? "buy" : "sell"}
                  </td>
                  <td className="py-1.5 pr-3 font-mono">
                    {fmt(Number(t.ethWei) / 1e18)}
                  </td>
                  <td className="py-1.5 pr-3 font-mono">
                    {(Number(t.tokenAmount) / 1e18).toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="py-1.5 text-coop-wood/60 dark:text-coop-shell/50">
                    {timeAgo(t.ts)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
