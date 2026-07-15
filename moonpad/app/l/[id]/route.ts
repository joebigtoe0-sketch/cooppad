import { NextResponse } from "next/server";

import { curveDb } from "@/lib/server/curveDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolver for the /l/<id> short links pinned into token metadata as the
 * default website (see api/curve/pin-metadata). The coin-page URL can't be
 * pinned directly — the token's CREATE2 address hashes the metadata CID — so
 * the pinned link carries a random id instead, and this route finds the token
 * whose indexed metadata carries it. Unknown or not-yet-indexed ids land on
 * the homepage.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const home = new URL("/", req.url);
  const id = params.id;
  if (!/^[a-f0-9]{8,32}$/i.test(id)) return NextResponse.redirect(home);
  try {
    const db = await curveDb();
    const res = await db.query<{ address: string }>(
      "SELECT address FROM curve_tokens WHERE website LIKE $1 LIMIT 1",
      [`%/l/${id}`]
    );
    const address = res.rows[0]?.address;
    return NextResponse.redirect(address ? new URL(`/coin/${address}`, req.url) : home);
  } catch {
    return NextResponse.redirect(home);
  }
}
