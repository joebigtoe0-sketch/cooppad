import path from "path";

import { moonpadDataDir } from "@/lib/server/moonpadDataPath";

/**
 * Storage for the curve indexer and APIs. Production (Railway) sets DATABASE_URL
 * and gets a real Postgres pool; local dev without it falls back to PGlite
 * (embedded WASM Postgres persisted under .data/) so there is nothing to install.
 * Both speak the same SQL, including $1-style params.
 */
export interface CurveDb {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS curve_tokens (
     address        TEXT PRIMARY KEY,
     creator        TEXT NOT NULL,
     flavor         INTEGER NOT NULL DEFAULT 0,
     name           TEXT NOT NULL DEFAULT '',
     symbol         TEXT NOT NULL DEFAULT '',
     metadata_uri   TEXT NOT NULL DEFAULT '',
     description    TEXT NOT NULL DEFAULT '',
     image_url      TEXT NOT NULL DEFAULT '',
     website        TEXT NOT NULL DEFAULT '',
     twitter        TEXT NOT NULL DEFAULT '',
     telegram       TEXT NOT NULL DEFAULT '',
     phase          INTEGER NOT NULL DEFAULT 1,
     v_eth          NUMERIC NOT NULL,
     v_token        NUMERIC NOT NULL,
     pair           TEXT NOT NULL DEFAULT '',
     trade_count    INTEGER NOT NULL DEFAULT 0,
     volume_wei     NUMERIC NOT NULL DEFAULT 0,
     created_block  BIGINT NOT NULL DEFAULT 0,
     created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
     graduated_at   TIMESTAMPTZ,
     last_trade_at  TIMESTAMPTZ
   )`,
  `CREATE TABLE IF NOT EXISTS curve_trades (
     tx_hash      TEXT NOT NULL,
     log_index    INTEGER NOT NULL,
     token        TEXT NOT NULL,
     trader       TEXT NOT NULL,
     is_buy       BOOLEAN NOT NULL,
     eth_wei      NUMERIC NOT NULL,
     token_amount NUMERIC NOT NULL,
     fee_wei      NUMERIC NOT NULL,
     v_eth        NUMERIC NOT NULL,
     v_token      NUMERIC NOT NULL,
     price        DOUBLE PRECISION NOT NULL,
     block_number BIGINT NOT NULL,
     ts           TIMESTAMPTZ NOT NULL,
     PRIMARY KEY (tx_hash, log_index)
   )`,
  `CREATE INDEX IF NOT EXISTS curve_trades_token_ts ON curve_trades (token, ts)`,
  `CREATE INDEX IF NOT EXISTS curve_trades_ts ON curve_trades (ts)`,
  `CREATE TABLE IF NOT EXISTS curve_holders (
     token   TEXT NOT NULL,
     holder  TEXT NOT NULL,
     balance NUMERIC NOT NULL DEFAULT 0,
     PRIMARY KEY (token, holder)
   )`,
  `CREATE INDEX IF NOT EXISTS curve_holders_token_balance ON curve_holders (token, balance DESC)`,
  `CREATE TABLE IF NOT EXISTS curve_meta (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
  // --- V2 (instant-pool) additions ---
  `ALTER TABLE curve_tokens ADD COLUMN IF NOT EXISTS pool TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE curve_tokens ADD COLUMN IF NOT EXISTS is_token0 BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE curve_tokens ADD COLUMN IF NOT EXISTS raised_wei NUMERIC NOT NULL DEFAULT 0`,
  `ALTER TABLE curve_tokens ADD COLUMN IF NOT EXISTS last_price DOUBLE PRECISION NOT NULL DEFAULT 0`,
  // Trades executed by the protocol itself (tax-compounding cranks) — kept for
  // volume accuracy, hidden from the live trade feeds.
  `ALTER TABLE curve_trades ADD COLUMN IF NOT EXISTS internal BOOLEAN NOT NULL DEFAULT FALSE`,
  // Locker fee collections + tax compounds, for the analytics page.
  `CREATE TABLE IF NOT EXISTS curve_fee_events (
     tx_hash        TEXT NOT NULL,
     log_index      INTEGER NOT NULL,
     token          TEXT NOT NULL,
     kind           TEXT NOT NULL,           -- 'fees' | 'tax'
     pair_payout    NUMERIC NOT NULL DEFAULT 0,   -- WETH paid out (both shares)
     token_payout   NUMERIC NOT NULL DEFAULT 0,   -- token paid out (both shares)
     pair_reinvest  NUMERIC NOT NULL DEFAULT 0,
     token_reinvest NUMERIC NOT NULL DEFAULT 0,
     ts             TIMESTAMPTZ NOT NULL,
     PRIMARY KEY (tx_hash, log_index)
   )`,
  `CREATE INDEX IF NOT EXISTS curve_fee_events_ts ON curve_fee_events (ts)`,
];

async function createDb(): Promise<CurveDb> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { Pool } = await import("pg");
    // Timeouts everywhere: a silently hung query must become a loud error the
    // logs can show, never an indexer that freezes without a trace.
    const pool = new Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 30_000,
      query_timeout: 30_000,
    });
    pool.on("error", (err) => console.error("[curve-db] pool error", err.message));
    return {
      async query(text, params) {
        const res = await pool.query(text, params as never[]);
        return { rows: res.rows };
      },
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = path.join(moonpadDataDir(), "curve-pglite");
  const pg = new PGlite(dataDir);
  return {
    async query(text, params) {
      const res = await pg.query(text, params as never[]);
      return { rows: res.rows as never[] };
    },
  };
}

async function migrate(db: CurveDb): Promise<CurveDb> {
  for (const sql of MIGRATIONS) {
    await db.query(sql);
  }
  return db;
}

// Survive Next dev HMR: a single db handle per process.
const g = globalThis as unknown as { __coopCurveDb?: Promise<CurveDb> };

export function curveDb(): Promise<CurveDb> {
  if (!g.__coopCurveDb) {
    g.__coopCurveDb = createDb().then(migrate);
  }
  return g.__coopCurveDb;
}

export async function getMeta(db: CurveDb, key: string): Promise<string | null> {
  const res = await db.query<{ value: string }>(
    "SELECT value FROM curve_meta WHERE key = $1",
    [key]
  );
  return res.rows[0]?.value ?? null;
}

export async function setMeta(db: CurveDb, key: string, value: string): Promise<void> {
  await db.query(
    `INSERT INTO curve_meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
}
