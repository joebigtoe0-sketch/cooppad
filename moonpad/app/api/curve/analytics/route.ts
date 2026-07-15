import { NextResponse } from "next/server";

import { curveDb } from "@/lib/server/curveDb";
import type { AnalyticsBucketJson, AnalyticsJson } from "@/types/curve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Protocol analytics: launches, volume, trades, revenue, graduations for a
 * selectable period (24h / 7d / 30d / all) plus daily buckets for charts and
 * a top-tokens leaderboard. Revenue figures are ETH-side only: the locker
 * pays half of every fee payout to the platform and half to the creator.
 */

const PERIODS: Record<string, string | null> = {
  "24h": "1 day",
  "7d": "7 days",
  "30d": "30 days",
  all: null,
};

let cache: { key: string; at: number; data: AnalyticsJson } | null = null;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const period = (url.searchParams.get("period") ?? "30d") as AnalyticsJson["period"];
    const interval = PERIODS[period];
    if (interval === undefined) {
      return NextResponse.json({ ok: false, error: "bad period" }, { status: 400 });
    }

    if (cache && cache.key === period && Date.now() - cache.at < 30_000) {
      return NextResponse.json({ ok: true, analytics: cache.data });
    }

    const db = await curveDb();
    const since = interval ? `now() - interval '${interval}'` : "'epoch'::timestamptz";

    const [tokens, trades, revenue, buckets, top] = await Promise.all([
      db.query<{ launches: string; all_time: string; graduated: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= ${since}) AS launches,
           COUNT(*) AS all_time,
           COUNT(*) FILTER (WHERE phase = 2) AS graduated
         FROM curve_tokens`
      ),
      db.query<{ volume: string; trades: string; buys: string; sells: string }>(
        `SELECT
           COALESCE(SUM(eth_wei), 0) AS volume,
           COUNT(*) AS trades,
           COUNT(*) FILTER (WHERE is_buy) AS buys,
           COUNT(*) FILTER (WHERE NOT is_buy) AS sells
         FROM curve_trades WHERE ts >= ${since} AND NOT internal`
      ),
      db.query<{ payout: string }>(
        `SELECT COALESCE(SUM(pair_payout), 0) AS payout
         FROM curve_fee_events WHERE kind = 'fees' AND ts >= ${since}`
      ),
      db.query<{ day: string; volume: string; trades: string; launches: string }>(
        `SELECT d.day::date::text AS day,
                COALESCE(t.volume, 0) AS volume,
                COALESCE(t.trades, 0) AS trades,
                COALESCE(l.launches, 0) AS launches
         FROM generate_series(
                date_trunc('day', ${interval ? `now() - interval '${interval}'` : "(SELECT COALESCE(MIN(created_at), now()) FROM curve_tokens)"}),
                date_trunc('day', now()),
                interval '1 day'
              ) AS d(day)
         LEFT JOIN (
           SELECT date_trunc('day', ts) AS day, SUM(eth_wei) AS volume, COUNT(*) AS trades
           FROM curve_trades WHERE NOT internal GROUP BY 1
         ) t ON t.day = d.day
         LEFT JOIN (
           SELECT date_trunc('day', created_at) AS day, COUNT(*) AS launches
           FROM curve_tokens GROUP BY 1
         ) l ON l.day = d.day
         ORDER BY d.day`
      ),
      db.query<{
        address: string;
        name: string;
        symbol: string;
        image_url: string;
        volume_wei: string;
        trade_count: string;
      }>(
        `SELECT address, name, symbol, image_url, volume_wei, trade_count
         FROM curve_tokens ORDER BY volume_wei DESC LIMIT 10`
      ),
    ]);

    const t = tokens.rows[0];
    const tr = trades.rows[0];
    // Fee payouts are split 50/50 by the locker: half platform, half creator.
    const payoutEth = Number(revenue.rows[0]?.payout ?? "0") / 1e18;

    const data: AnalyticsJson = {
      period,
      launches: Number(t?.launches ?? 0),
      launchesAllTime: Number(t?.all_time ?? 0),
      volumeEth: Number(tr?.volume ?? "0") / 1e18,
      trades: Number(tr?.trades ?? 0),
      buys: Number(tr?.buys ?? 0),
      sells: Number(tr?.sells ?? 0),
      protocolRevenueEth: payoutEth / 2,
      creatorRevenueEth: payoutEth / 2,
      graduatedAllTime: Number(t?.graduated ?? 0),
      buckets: buckets.rows.map(
        (b): AnalyticsBucketJson => ({
          day: b.day,
          volumeEth: Number(b.volume) / 1e18,
          launches: Number(b.launches),
          trades: Number(b.trades),
        })
      ),
      topTokens: top.rows.map((r) => ({
        address: r.address,
        name: r.name,
        symbol: r.symbol,
        imageUrl: r.image_url ?? "",
        volumeEth: Number(r.volume_wei) / 1e18,
        tradeCount: Number(r.trade_count),
      })),
      updatedAt: new Date().toISOString(),
    };

    cache = { key: period, at: Date.now(), data };
    return NextResponse.json({ ok: true, analytics: data });
  } catch (err) {
    console.error("[api/curve/analytics]", err);
    return NextResponse.json({ ok: false, error: "analytics failed" }, { status: 500 });
  }
}
