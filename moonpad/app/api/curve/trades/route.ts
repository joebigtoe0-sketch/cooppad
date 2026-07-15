import { NextResponse } from "next/server";

import { curveDb } from "@/lib/server/curveDb";
import { tradeRowToJson } from "@/lib/server/curveDto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Global recent trades across every curve token (right-rail live feed). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 30), 100);
    const db = await curveDb();
    const res = await db.query(
      `SELECT t.*, k.symbol, k.name, k.image_url
       FROM curve_trades t
       JOIN curve_tokens k ON k.address = t.token
       WHERE NOT t.internal
       ORDER BY t.block_number DESC, t.log_index DESC
       LIMIT ${limit}`
    );

    // Simple aggregate stats for the rail.
    const stats = await db.query<{ live: string; graduated: string; vol: string }>(
      `SELECT
         (SELECT COUNT(*) FROM curve_tokens WHERE phase = 1)::text AS live,
         (SELECT COUNT(*) FROM curve_tokens WHERE phase = 2)::text AS graduated,
         (SELECT COALESCE(SUM(eth_wei), 0) FROM curve_trades
           WHERE ts > now() - interval '24 hours')::text AS vol`
    );

    return NextResponse.json({
      trades: res.rows.map(tradeRowToJson),
      stats: {
        live: Number(stats.rows[0]?.live ?? 0),
        graduated: Number(stats.rows[0]?.graduated ?? 0),
        volume24hEth: Number(stats.rows[0]?.vol ?? "0") / 1e18,
      },
    });
  } catch (err) {
    console.error("[api/curve/trades-global]", err);
    return NextResponse.json(
      { trades: [], stats: { live: 0, graduated: 0, volume24hEth: 0 } },
      { status: 200 }
    );
  }
}
