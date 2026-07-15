"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { AnalyticsJson } from "@/types/curve";

const PERIODS = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "all", label: "All" },
] as const;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
      <p className="text-[10px] font-bold uppercase tracking-wider text-coop-wood/60 dark:text-coop-shell/50">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold text-coop-ink dark:text-coop-shell">
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-[11px] text-coop-wood/60 dark:text-coop-shell/45">{sub}</p>
      ) : null}
    </div>
  );
}

function Bars({
  buckets,
  pick,
}: {
  buckets: AnalyticsJson["buckets"];
  pick: (b: AnalyticsJson["buckets"][number]) => number;
}) {
  const max = Math.max(1e-9, ...buckets.map(pick));
  return (
    <div className="flex h-36 items-end gap-[2px]">
      {buckets.map((b) => {
        const h = Math.max(pick(b) > 0 ? 3 : 1, (pick(b) / max) * 100);
        return (
          <div
            key={b.day}
            title={`${b.day}: ${pick(b).toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
            className="flex-1 rounded-t-sm bg-gradient-to-t from-coop-yolk to-coop-orange"
            style={{ height: `${h}%`, opacity: pick(b) > 0 ? 1 : 0.25 }}
          />
        );
      })}
    </div>
  );
}

export function AnalyticsClient() {
  const { fmt } = useCurrency();
  const [period, setPeriod] = useState<AnalyticsJson["period"]>("30d");
  const [data, setData] = useState<AnalyticsJson | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/curve/analytics?period=${period}`, { cache: "no-store" });
      const j = (await res.json()) as { ok: boolean; analytics?: AnalyticsJson };
      if (j.ok && j.analytics) setData(j.analytics);
    } catch {
      /* transient */
    }
  }, [period]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const first = data?.buckets[0]?.day ?? "";
  const last = data?.buckets[data.buckets.length - 1]?.day ?? "";

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-coop-ink dark:text-coop-shell">
            Protocol analytics
          </h1>
          <p className="mt-1 text-sm text-coop-wood/75 dark:text-coop-shell/60">
            Launches and trading activity across every Coop market on Robinhood Chain.
          </p>
        </div>
        <div className="flex rounded-xl border border-coop-straw/40 p-1 dark:border-coop-700">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                period === p.key
                  ? "bg-coop-yolk/30 text-coop-ink dark:bg-coop-yolk/20 dark:text-coop-shell"
                  : "text-coop-wood/60 dark:text-coop-shell/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-coop-surface-warm/40 dark:bg-coop-800/40" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile
              label={`${data.period} launches`}
              value={data.launches.toLocaleString("en-US")}
              sub={`${data.launchesAllTime.toLocaleString("en-US")} all-time`}
            />
            <Tile
              label={`${data.period} volume`}
              value={fmt(data.volumeEth)}
              sub={`${data.volumeEth.toLocaleString("en-US", { maximumFractionDigits: 2 })} ETH`}
            />
            <Tile
              label={`${data.period} trades`}
              value={data.trades.toLocaleString("en-US")}
              sub={`${data.buys.toLocaleString("en-US")} buys, ${data.sells.toLocaleString("en-US")} sells`}
            />
            <Tile
              label={`${data.period} protocol revenue`}
              value={fmt(data.protocolRevenueEth)}
              sub="platform half of collected pool fees"
            />
            <Tile
              label={`${data.period} creator revenue`}
              value={fmt(data.creatorRevenueEth)}
              sub="creator half of collected pool fees"
            />
            <Tile
              label="Graduated"
              value={data.graduatedAllTime.toLocaleString("en-US")}
              sub="all-time total"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
              <div className="flex items-baseline justify-between">
                <p className="font-display text-sm font-extrabold text-coop-ink dark:text-coop-shell">
                  Trading volume
                </p>
                <p className="font-mono text-sm font-bold text-coop-ink dark:text-coop-shell">
                  {fmt(data.volumeEth)}
                </p>
              </div>
              <p className="mb-3 text-[11px] text-coop-wood/60 dark:text-coop-shell/45">
                ETH volume valued at the current ETH price.
              </p>
              <Bars buckets={data.buckets} pick={(b) => b.volumeEth} />
              <div className="mt-1 flex justify-between text-[10px] text-coop-wood/50 dark:text-coop-shell/40">
                <span>{first}</span>
                <span>{last}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
              <div className="flex items-baseline justify-between">
                <p className="font-display text-sm font-extrabold text-coop-ink dark:text-coop-shell">
                  Token launches
                </p>
                <p className="font-mono text-sm font-bold text-coop-ink dark:text-coop-shell">
                  {data.launches.toLocaleString("en-US")}
                </p>
              </div>
              <p className="mb-3 text-[11px] text-coop-wood/60 dark:text-coop-shell/45">
                New Coop markets indexed in the selected period.
              </p>
              <Bars buckets={data.buckets} pick={(b) => b.launches} />
              <div className="mt-1 flex justify-between text-[10px] text-coop-wood/50 dark:text-coop-shell/40">
                <span>{first}</span>
                <span>{last}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
            <p className="font-display text-sm font-extrabold text-coop-ink dark:text-coop-shell">
              Top tokens
            </p>
            <p className="text-[11px] text-coop-wood/60 dark:text-coop-shell/45">
              Ranked by all-time ETH volume.
            </p>
            <div className="mt-3 space-y-1.5">
              {data.topTokens.length === 0 ? (
                <p className="py-6 text-center text-sm text-coop-wood/60 dark:text-coop-shell/50">
                  No tokens yet — be the first to{" "}
                  <Link href="/launch" className="font-semibold underline hover:text-coop-orange">
                    launch one
                  </Link>
                  .
                </p>
              ) : (
                data.topTokens.map((t, i) => (
                  <Link
                    key={t.address}
                    href={`/coin/${t.address}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-coop-surface-warm/50 dark:hover:bg-coop-800/40"
                  >
                    <span className="w-5 text-center font-mono text-xs text-coop-wood/50 dark:text-coop-shell/40">
                      {i + 1}
                    </span>
                    {t.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ipfsToHttp(t.imageUrl)}
                        alt=""
                        className="h-8 w-8 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-coop-yolk/20 text-[10px] font-extrabold text-coop-wood dark:text-coop-yolk-soft">
                        {t.symbol.slice(0, 3)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-coop-ink dark:text-coop-shell">
                        {t.name}
                      </span>
                      <span className="block font-mono text-[10px] text-coop-wood/60 dark:text-coop-shell/50">
                        {t.symbol} · {t.tradeCount.toLocaleString("en-US")} trades
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-sm font-bold text-coop-ink dark:text-coop-shell">
                        {fmt(t.volumeEth)}
                      </span>
                      <span className="block font-mono text-[10px] text-coop-wood/60 dark:text-coop-shell/50">
                        {t.volumeEth.toLocaleString("en-US", { maximumFractionDigits: 2 })} ETH
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <p className="text-[11px] leading-snug text-coop-wood/50 dark:text-coop-shell/40">
            Figures are estimates based on indexed onchain activity and third-party
            pricing. They may be delayed, incomplete, or inaccurate. For informational
            purposes only — not financial, tax, or legal advice.
          </p>
        </>
      )}
    </div>
  );
}
