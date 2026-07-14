import { NextResponse } from "next/server";

import { curveDb } from "@/lib/server/curveDb";
import { tokenRowToJson } from "@/lib/server/curveDto";
import type { CurveHolderJson } from "@/types/curve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;
const DEAD = "0x000000000000000000000000000000000000dead";

export async function GET(
  _req: Request,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address.toLowerCase();
    const db = await curveDb();

    const tokenRes = await db.query(
      "SELECT * FROM curve_tokens WHERE address = $1",
      [address]
    );
    if (!tokenRes.rows[0]) {
      return NextResponse.json({ token: null }, { status: 404 });
    }
    const token = tokenRowToJson(tokenRes.rows[0]);

    const launchpad = (process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS ?? "").toLowerCase();

    const holdersRes = await db.query(
      `SELECT holder, balance FROM curve_holders
       WHERE token = $1 AND balance > 0
       ORDER BY balance DESC LIMIT 12`,
      [address]
    );
    const countRes = await db.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM curve_holders WHERE token = $1 AND balance > 0",
      [address]
    );

    const holders: CurveHolderJson[] = holdersRes.rows.map((row) => {
      const holder = String(row.holder);
      const balance = BigInt(String(row.balance));
      let tag: CurveHolderJson["tag"];
      if (holder === token.creator) tag = "creator";
      else if (holder === token.pair && token.pair) tag = "pair";
      else if (holder === DEAD) tag = "burn";
      else if (holder === launchpad) tag = "curve";
      return {
        holder,
        balance: balance.toString(),
        pct: Number((balance * 10_000n) / TOTAL_SUPPLY) / 100,
        ...(tag ? { tag } : {}),
      };
    });

    return NextResponse.json({
      token: { ...token, holderCount: Number(countRes.rows[0]?.n ?? 0) },
      holders,
    });
  } catch (err) {
    console.error("[api/curve/token]", err);
    return NextResponse.json({ token: null }, { status: 500 });
  }
}
