"use client";

import Link from "next/link";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { CurveTokenJson } from "@/types/curve";

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function CurveTokenCard({ token }: { token: CurveTokenJson }) {
  const { fmt } = useCurrency();
  const graduated = token.phase === "graduated";
  const pct = Math.round(token.progress * 100);

  return (
    <Link
      href={`/coin/${token.address}`}
      className="group flex flex-col rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-coop-yolk/70 hover:shadow-md dark:border-coop-700 dark:bg-coop-900/60"
    >
      <div className="flex items-start gap-3">
        {token.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ipfsToHttp(token.imageUrl)}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-coop-yolk/20 font-display text-lg font-extrabold text-coop-wood dark:text-coop-yolk-soft">
            {token.symbol.slice(0, 3) || "?"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-sm font-extrabold text-coop-ink dark:text-coop-shell">
              {token.name || "Unnamed token"}
            </p>
            <span className="shrink-0 rounded bg-coop-surface-warm px-1.5 py-0.5 font-mono text-[10px] font-bold text-coop-wood dark:bg-coop-800 dark:text-coop-shell/80">
              {token.symbol}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-coop-wood/70 dark:text-coop-shell/55">
            {token.description || "No description yet."}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-coop-wood/70 dark:text-coop-shell/55">
        <span className="font-semibold text-coop-ink dark:text-coop-shell">
          {fmt(token.marketCapEth)} mcap
        </span>
        {token.tradeCount > 0 ? (
          <span
            className={`font-bold ${
              token.change24h >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400"
            }`}
          >
            {token.change24h >= 0 ? "+" : ""}
            {(token.change24h * 100).toFixed(1)}%
          </span>
        ) : null}
        <span>·</span>
        <span>{fmt(token.volumeEth)} vol</span>
        <span className="ml-auto">{timeAgo(token.createdAt)}</span>
      </div>

      <div className="mt-2">
        {graduated ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            🎓 Graduated to Uniswap
          </span>
        ) : (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-coop-surface-warm dark:bg-coop-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-coop-yolk to-coop-orange transition-all"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-coop-wood/60 dark:text-coop-shell/45">
              <span>bonding curve {pct}%</span>
              <span>{token.raisedEth.toFixed(2)} / 3.5 ETH</span>
            </div>
          </>
        )}
      </div>

      {token.flavor === "lpGrow" ? (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-coop-sky/10 px-2 py-0.5 text-[10px] font-bold text-coop-sky dark:bg-coop-sky/20">
          🌱 LP-Growing — pool fees deepen locked liquidity
        </span>
      ) : null}
    </Link>
  );
}
