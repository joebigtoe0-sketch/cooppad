import { NextResponse } from "next/server";

import { curveDb } from "@/lib/server/curveDb";
import { tokenRowToJson } from "@/lib/server/curveDto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORTS: Record<string, string> = {
  new: "t.created_at DESC",
  marketcap: "t.v_eth DESC",
  volume: "t.volume_wei DESC",
  progress: "t.phase DESC, t.v_eth DESC",
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

    // King of the hill: live token closest to graduation.
    const koth = await db.query(
      `SELECT * FROM curve_tokens WHERE phase = 1 AND trade_count > 0
       ORDER BY v_eth DESC LIMIT 1`
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
