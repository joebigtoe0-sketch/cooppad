import { NextResponse } from "next/server";

import { getConnection } from "@/lib/anchor";
import { runEggHatchCron } from "@/lib/server/completeEggHatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

/** POST or GET — secured with `CRON_SECRET` (Bearer or `?secret=`). */
export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connection = getConnection("confirmed");
    const { results } = await runEggHatchCron(connection);
    return NextResponse.json({
      ok: true,
      count: results.length,
      results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cron failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
