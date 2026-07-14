import { NextResponse } from "next/server";

import { getConnection } from "@/lib/anchor";
import { runMeteoraLiquidityForMint } from "@/lib/server/completeEggHatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.LIQUIDITY_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * After `launch_presale`, runs sweep → Meteora pool → register (same as cron Meteora leg).
 * Called from the presale page right after the user hatches, or manually to retry.
 *
 * If `LIQUIDITY_WEBHOOK_SECRET` is set, require `Authorization: Bearer <secret>`.
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { mint?: string };
  try {
    body = (await req.json()) as { mint?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mint = body.mint?.trim();
  if (!mint) {
    return NextResponse.json({ error: "mint required" }, { status: 400 });
  }

  if (!process.env.PLATFORM_AUTHORITY_SECRET?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        status: "error" as const,
        messages: [
          "PLATFORM_AUTHORITY_SECRET is not configured on the server (required for sweep + register).",
        ],
      },
      { status: 503 }
    );
  }

  try {
    const connection = getConnection("confirmed");
    const result = await runMeteoraLiquidityForMint(connection, mint);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "finish-liquidity failed";
    return NextResponse.json(
      {
        ok: false,
        status: "error" as const,
        messages: [msg],
      },
      { status: 500 }
    );
  }
}
