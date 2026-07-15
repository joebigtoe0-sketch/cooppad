import type { CurveTokenJson, CurveTradeJson } from "@/types/curve";

/** V2 start price (INITIAL_TICK=-205800): ~1.165e-9 WETH per token. */
const START_PRICE = 1.0001 ** -205800;
const GRADUATION_TARGET_ETH = 3.5;

const FLAVORS = ["standard", "lpGrow", "superLp"] as const;

/** Convert a curve_tokens row (pg or PGlite) into the API DTO. */
export function tokenRowToJson(row: Record<string, unknown>): CurveTokenJson {
  const price = Number(row.last_price ?? 0) || START_PRICE;
  const graduated = Number(row.phase) === 2;
  const raisedEth = Number(String(row.raised_wei ?? "0")) / 1e18;
  const basePrice = row.base_price != null ? Number(row.base_price) : START_PRICE;
  const change24h = basePrice > 0 && Number(row.trade_count ?? 0) > 0 ? price / basePrice - 1 : 0;

  return {
    address: String(row.address),
    creator: String(row.creator),
    flavor: FLAVORS[Number(row.flavor)] ?? "standard",
    name: String(row.name),
    symbol: String(row.symbol),
    metadataUri: String(row.metadata_uri ?? ""),
    description: String(row.description ?? ""),
    imageUrl: String(row.image_url ?? ""),
    website: String(row.website ?? ""),
    twitter: String(row.twitter ?? ""),
    telegram: String(row.telegram ?? ""),
    phase: graduated ? "graduated" : "trading",
    pair: String(row.pool ?? ""),
    vEth: "0",
    vToken: "0",
    priceEth: price,
    marketCapEth: price * 1e9,
    progress: graduated ? 1 : Math.min(1, raisedEth / GRADUATION_TARGET_ETH),
    raisedEth,
    tradeCount: Number(row.trade_count ?? 0),
    volumeEth: Number(String(row.volume_wei ?? "0")) / 1e18,
    change24h,
    createdAt: new Date(String(row.created_at)).toISOString(),
    graduatedAt: row.graduated_at
      ? new Date(String(row.graduated_at)).toISOString()
      : null,
    lastTradeAt: row.last_trade_at
      ? new Date(String(row.last_trade_at)).toISOString()
      : null,
    ...(row.holder_count !== undefined
      ? { holderCount: Number(row.holder_count) }
      : {}),
  };
}

export function tradeRowToJson(row: Record<string, unknown>): CurveTradeJson {
  return {
    txHash: String(row.tx_hash),
    logIndex: Number(row.log_index),
    token: String(row.token),
    trader: String(row.trader),
    isBuy: Boolean(row.is_buy),
    ethWei: String(row.eth_wei),
    tokenAmount: String(row.token_amount),
    priceEth: Number(row.price),
    ts: new Date(String(row.ts)).toISOString(),
    ...(row.symbol !== undefined ? { tokenSymbol: String(row.symbol) } : {}),
    ...(row.name !== undefined ? { tokenName: String(row.name) } : {}),
    ...(row.image_url !== undefined ? { imageUrl: String(row.image_url) } : {}),
  };
}
