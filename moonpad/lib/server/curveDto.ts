import type { CurveTokenJson, CurveTradeJson } from "@/types/curve";

/** Convert a curve_tokens row (pg or PGlite) into the API DTO. */
export function tokenRowToJson(row: Record<string, unknown>): CurveTokenJson {
  const vEth = BigInt(String(row.v_eth));
  const vToken = BigInt(String(row.v_token));
  const virtualEth = 1_250_000_000_000_000_000n;
  const target = 3_500_000_000_000_000_000n;
  const raised = vEth > virtualEth ? vEth - virtualEth : 0n;
  const price = vToken === 0n ? 0 : Number(vEth) / Number(vToken);
  const graduated = Number(row.phase) === 2;
  // Baseline for 24h change: last trade price >24h ago, else the curve start price.
  const START_PRICE = 1.25e18 / 1.073e27;
  const basePrice = row.base_price != null ? Number(row.base_price) : START_PRICE;
  const change24h = basePrice > 0 && Number(row.trade_count ?? 0) > 0 ? price / basePrice - 1 : 0;

  return {
    address: String(row.address),
    creator: String(row.creator),
    flavor: Number(row.flavor) === 1 ? "lpGrow" : "standard",
    name: String(row.name),
    symbol: String(row.symbol),
    metadataUri: String(row.metadata_uri ?? ""),
    description: String(row.description ?? ""),
    imageUrl: String(row.image_url ?? ""),
    website: String(row.website ?? ""),
    twitter: String(row.twitter ?? ""),
    telegram: String(row.telegram ?? ""),
    phase: graduated ? "graduated" : "trading",
    pair: String(row.pair ?? ""),
    vEth: vEth.toString(),
    vToken: vToken.toString(),
    priceEth: price,
    marketCapEth: price * 1e9,
    progress: graduated ? 1 : Math.min(1, Number(raised) / Number(target)),
    raisedEth: Number(raised) / 1e18,
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
