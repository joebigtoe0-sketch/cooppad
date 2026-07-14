import { NextResponse } from "next/server";

import { curveDb } from "@/lib/server/curveDb";
import { tradeRowToJson } from "@/lib/server/curveDto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { address: string } }
) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const db = await curveDb();
    const res = await db.query(
      `SELECT * FROM curve_trades WHERE token = $1
       ORDER BY block_number DESC, log_index DESC LIMIT ${limit}`,
      [params.address.toLowerCase()]
    );
    return NextResponse.json({ trades: res.rows.map(tradeRowToJson) });
  } catch (err) {
    console.error("[api/curve/trades]", err);
    return NextResponse.json({ trades: [] }, { status: 200 });
  }
}
