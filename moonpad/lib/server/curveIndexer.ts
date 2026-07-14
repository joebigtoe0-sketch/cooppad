import { createPublicClient, http, parseAbiItem, type Address, type PublicClient } from "viem";

import { coopLaunchpadAbi } from "@/lib/evm/abi/coopLaunchpad";
import { activeChain, isEvmConfigured, launchpadAddress } from "@/lib/evm/chains";
import { curveDb, getMeta, setMeta, type CurveDb } from "@/lib/server/curveDb";

/**
 * Polls the chain for CoopLaunchpad events (TokenCreated / Trade / Graduated) plus
 * ERC20 Transfers of every curve token, and writes them to the curve DB. Runs as a
 * single background loop inside the Next server process (started from
 * instrumentation.ts). A restart resumes from curve_meta.last_block.
 */

const POLL_MS = 3_000;
const CHUNK = 2_000n;
const ZERO = "0x0000000000000000000000000000000000000000";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

const launchpadEvents = coopLaunchpadAbi.filter(
  (item) =>
    item.type === "event" &&
    ["TokenCreated", "Trade", "Graduated"].includes(item.name)
);

type AnyLog = {
  eventName?: string;
  args?: Record<string, unknown>;
  address: Address;
  blockNumber: bigint | null;
  logIndex: number | null;
  transactionHash: `0x${string}` | null;
};

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

class CurveIndexer {
  private client: PublicClient;
  private launchpad: Address;
  private tokens = new Set<string>();
  private tokensLoaded = false;
  private genesisChecked = false;
  private blockTs = new Map<bigint, Date>();

  constructor() {
    this.client = createPublicClient({
      chain: activeChain(),
      transport: http(),
    });
    this.launchpad = launchpadAddress();
  }

