import { NextResponse } from "next/server";

import { curveDb } from "@/lib/server/curveDb";
import { tokenRowToJson } from "@/lib/server/curveDto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Token search: exact address, or fuzzy name/ticker match, best volume first. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ tokens: [] });

    const db = await curveDb();
    const like = `%${q.replace(/[%_]/g, "")}%`;
    const res = await db.query(
      `SELECT * FROM curve_tokens
       WHERE address = $1 OR name ILIKE $2 OR symbol ILIKE $2
       ORDER BY (address = $1) DESC, volume_wei DESC
       LIMIT 8`,
      [q.toLowerCase(), like]
    );
    return NextResponse.json({ tokens: res.rows.map(tokenRowToJson) });
  } catch (err) {
    console.error("[api/curve/search]", err);
    return NextResponse.json({ tokens: [] }, { status: 200 });
  }
}
