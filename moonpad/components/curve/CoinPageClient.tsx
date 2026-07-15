"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CreatorRewards } from "@/components/curve/CreatorRewards";
import { CurveChart } from "@/components/curve/CurveChart";
import { FlavorBadge } from "@/components/curve/FlavorBadge";
import { CurveHolders } from "@/components/curve/CurveHolders";
import { CurveTradesFeed } from "@/components/curve/CurveTradesFeed";
import { CurveTradeWidget } from "@/components/curve/CurveTradeWidget";
import { useCurrency } from "@/components/curve/CurrencyProvider";
import { activeChain } from "@/lib/evm/chains";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { CurveHolderJson, CurveTokenJson } from "@/types/curve";

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function CoinPageClient({ address }: { address: string }) {
  const [token, setToken] = useState<CurveTokenJson | null>(null);
  const [holders, setHolders] = useState<CurveHolderJson[]>([]);
  const [notFound, setNotFound] = useState(false);
  // Fresh launches take a few seconds to hit the indexer — show a hatching
  // screen instead of "not found" while within the grace window.
  const [graceOver, setGraceOver] = useState(false);
  const { fmt } = useCurrency();
  const explorer = activeChain().blockExplorers?.default.url ?? "";

  useEffect(() => {
    const id = setTimeout(() => setGraceOver(true), 60_000);
    return () => clearTimeout(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/curve/tokens/${address}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = (await res.json()) as {
        token?: CurveTokenJson | null;
        holders?: CurveHolderJson[];
      };
      if (data.token) {
        setToken(data.token);
        setHolders(data.holders ?? []);
        setNotFound(false);
      }
    } catch {
      /* transient */
    }
  }, [address]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 6_000);
    return () => clearInterval(id);
  }, [load]);

  if (notFound && !graceOver) {
    return (
      <div className="rounded-2xl border border-dashed border-coop-straw/50 bg-coop-surface-warm/30 px-6 py-16 text-center dark:border-coop-700 dark:bg-coop-800/30">
        <p className="animate-bounce text-4xl" aria-hidden>
          🥚
        </p>
        <p className="mt-3 font-display text-lg font-extrabold text-coop-ink dark:text-coop-shell">
          Hatching…
        </p>
        <p className="mt-1 text-sm text-coop-wood/70 dark:text-coop-shell/60">
          The token is on-chain — the indexer is catching up. This page will load
          itself in a few seconds.
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="rounded-2xl border border-dashed border-coop-straw/50 bg-coop-surface-warm/30 px-6 py-16 text-center dark:border-coop-700 dark:bg-coop-800/30">
        <p className="text-4xl" aria-hidden>
          🐔
        </p>
        <p className="mt-3 font-display text-lg font-extrabold text-coop-ink dark:text-coop-shell">
          Token not found
        </p>
        <p className="mt-1 text-sm text-coop-wood/70 dark:text-coop-shell/60">
          This token doesn&apos;t exist, or the indexer hasn&apos;t seen it yet.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-xl bg-coop-ink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-coop-orange dark:bg-coop-yolk dark:text-coop-950"
        >
          Back to The Coop
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="h-[420px] animate-pulse rounded-2xl bg-coop-surface-warm/40 dark:bg-coop-800/40" />
        <div className="h-[420px] animate-pulse rounded-2xl bg-coop-surface-warm/40 dark:bg-coop-800/40" />
      </div>
    );
  }

  const pct = Math.round(token.progress * 100);

  return (
    <div className="space-y-4 pb-8">
      {/* header */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
        {token.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ipfsToHttp(token.imageUrl)}
            alt=""
            className="h-16 w-16 rounded-2xl object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-coop-yolk/20 font-display text-xl font-extrabold text-coop-wood dark:text-coop-yolk-soft">
            {token.symbol.slice(0, 3) || "?"}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold text-coop-ink dark:text-coop-shell">
              {token.name}
            </h1>
            <span className="rounded bg-coop-surface-warm px-2 py-0.5 font-mono text-xs font-bold text-coop-wood dark:bg-coop-800 dark:text-coop-shell/80">
              {token.symbol}
            </span>
            <FlavorBadge flavor={token.flavor} />
          </div>
          <p className="mt-1 text-xs text-coop-wood/70 dark:text-coop-shell/55">
            created by{" "}
            <a
              href={explorer ? `${explorer}/address/${token.creator}` : "#"}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:text-coop-orange hover:underline"
            >
              {short(token.creator)}
            </a>{" "}
            ·{" "}
            <a
              href={explorer ? `${explorer}/token/${token.address}` : "#"}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:text-coop-orange hover:underline"
            >
              {short(token.address)}
            </a>
          </p>
          {token.description ? (
            <p className="mt-1 max-w-xl text-xs leading-snug text-coop-wood/75 dark:text-coop-shell/60">
              {token.description}
            </p>
          ) : null}
          <div className="mt-1 flex gap-3 text-xs">
            {token.website ? (
              <a href={token.website} target="_blank" rel="noreferrer" className="text-coop-sky hover:underline">
                website
              </a>
            ) : null}
            {token.twitter ? (
              <a href={token.twitter} target="_blank" rel="noreferrer" className="text-coop-sky hover:underline">
                𝕏
              </a>
            ) : null}
            {token.telegram ? (
              <a href={token.telegram} target="_blank" rel="noreferrer" className="text-coop-sky hover:underline">
                telegram
              </a>
            ) : null}
          </div>
        </div>
        <div className="ml-auto grid grid-cols-2 gap-x-6 gap-y-1 text-right">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-coop-wood/55 dark:text-coop-shell/45">
              Market cap
            </p>
            <p className="font-mono text-sm font-bold text-coop-ink dark:text-coop-shell">
              {fmt(token.marketCapEth)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-coop-wood/55 dark:text-coop-shell/45">
              Volume
            </p>
            <p className="font-mono text-sm font-bold text-coop-ink dark:text-coop-shell">
              {fmt(token.volumeEth)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-coop-wood/55 dark:text-coop-shell/45">
              Trades
            </p>
            <p className="font-mono text-sm font-bold text-coop-ink dark:text-coop-shell">
              {token.tradeCount}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-coop-wood/55 dark:text-coop-shell/45">
              Holders
            </p>
            <p className="font-mono text-sm font-bold text-coop-ink dark:text-coop-shell">
              {token.holderCount ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* curve progress */}
      {token.phase === "trading" ? (
        <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-coop-wood/70 dark:text-coop-shell/60">
              Bonding curve {pct}%
            </span>
            <span className="font-mono text-coop-wood/70 dark:text-coop-shell/55">
              {token.raisedEth.toFixed(4)} / 3.5 ETH in the bonding curve — graduates at 100%
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-coop-surface-warm dark:bg-coop-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-coop-yolk to-coop-orange transition-all"
              style={{ width: `${Math.max(2, pct)}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <CurveChart address={token.address} />
          <CurveTradesFeed address={token.address} symbol={token.symbol} />
        </div>
        <div className="space-y-4">
          <CurveTradeWidget token={token} onTraded={() => void load()} />
          <CreatorRewards token={token} />
          <CurveHolders holders={holders} holderCount={token.holderCount ?? 0} />
        </div>
      </div>
    </div>
  );
}
