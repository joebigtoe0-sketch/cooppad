import { NextResponse } from "next/server";

import { curveDb } from "@/lib/server/curveDb";
import { tokenRowToJson } from "@/lib/server/curveDto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Holdings and created tokens for one wallet, from the indexer. */
export async function GET(
  _req: Request,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address.toLowerCase();
    const db = await curveDb();

    const holdingsRes = await db.query(
      `SELECT t.*, h.balance AS held_balance
       FROM curve_holders h
       JOIN curve_tokens t ON t.address = h.token
       WHERE h.holder = $1 AND h.balance > 0
       ORDER BY h.balance DESC
       LIMIT 100`,
      [address]
    );

    const createdRes = await db.query(
      `SELECT * FROM curve_tokens WHERE creator = $1 ORDER BY created_at DESC LIMIT 100`,
      [address]
    );

    const holdings = holdingsRes.rows.map((row) => {
      const token = tokenRowToJson(row);
      const balance = BigInt(String(row.held_balance));
      return {
        token,
        balance: balance.toString(),
        valueEth: (Number(balance) / 1e18) * token.priceEth,
      };
    });

    return NextResponse.json({
      holdings,
      created: createdRes.rows.map(tokenRowToJson),
    });
  } catch (err) {
    console.error("[api/curve/portfolio]", err);
    return NextResponse.json({ holdings: [], created: [] }, { status: 200 });
  }
}
