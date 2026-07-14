import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Keypair } from "@solana/web3.js";

import { moonpadDataPath } from "@/lib/server/moonpadDataPath";

export type MintPoolEntry = {
  publicKey: string;
  secretKey: number[];
};

function poolFile(): string {
  return moonpadDataPath("mint-pool.json");
}

export class MintPoolEmptyError extends Error {
  constructor() {
    super(
      "Mint pool is empty. On the server run: node scripts/mine-mint-pool.cjs 100"
    );
    this.name = "MintPoolEmptyError";
  }
}

async function ensureDir() {
  await mkdir(path.dirname(poolFile()), { recursive: true });
}

/** Serialize concurrent use of the pool file. */
let gate: Promise<void> = Promise.resolve();

/**
 * Load first pooled mint, run `fn`, then persist the tail only if `fn` resolves.
 * If `fn` throws, the pool file is unchanged (mint stays available).
 */
export async function withPooledMint<T>(fn: (mintKp: Keypair) => Promise<T>): Promise<T> {
  const prev = gate;
  let release!: () => void;
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;

  try {
    await ensureDir();
    const FILE = poolFile();
    let raw: string;
    try {
      raw = await readFile(FILE, "utf8");
    } catch {
      throw new MintPoolEmptyError();
    }

    const list = JSON.parse(raw) as MintPoolEntry[];
    if (!Array.isArray(list) || list.length === 0) {
      throw new MintPoolEmptyError();
    }

    const [first, ...rest] = list;
    if (
      !first?.publicKey ||
      !Array.isArray(first.secretKey) ||
      first.secretKey.length < 64
    ) {
      throw new Error("Mint pool file is corrupt (bad first entry)");
    }

    const mintKp = Keypair.fromSecretKey(Uint8Array.from(first.secretKey));
    if (mintKp.publicKey.toBase58() !== first.publicKey) {
      throw new Error("Mint pool entry publicKey does not match secretKey");
    }

    const result = await fn(mintKp);
    await writeFile(FILE, JSON.stringify(rest, null, 2), "utf8");
    return result;
  } finally {
    release();
  }
}

export async function readPoolSize(): Promise<number> {
  try {
    const raw = await readFile(poolFile(), "utf8");
    const list = JSON.parse(raw) as MintPoolEntry[];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}