  async run(): Promise<void> {
    // Never let the loop die; log and retry.
    for (;;) {
      try {
        await this.tick();
      } catch (err) {
        console.error("[curve-indexer]", err instanceof Error ? err.message : err);
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }

  private async loadTokens(db: CurveDb): Promise<void> {
    if (this.tokensLoaded) return;
    const res = await db.query<{ address: string }>(
      "SELECT address FROM curve_tokens"
    );
    for (const row of res.rows) this.tokens.add(row.address.toLowerCase());
    this.tokensLoaded = true;
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

  /** A fresh anvil (or redeployed chain) invalidates the whole index — detect it
   * by genesis hash and start over instead of stalling on a stale last_block. */
  private async resetIfChainChanged(db: CurveDb): Promise<void> {
    if (this.genesisChecked) return;
    const genesis = (await this.client.getBlock({ blockNumber: 0n })).hash;
    const stored = await getMeta(db, "genesis_hash");
    if (stored && stored !== genesis) {
      console.warn("[curve-indexer] chain genesis changed — resetting index");
      await db.query("DELETE FROM curve_trades");
      await db.query("DELETE FROM curve_holders");
      await db.query("DELETE FROM curve_tokens");
      await db.query("DELETE FROM curve_meta");
      this.tokens.clear();
      this.tokensLoaded = false;
      this.blockTs.clear();
    }
    await setMeta(db, "genesis_hash", genesis ?? "");
    this.genesisChecked = true;
  }

  private async tick(): Promise<void> {
    const db = await curveDb();
    await this.resetIfChainChanged(db);
    await this.loadTokens(db);

    const latest = await this.client.getBlockNumber();
    const lastRaw = await getMeta(db, "last_block");
    let from: bigint;
    if (lastRaw !== null) {
      from = BigInt(lastRaw) + 1n;
    } else {
      const start = process.env.EVM_INDEXER_START_BLOCK?.trim();
      from = start ? BigInt(start) : latest;
    }
    if (from > latest) return;

    while (from <= latest) {
      const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
      await this.processRange(db, from, to);
      await setMeta(db, "last_block", to.toString());
      from = to + 1n;
    }
  }

  private async processRange(db: CurveDb, fromBlock: bigint, toBlock: bigint): Promise<void> {
    const launchpadLogs = (await this.client.getLogs({
      address: this.launchpad,
      events: launchpadEvents as never,
      fromBlock,
      toBlock,
    })) as unknown as AnyLog[];

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

    // New tokens created inside this range need their transfers from the same
    // range too (dev buys land in the creation block).
    const newTokens = launchpadLogs
      .filter((l) => l.eventName === "TokenCreated")
      .map((l) => (l.args?.token as string).toLowerCase())
      .filter((t) => !this.tokens.has(t));
    if (newTokens.length > 0) {
      const extra = (await this.client.getLogs({
        address: newTokens as Address[],
        event: transferEvent,
        fromBlock,
        toBlock,
      })) as unknown as AnyLog[];
      transferLogs.push(...extra);
    }

    const all = [...launchpadLogs, ...transferLogs].sort((a, b) => {
      const bn = (a.blockNumber ?? 0n) - (b.blockNumber ?? 0n);
      if (bn !== 0n) return bn < 0n ? -1 : 1;
      return (a.logIndex ?? 0) - (b.logIndex ?? 0);
    });

    for (const log of all) {
      if (log.eventName === "TokenCreated") await this.onTokenCreated(db, log);
      else if (log.eventName === "Trade") await this.onTrade(db, log);
      else if (log.eventName === "Graduated") await this.onGraduated(db, log);
      else if (log.eventName === "Transfer") await this.onTransfer(db, log);
    }
  }

  private async onTokenCreated(db: CurveDb, log: AnyLog): Promise<void> {
    const args = log.args ?? {};
    const token = (args.token as string).toLowerCase();
    const uri = (args.metadataURI as string) ?? "";
    const ts = await this.tsOf(log.blockNumber ?? 0n);

    await db.query(
      `INSERT INTO curve_tokens
         (address, creator, flavor, name, symbol, metadata_uri, v_eth, v_token, created_block, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (address) DO NOTHING`,
      [
        token,
        (args.creator as string).toLowerCase(),
        Number(args.flavor ?? 0),
        (args.name as string) ?? "",
        (args.symbol as string) ?? "",
        uri,
        "1250000000000000000", // VIRTUAL_ETH_RESERVE
        "1073000000000000000000000000", // VIRTUAL_TOKEN_RESERVE
        (log.blockNumber ?? 0n).toString(),
        ts,
      ]
    );
    this.tokens.add(token);
    void fetchMetadata(db, token, uri);
  }

  private async onTrade(db: CurveDb, log: AnyLog): Promise<void> {
    const args = log.args ?? {};
    const token = (args.token as string).toLowerCase();
    const vEth = args.vEthAfter as bigint;
    const vToken = args.vTokenAfter as bigint;
    const ethAmount = args.ethAmount as bigint;
    const ts = await this.tsOf(log.blockNumber ?? 0n);

    await db.query(
      `INSERT INTO curve_trades
         (tx_hash, log_index, token, trader, is_buy, eth_wei, token_amount, fee_wei,
          v_eth, v_token, price, block_number, ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (tx_hash, log_index) DO NOTHING`,
      [
        log.transactionHash ?? "",
        log.logIndex ?? 0,
        token,
        (args.trader as string).toLowerCase(),
        Boolean(args.isBuy),
        ethAmount.toString(),
        (args.tokenAmount as bigint).toString(),
        (args.feeEth as bigint).toString(),
        vEth.toString(),
        vToken.toString(),
        Number(vEth) / Number(vToken),
        (log.blockNumber ?? 0n).toString(),
        ts,
      ]
    );
    await db.query(
      `UPDATE curve_tokens
         SET v_eth = $2, v_token = $3,
             trade_count = trade_count + 1,
             volume_wei = volume_wei + $4,
             last_trade_at = $5
       WHERE address = $1`,
      [token, vEth.toString(), vToken.toString(), ethAmount.toString(), ts]
    );
  }

  private async onGraduated(db: CurveDb, log: AnyLog): Promise<void> {
    const args = log.args ?? {};
    const ts = await this.tsOf(log.blockNumber ?? 0n);
    await db.query(
      `UPDATE curve_tokens SET phase = 2, pair = $2, graduated_at = $3 WHERE address = $1`,
      [
        (args.token as string).toLowerCase(),
        ((args.pool as string) ?? "").toLowerCase(),
        ts,
      ]
    );
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
    `[curve-indexer] starting on ${activeChain().name} for ${launchpadAddress()}`
  );
  void new CurveIndexer().run();
}
