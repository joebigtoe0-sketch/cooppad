export type CurveTokenJson = {
  address: string;
  creator: string;
  flavor: "standard" | "lpGrow" | "superLp";
  name: string;
  symbol: string;
  metadataUri: string;
  description: string;
  imageUrl: string;
  website: string;
  twitter: string;
  telegram: string;
  phase: "trading" | "graduated";
  pair: string;
  vEth: string;
  vToken: string;
  priceEth: number;
  marketCapEth: number;
  progress: number;
  raisedEth: number;
  tradeCount: number;
  volumeEth: number;
  change24h: number;
  createdAt: string;
  graduatedAt: string | null;
  lastTradeAt: string | null;
  holderCount?: number;
};

export type CurveTradeJson = {
  txHash: string;
  logIndex: number;
  token: string;
  trader: string;
  isBuy: boolean;
  ethWei: string;
  tokenAmount: string;
  priceEth: number;
  ts: string;
  tokenSymbol?: string;
  tokenName?: string;
  imageUrl?: string;
};

export type CurveCandleJson = {
  time: number; // unix seconds, bucket start
  open: number;
  high: number;
  low: number;
  close: number;
  volumeEth: number;
};

export type CurveHolderJson = {
  holder: string;
  balance: string;
  pct: number;
  tag?: "creator" | "pair" | "burn" | "curve";
};

export type AnalyticsBucketJson = {
  day: string; // YYYY-MM-DD
  volumeEth: number;
  launches: number;
  trades: number;
};

export type AnalyticsJson = {
  period: "24h" | "7d" | "30d" | "all";
  launches: number;
  launchesAllTime: number;
  volumeEth: number;
  trades: number;
  buys: number;
  sells: number;
  protocolRevenueEth: number;
  creatorRevenueEth: number;
  graduatedAllTime: number;
  buckets: AnalyticsBucketJson[];
  topTokens: {
    address: string;
    name: string;
    symbol: string;
    imageUrl: string;
    volumeEth: number;
    tradeCount: number;
  }[];
  updatedAt: string;
};
