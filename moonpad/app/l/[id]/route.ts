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

/**
 * Public origin of this request. Behind Railway's proxy `req.url` is the
 * INTERNAL address (localhost:8080), so redirects built from it leave users
 * on localhost — use the forwarded headers, falling back to req.url for
 * local dev.
 */
function publicOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return new URL(req.url).origin;
  const proto =
    req.headers.get("x-forwarded-proto") ??
    new URL(req.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const origin = publicOrigin(req);
  const home = new URL("/", origin);
  const id = params.id;
  if (!/^[a-f0-9]{8,32}$/i.test(id)) return NextResponse.redirect(home);
  try {
    const db = await curveDb();
    const res = await db.query<{ address: string }>(
      "SELECT address FROM curve_tokens WHERE website LIKE $1 LIMIT 1",
      [`%/l/${id}`]
    );
    const address = res.rows[0]?.address;
    return NextResponse.redirect(address ? new URL(`/coin/${address}`, origin) : home);
  } catch {
    return NextResponse.redirect(home);
  }
}
