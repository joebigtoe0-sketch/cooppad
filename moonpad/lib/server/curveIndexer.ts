import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  type Address,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { coopLaunchpadV2Abi } from "@/lib/evm/abi/coopLaunchpadV2";
import { coopLaunchTokenV2Abi } from "@/lib/evm/abi/coopLaunchTokenV2";
import { coopLockerV2Abi } from "@/lib/evm/abi/coopLockerV2";
import {
  activeChain,
  indexerStartBlock,
  isEvmConfigured,
  launchpadAddress,
} from "@/lib/evm/chains";
import { curveDb, getMeta, setMeta, type CurveDb } from "@/lib/server/curveDb";

/**
 * V2 indexer: tokens launch straight into locked single-sided Uniswap v3 pools,
 * so trading truth lives in the pools. This loop watches:
 *   - launchpad TokenLaunched  -> new token + pool registration
 *   - pool Swap                -> trades / price / volume / candles source
 *   - token Transfer           -> holder balances
 *   - locker FeesCollected / TaxCompounded -> analytics revenue rows
 * plus, per active token, the launchpad's graduationStatus view (raised WETH,
 * cosmetic "graduated" badge). Optionally acts as the Super LP keeper: when a
 * token's accumulated buy tax crosses a threshold it cranks locker.collect()
 * so the tax compounds into locked liquidity moments after the buys happen.
 */

const POLL_MS = 3_000;
const CHUNK = 2_000n;
const ZERO = "0x0000000000000000000000000000000000000000";
const GRADUATION_TARGET_WEI = 3_500_000_000_000_000_000n;
const CRANK_COOLDOWN_MS = 5 * 60_000;

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);
const swapEvent = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"
);

const launchedEvent = coopLaunchpadV2Abi.find(
  (i) => i.type === "event" && i.name === "TokenLaunched"
);
const lockerEvents = coopLockerV2Abi.filter(
  (i) => i.type === "event" && ["FeesCollected", "TaxCompounded"].includes(i.name)
);

type AnyLog = {
  eventName?: string;
  args?: Record<string, unknown>;
  address: Address;
  blockNumber: bigint | null;
  logIndex: number | null;
  transactionHash: `0x${string}` | null;
};

type PoolInfo = { token: string; isToken0: boolean; flavor: number };

function ipfsToHttp(uri: string): string {
  if (!uri.startsWith("ipfs://")) return uri;
  const gateway =
    process.env.PINATA_GATEWAY?.trim().replace(/\/$/, "") ??
    "https://gateway.pinata.cloud";
  return `${gateway}/ipfs/${uri.slice("ipfs://".length)}`;
}

