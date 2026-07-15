import { NextResponse } from "next/server";

import { curveDb } from "@/lib/server/curveDb";
import { tokenRowToJson } from "@/lib/server/curveDto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Supply is fixed at 1B for every token, so last_price sorts by market cap
// exactly. raised_wei is the WETH principal in the locked position (progress
// toward graduation). v_eth is a dead V1 column — never order by it.
const SORTS: Record<string, string> = {
  new: "t.created_at DESC",
  marketcap: "t.last_price DESC, t.last_trade_at DESC NULLS LAST",
  volume: "t.volume_wei DESC",
  progress: "t.phase DESC, t.raised_wei DESC",
  activity: "t.last_trade_at DESC NULLS LAST",
  gainers: "t.last_trade_at DESC NULLS LAST", // ordered by change24h in JS below
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sortKey = url.searchParams.get("sort") ?? "activity";
    const sort = SORTS[sortKey] ?? SORTS.activity;
    const status = url.searchParams.get("status") ?? "all";
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 60), 200);

    const where =
      status === "live" ? "WHERE t.phase = 1" : status === "graduated" ? "WHERE t.phase = 2" : "";

    const db = await curveDb();
    const res = await db.query(
      `SELECT t.*, base.price AS base_price
       FROM curve_tokens t
       LEFT JOIN (
         SELECT DISTINCT ON (token) token, price
         FROM curve_trades
         WHERE ts <= now() - interval '24 hours'
         ORDER BY token, ts DESC, log_index DESC
       ) base ON base.token = t.address
       ${where} ORDER BY ${sort} LIMIT ${limit}`
    );

    // King of the coop: the trending token — most real (non-crank) trading
    // volume over the last 24h, freshest activity breaking ties. Falls back to
    // deepest pool when the whole chain has been quiet for a day.
    const koth = await db.query(
      `SELECT t.*
       FROM curve_tokens t
       LEFT JOIN (
         SELECT token, SUM(eth_wei) AS vol24
         FROM curve_trades
         WHERE ts > now() - interval '24 hours' AND NOT internal
         GROUP BY token
       ) v ON v.token = t.address
       WHERE t.phase = 1 AND t.trade_count > 0
       ORDER BY COALESCE(v.vol24, 0) DESC,
                t.last_trade_at DESC NULLS LAST,
                t.raised_wei DESC
       LIMIT 1`
    );

    let tokens = res.rows.map(tokenRowToJson);
    if (sortKey === "gainers") {
      tokens = tokens.sort((a, b) => b.change24h - a.change24h);
    }

    return NextResponse.json({
      tokens,
      koth: koth.rows[0] ? tokenRowToJson(koth.rows[0]) : null,
    });
  } catch (err) {
    console.error("[api/curve/tokens]", err);
    return NextResponse.json({ tokens: [], koth: null }, { status: 200 });
  }
}
