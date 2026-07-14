import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ETH/USD spot price, cached server-side for 60s. Sourced from CoinGecko's free
 * endpoint; on failure the last known price keeps serving so the UI never flaps.
 */

type Cache = { usd: number; at: number };
const g = globalThis as unknown as { __coopEthPrice?: Cache };

export async function GET() {
  const now = Date.now();
  const cache = g.__coopEthPrice;
  if (!cache || now - cache.at > 60_000) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
        { signal: controller.signal, cache: "no-store" }
      );
      clearTimeout(timer);
      if (res.ok) {
        const j = (await res.json()) as { ethereum?: { usd?: number } };
        const usd = Number(j.ethereum?.usd ?? 0);
        if (usd > 0) {
          g.__coopEthPrice = { usd, at: now };
        }
      } else if (cache) {
        cache.at = now - 45_000; // brief backoff, retry in 15s
      }
    } catch {
      /* keep last known price */
    }
  }
  return NextResponse.json({ usd: g.__coopEthPrice?.usd ?? 0 });
}