async function fetchMetadata(db: CurveDb, token: string, uri: string): Promise<void> {
  if (!uri) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(ipfsToHttp(uri), { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    const j = (await res.json()) as Record<string, unknown>;
    const s = (k: string) => (typeof j[k] === "string" ? (j[k] as string) : "");
    await db.query(
      `UPDATE curve_tokens
         SET description = $2, image_url = $3, website = $4, twitter = $5, telegram = $6
       WHERE address = $1`,
      [token, s("description"), s("image"), s("website"), s("twitter"), s("telegram")]
    );
  } catch {
    // metadata is cosmetic — never block indexing on it
  }
}

/** WETH-per-token spot price from a pool's sqrtPriceX96. */
function priceFromSqrt(sqrtPriceX96: bigint, tokenIsToken0: boolean): number {
  const ratio = Number(sqrtPriceX96) / 2 ** 96;
  const p = ratio * ratio; // token1 per token0
  if (tokenIsToken0) return p;
  return p === 0 ? 0 : 1 / p;
}

class CurveIndexerV2 {
  private client: PublicClient;
  private launchpad: Address;
  private locker: Address | null = null;
  private tokens = new Set<string>();
  private pools = new Map<string, PoolInfo>(); // pool -> token info
  private loaded = false;
  private resetChecked = false;
  private blockTs = new Map<bigint, Date>();
  private dirty = new Set<string>(); // tokens with new swaps this tick
  private lastCrank = new Map<string, number>();

  constructor() {
    this.client = createPublicClient({ chain: activeChain(), transport: http() });
    this.launchpad = launchpadAddress();
  }

  async run(): Promise<void> {
    for (;;) {
      try {
        await this.tick();
      } catch (err) {
        console.error("[curve-indexer]", err instanceof Error ? err.message : err);
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }

  private async lockerAddress(): Promise<Address> {
    if (!this.locker) {
      this.locker = (await this.client.readContract({
        address: this.launchpad,
        abi: coopLaunchpadV2Abi,
        functionName: "locker",
      })) as Address;
    }
    return this.locker;
  }

  private async load(db: CurveDb): Promise<void> {
    if (this.loaded) return;
    const res = await db.query<{
      address: string;
      pool: string;
      is_token0: boolean;
      flavor: number;
    }>("SELECT address, pool, is_token0, flavor FROM curve_tokens WHERE pool != ''");
    for (const row of res.rows) {
      this.tokens.add(row.address.toLowerCase());
      this.pools.set(row.pool.toLowerCase(), {
        token: row.address.toLowerCase(),
        isToken0: Boolean(row.is_token0),
        flavor: Number(row.flavor),
      });
    }
    this.loaded = true;
  }

  private async tsOf(blockNumber: bigint): Promise<Date> {
    const cached = this.blockTs.get(blockNumber);
    if (cached) return cached;
    const block = await this.client.getBlock({ blockNumber });
    const ts = new Date(Number(block.timestamp) * 1000);
    if (this.blockTs.size > 2_000) this.blockTs.clear();
    this.blockTs.set(blockNumber, ts);
    return ts;
  }

  /** Reset the index when the chain (genesis) OR the launchpad address changes —
   * both invalidate everything previously indexed. */
  private async resetIfStale(db: CurveDb): Promise<void> {
    if (this.resetChecked) return;
    const genesis = (await this.client.getBlock({ blockNumber: 0n })).hash ?? "";
    const key = `${genesis}:${this.launchpad.toLowerCase()}`;
    const stored = await getMeta(db, "index_key");
    if (stored && stored !== key) {
      console.warn("[curve-indexer] chain or launchpad changed — resetting index");
      for (const table of [
        "curve_trades",
        "curve_holders",
        "curve_fee_events",
        "curve_tokens",
        "curve_meta",
      ]) {
        await db.query(`DELETE FROM ${table}`);
      }
      this.tokens.clear();
      this.pools.clear();
      this.loaded = false;
      this.blockTs.clear();
    }
    await setMeta(db, "index_key", key);
    this.resetChecked = true;
  }

  private async tick(): Promise<void> {
    const db = await curveDb();
    await this.ensureWeth();
    await this.resetIfStale(db);
    await this.load(db);

    const latest = await this.client.getBlockNumber();
    const lastRaw = await getMeta(db, "last_block");
    let from: bigint;
    if (lastRaw !== null) {
      from = BigInt(lastRaw) + 1n;
    } else {
      const start = indexerStartBlock();
      from = start ? BigInt(start) : latest;
    }
    if (from > latest) return;

    this.dirty.clear();
    while (from <= latest) {
      const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
      await this.processRange(db, from, to);
      await setMeta(db, "last_block", to.toString());
      from = to + 1n;
    }

    await this.refreshGraduation(db);
    await this.maybeCrank(db);
  }

  private async processRange(db: CurveDb, fromBlock: bigint, toBlock: bigint): Promise<void> {
    const locker = await this.lockerAddress();

    const launchedLogs = (await this.client.getLogs({
      address: this.launchpad,
      event: launchedEvent as never,
      fromBlock,
      toBlock,
    })) as unknown as AnyLog[];

    // Register new launches first so their pools/tokens are watched inside the
    // same range (dev buys land in the launch block).
    for (const log of launchedLogs) {
      await this.onTokenLaunched(db, log);
    }

    const poolAddrs = [...this.pools.keys()] as Address[];
    const swapLogs: AnyLog[] =
      poolAddrs.length > 0
        ? ((await this.client.getLogs({
            address: poolAddrs,
            event: swapEvent,
            fromBlock,
            toBlock,
          })) as unknown as AnyLog[])
        : [];

    const tokenAddrs = [...this.tokens] as Address[];
    const transferLogs: AnyLog[] =
      tokenAddrs.length > 0
        ? ((await this.client.getLogs({
            address: tokenAddrs,
            event: transferEvent,
            fromBlock,
            toBlock,
          })) as unknown as AnyLog[])
        : [];

    const lockerLogs = (await this.client.getLogs({
      address: locker,
      events: lockerEvents as never,
      fromBlock,
      toBlock,
    })) as unknown as AnyLog[];

    const all = [...swapLogs, ...transferLogs, ...lockerLogs].sort((a, b) => {
      const bn = (a.blockNumber ?? 0n) - (b.blockNumber ?? 0n);
      if (bn !== 0n) return bn < 0n ? -1 : 1;
      return (a.logIndex ?? 0) - (b.logIndex ?? 0);
    });

    for (const log of all) {
      if (log.eventName === "Swap") await this.onSwap(db, log, locker);
      else if (log.eventName === "Transfer") await this.onTransfer(db, log);
      else await this.onLockerEvent(db, log);
    }
  }

  private async onTokenLaunched(db: CurveDb, log: AnyLog): Promise<void> {
    const args = log.args ?? {};
    const token = (args.token as string).toLowerCase();
    if (this.tokens.has(token)) return;
    const pool = (args.pool as string).toLowerCase();
    const flavor = Number(args.flavor ?? 0);
    const ts = await this.tsOf(log.blockNumber ?? 0n);

    // Strings live on the token contract, not in the event.
    const read = (fn: string) =>
      this.client.readContract({
        address: token as Address,
        abi: coopLaunchTokenV2Abi,
        functionName: fn as never,
      }) as Promise<string>;
    const [name, symbol, uri] = await Promise.all([
      read("name"),
      read("symbol"),
      read("metadataURI"),
    ]);
    const isToken0 = token < (this.wethAddr ?? "");

    await db.query(
      `INSERT INTO curve_tokens
         (address, creator, flavor, name, symbol, metadata_uri, v_eth, v_token,
          pool, is_token0, created_block, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, $8, $9, $10)
       ON CONFLICT (address) DO NOTHING`,
      [
        token,
        (args.creator as string).toLowerCase(),
        flavor,
        name ?? "",
        symbol ?? "",
        uri ?? "",
        pool,
        isToken0,
        (log.blockNumber ?? 0n).toString(),
        ts,
      ]
    );
    this.tokens.add(token);
    this.pools.set(pool, { token, isToken0, flavor });
    this.dirty.add(token);
    void fetchMetadata(db, token, uri ?? "");
  }

  private wethAddr: string | null = null;
  private async ensureWeth(): Promise<void> {
    if (this.wethAddr) return;
    this.wethAddr = (
      (await this.client.readContract({
        address: this.launchpad,
        abi: coopLaunchpadV2Abi,
        functionName: "weth",
      })) as string
    ).toLowerCase();
  }

  private async onSwap(db: CurveDb, log: AnyLog, locker: Address): Promise<void> {
    const info = this.pools.get(log.address.toLowerCase());
    if (!info) return;
    const args = log.args ?? {};
    const amount0 = args.amount0 as bigint;
    const amount1 = args.amount1 as bigint;
    const sqrtPriceX96 = args.sqrtPriceX96 as bigint;

    const tokenDelta = info.isToken0 ? amount0 : amount1;
    const wethDelta = info.isToken0 ? amount1 : amount0;
    // Positive delta = into the pool. WETH in => a buy of the token.
    const isBuy = wethDelta > 0n;
    const ethWei = wethDelta < 0n ? -wethDelta : wethDelta;
    const tokenAmount = tokenDelta < 0n ? -tokenDelta : tokenDelta;
    const price = priceFromSqrt(sqrtPriceX96, info.isToken0);
    const recipient = ((args.recipient as string) ?? ZERO).toLowerCase();
    const internal = recipient === locker.toLowerCase();
    const ts = await this.tsOf(log.blockNumber ?? 0n);

    await db.query(
      `INSERT INTO curve_trades
         (tx_hash, log_index, token, trader, is_buy, eth_wei, token_amount, fee_wei,
          v_eth, v_token, price, block_number, ts, internal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, $9, $10, $11, $12)
       ON CONFLICT (tx_hash, log_index) DO NOTHING`,
      [
        log.transactionHash ?? "",
        log.logIndex ?? 0,
        info.token,
        recipient,
        isBuy,
        ethWei.toString(),
        tokenAmount.toString(),
        ((ethWei * 100n) / 10_000n).toString(), // 1% pool fee estimate
        price,
        (log.blockNumber ?? 0n).toString(),
        ts,
        internal,
      ]
    );
    await db.query(
      `UPDATE curve_tokens
         SET last_price = $2,
             trade_count = trade_count + 1,
             volume_wei = volume_wei + $3,
             last_trade_at = $4
       WHERE address = $1`,
      [info.token, price, ethWei.toString(), ts]
    );
    this.dirty.add(info.token);
  }

  private async onLockerEvent(db: CurveDb, log: AnyLog): Promise<void> {
    const args = log.args ?? {};
    const token = ((args.token as string) ?? "").toLowerCase();
    if (!this.tokens.has(token)) return;
    const info = [...this.pools.values()].find((p) => p.token === token);
    const ts = await this.tsOf(log.blockNumber ?? 0n);

    if (log.eventName === "FeesCollected") {
      const collected0 = args.collected0 as bigint;
      const collected1 = args.collected1 as bigint;
      const reinvested0 = args.reinvested0 as bigint;
      const reinvested1 = args.reinvested1 as bigint;
      const tokenIs0 = info?.isToken0 ?? false;
      const pairCollected = tokenIs0 ? collected1 : collected0;
      const pairReinvest = tokenIs0 ? reinvested1 : reinvested0;
      const tokCollected = tokenIs0 ? collected0 : collected1;
      const tokReinvest = tokenIs0 ? reinvested0 : reinvested1;
      await db.query(
        `INSERT INTO curve_fee_events
           (tx_hash, log_index, token, kind, pair_payout, token_payout, pair_reinvest, token_reinvest, ts)
         VALUES ($1, $2, $3, 'fees', $4, $5, $6, $7, $8)
         ON CONFLICT (tx_hash, log_index) DO NOTHING`,
        [
          log.transactionHash ?? "",
          log.logIndex ?? 0,
          token,
          (pairCollected - pairReinvest).toString(),
          (tokCollected > tokReinvest ? tokCollected - tokReinvest : 0n).toString(),
          pairReinvest.toString(),
          tokReinvest.toString(),
          ts,
        ]
      );
    } else if (log.eventName === "TaxCompounded") {
      await db.query(
        `INSERT INTO curve_fee_events
           (tx_hash, log_index, token, kind, pair_payout, token_payout, pair_reinvest, token_reinvest, ts)
         VALUES ($1, $2, $3, 'tax', 0, 0, $4, $5, $6)
         ON CONFLICT (tx_hash, log_index) DO NOTHING`,
        [
          log.transactionHash ?? "",
          log.logIndex ?? 0,
          token,
          ((args.pairAdded as bigint) ?? 0n).toString(),
          ((args.tokensAdded as bigint) ?? 0n).toString(),
          ts,
        ]
      );
    }
  }

  private async onTransfer(db: CurveDb, log: AnyLog): Promise<void> {
    const token = log.address.toLowerCase();
    if (!this.tokens.has(token)) return;
    const args = log.args ?? {};
    const from = ((args.from as string) ?? ZERO).toLowerCase();
    const to = ((args.to as string) ?? ZERO).toLowerCase();
    const value = (args.value as bigint) ?? 0n;
    if (value === 0n) return;

    const apply = async (holder: string, delta: bigint) => {
      if (holder === ZERO) return;
      await db.query(
        `INSERT INTO curve_holders (token, holder, balance) VALUES ($1, $2, $3)
         ON CONFLICT (token, holder)
         DO UPDATE SET balance = curve_holders.balance + EXCLUDED.balance`,
        [token, holder, delta.toString()]
      );
    };
    await apply(from, -value);
    await apply(to, value);
  }

  /** Update raised WETH / graduated badge for tokens that traded this tick. */
  private async refreshGraduation(db: CurveDb): Promise<void> {
    for (const token of this.dirty) {
      try {
        const [wethPrincipal, , graduated] = (await this.client.readContract({
          address: this.launchpad,
          abi: coopLaunchpadV2Abi,
          functionName: "graduationStatus",
          args: [token as Address],
        })) as [bigint, bigint, boolean];
        await db.query(
          `UPDATE curve_tokens
             SET raised_wei = $2,
                 phase = CASE WHEN $3 THEN 2 ELSE phase END,
                 graduated_at = CASE WHEN $3 AND graduated_at IS NULL THEN $4 ELSE graduated_at END
           WHERE address = $1`,
          [token, wethPrincipal.toString(), graduated, new Date()]
        );
      } catch {
        // transient RPC issues — next tick refreshes again
      }
    }
  }

  /** Super LP keeper: crank locker.collect() when enough buy tax accumulated. */
  private async maybeCrank(db: CurveDb): Promise<void> {
    const pk = process.env.KEEPER_PRIVATE_KEY?.trim();
    if (!pk) return;
    const minTax = BigInt(
      process.env.KEEPER_MIN_TAX_TOKENS?.trim() || "1000000000000000000000000" // 1M tokens
    );
    const locker = await this.lockerAddress();

    for (const token of this.dirty) {
      const info = [...this.pools.values()].find((p) => p.token === token);
      if (!info || info.flavor !== 2) continue; // Super LP only
      const last = this.lastCrank.get(token) ?? 0;
      if (Date.now() - last < CRANK_COOLDOWN_MS) continue;
      try {
        const taxBal = (await this.client.readContract({
          address: token as Address,
          abi: coopLaunchTokenV2Abi,
          functionName: "balanceOf",
          args: [locker],
        })) as bigint;
        if (taxBal < minTax) continue;

        const account = privateKeyToAccount(pk as `0x${string}`);
        const wallet = createWalletClient({
          account,
          chain: activeChain(),
          transport: http(),
        });
        const hash = await wallet.writeContract({
          address: locker,
          abi: coopLockerV2Abi,
          functionName: "collect",
          args: [token as Address],
        });
        this.lastCrank.set(token, Date.now());
        console.log(`[curve-indexer] cranked collect(${token}) tx=${hash}`);
      } catch (err) {
        console.error(
          "[curve-indexer] crank failed",
          err instanceof Error ? err.message : err
        );
        this.lastCrank.set(token, Date.now()); // back off either way
      }
    }
    // db reserved for future per-token crank bookkeeping
    void db;
  }
}

// One indexer per process, HMR-safe.
const g = globalThis as unknown as { __coopCurveIndexer?: boolean };

export function startCurveIndexer(): void {
  if (g.__coopCurveIndexer) return;
  if (process.env.EVM_INDEXER_DISABLED === "1") {
    console.log("[curve-indexer] disabled via EVM_INDEXER_DISABLED");
    return;
  }
  if (!isEvmConfigured()) {
    console.log("[curve-indexer] NEXT_PUBLIC_LAUNCHPAD_ADDRESS not set — indexer idle");
    return;
  }
  g.__coopCurveIndexer = true;
  console.log(
    `[curve-indexer] starting (v2) on ${activeChain().name} for ${launchpadAddress()}`
  );
  void new CurveIndexerV2().run();
}
