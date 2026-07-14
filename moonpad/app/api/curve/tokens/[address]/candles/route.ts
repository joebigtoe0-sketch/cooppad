import { NextResponse } from "next/server";

import { curveDb } from "@/lib/server/curveDb";
import type { CurveCandleJson } from "@/types/curve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_RES = new Set([60, 300, 900, 3600, 14400, 86400]);

export async function GET(
  req: Request,
  { params }: { params: { address: string } }
) {
  try {
    const url = new URL(req.url);
    let res = Number(url.searchParams.get("res") ?? 300);
    if (!ALLOWED_RES.has(res)) res = 300;

    const db = await curveDb();
    const rows = await db.query(
      `SELECT
         (floor(extract(epoch FROM ts) / ${res}) * ${res})::bigint AS bucket,
         (array_agg(price ORDER BY block_number, log_index))[1]              AS open,
         max(price)                                                          AS high,
         min(price)                                                          AS low,
         (array_agg(price ORDER BY block_number DESC, log_index DESC))[1]    AS close,
         sum(eth_wei)                                                        AS volume_wei
       FROM curve_trades
       WHERE token = $1
       GROUP BY bucket
       ORDER BY bucket ASC
       LIMIT 1000`,
      [params.address.toLowerCase()]
    );

    const candles: CurveCandleJson[] = rows.rows.map((r) => ({
      time: Number(r.bucket),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volumeEth: Number(String(r.volume_wei)) / 1e18,
    }));

    return NextResponse.json({ candles, res });
  } catch (err) {
    console.error("[api/curve/candles]", err);
    return NextResponse.json({ candles: [], res: 300 }, { status: 200 });
  }
}
