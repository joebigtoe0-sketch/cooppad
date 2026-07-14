import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { moonpadDataPath } from "@/lib/server/moonpadDataPath";

export type TreasuryRecord = {
  mint: string;
  /** Display name / ticker at lay time (older rows may omit). */
  tokenName?: string;
  tokenTicker?: string;
  treasuryPublicKey: string;
  treasurySecretKey: number[];
  createdAt: string;
};

function treasuryFile(): string {
  return moonpadDataPath("treasury-by-mint.json");
}

async function ensureDir() {
  await mkdir(path.dirname(treasuryFile()), { recursive: true });
}

/** All treasury JSON paths that exist (moonpad/.data first, then root .data). */
function treasuryJsonPathsForRead(): string[] {
  const directly = path.join(process.cwd(), ".data", "treasury-by-mint.json");
  const nested = path.join(process.cwd(), "moonpad", ".data", "treasury-by-mint.json");
  const paths: string[] = [];
  if (existsSync(nested)) paths.push(nested);
  if (existsSync(directly)) paths.push(directly);
  return [...new Set(paths)];
}

/** Unique mint base58 strings from treasury log (order preserved, newest last per file). */
export async function readTreasuryMintBase58List(): Promise<string[]> {
  const scanned = treasuryJsonPathsForRead();
  const files = scanned.length > 0 ? scanned : [treasuryFile()];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const FILE of files) {
    try {
      const raw = await readFile(FILE, "utf8");
      const list = JSON.parse(raw) as TreasuryRecord[];
      if (!Array.isArray(list)) continue;
      for (const row of list) {
        const m = row.mint?.trim();
        if (!m || seen.has(m)) continue;
        seen.add(m);
        out.push(m);
      }
    } catch {
      /* missing or invalid */
    }
  }
  return out;
}

/** Latest row for a mint (later entries in the same file win). */
export async function findTreasuryRecordByMint(
  mint: string
): Promise<TreasuryRecord | null> {
  const want = mint.trim();
  let found: TreasuryRecord | null = null;
  for (const FILE of treasuryJsonPathsForRead()) {
    try {
      const raw = await readFile(FILE, "utf8");
      const list = JSON.parse(raw) as TreasuryRecord[];
      if (!Array.isArray(list)) continue;
      for (const row of list) {
        if (row.mint?.trim() === want) found = row;
      }
    } catch {
      /* skip */
    }
  }
  return found;
}

export async function appendTreasuryRecord(record: TreasuryRecord): Promise<void> {
  await ensureDir();
  const FILE = treasuryFile();
  let list: TreasuryRecord[] = [];
  try {
    const raw = await readFile(FILE, "utf8");
    list = JSON.parse(raw) as TreasuryRecord[];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  list.push(record);
  await writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}
