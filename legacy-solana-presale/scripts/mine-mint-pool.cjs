/**
 * Append vanity mint keypairs to .data/mint-pool.json (default suffix: coop).
 *
 * Uses worker_threads for parallel CPU — much faster than a single JS thread.
 *
 * IMPORTANT: `solana-keygen grind --ends-with X:N` alone is broken on Solana CLI
 * 1.18.x: it sets an internal "skip 44-char pubkey" flag incorrectly for suffix-only
 * searches, so it almost never evaluates matches (huge attempt counts, ~0 hits).
 * Use this script instead, or upgrade the CLI if a fix landed in your version.
 *
 * Usage (from moonpad/):
 *   node scripts/mine-mint-pool.cjs [count] [suffix] [threads]
 *
 * Examples:
 *   node scripts/mine-mint-pool.cjs 100
 *   node scripts/mine-mint-pool.cjs 50 egg 16
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Worker } = require("worker_threads");

const BASE58 =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const ROOT = path.join(__dirname, "..");
const POOL_FILE = path.join(ROOT, ".data", "mint-pool.json");
const WORKER_FILE = path.join(__dirname, "mine-mint-pool-worker.cjs");

const count = Math.max(1, parseInt(process.argv[2] || "100", 10) || 100);
const suffix = (process.argv[3] || "coop").trim();
const threads = Math.max(
  1,
  parseInt(process.argv[4] || String(Math.max(1, os.cpus().length - 1)), 10) || 1
);

function validSuffix(s) {
  if (!s || s.length > 12) return false;
  for (const c of s) {
    if (!BASE58.includes(c)) return false;
  }
  return true;
}

function loadPool() {
  try {
    const raw = fs.readFileSync(POOL_FILE, "utf8");
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function savePool(list) {
  fs.mkdirSync(path.dirname(POOL_FILE), { recursive: true });
  fs.writeFileSync(POOL_FILE, JSON.stringify(list, null, 2), "utf8");
}

async function main() {
  if (!validSuffix(suffix)) {
    console.error("Invalid base58 suffix:", suffix);
    process.exit(1);
  }

  const existing = loadPool();
  const seen = new Set(existing.map((e) => e.publicKey));
  const startLen = existing.length;
  let mined = 0;
  let totalAttempts = 0;
  let lastLogAttempts = 0;
  const logEvery = 500_000;

  console.log(
    `Mining ${count} mint(s) ending with "${suffix}" (pool had ${existing.length}, ${threads} workers)…`
  );

  const workers = [];

  function appendHit(pub, secretKey) {
    if (mined >= count || seen.has(pub)) return;
    seen.add(pub);
    existing.push({ publicKey: pub, secretKey });
    mined++;
    savePool(existing);
    console.log(`  [${mined}/${count}] ${pub}`);
  }

  for (let i = 0; i < threads; i++) {
    const w = new Worker(WORKER_FILE, {
      workerData: { suffix, reportEvery: 250_000 },
    });
    w.on("message", (msg) => {
      if (msg.type === "progress") {
        totalAttempts += msg.n;
        lastLogAttempts += msg.n;
        if (lastLogAttempts >= logEvery) {
          console.log(
            `  …~${totalAttempts.toLocaleString()} attempts, +${mined} this run`
          );
          lastLogAttempts = 0;
        }
      } else if (msg.type === "hit") {
        appendHit(msg.publicKey, msg.secretKey);
      }
    });
    w.on("error", (err) => {
      console.error("Worker error:", err);
    });
    workers.push(w);
  }

  await new Promise((resolve) => {
    const iv = setInterval(() => {
      if (mined >= count) {
        clearInterval(iv);
        for (const w of workers) {
          try {
            w.terminate();
          } catch {
            /* ignore */
          }
        }
        let left = workers.length;
        if (left === 0) {
          resolve();
          return;
        }
        for (const w of workers) {
          w.once("exit", () => {
            left--;
            if (left === 0) resolve();
          });
        }
      }
    }, 100);
  });

  console.log(
    `Done. Pool size ${startLen} → ${existing.length} (≈${totalAttempts.toLocaleString()} attempts reported by workers)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
