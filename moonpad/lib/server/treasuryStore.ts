import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type TreasuryRecord = {
  mint: string;
  treasuryPublicKey: string;
  treasurySecretKey: number[];
  createdAt: string;
};

const FILE = path.join(process.cwd(), ".data", "treasury-by-mint.json");

async function ensureDir() {
  await mkdir(path.dirname(FILE), { recursive: true });
}

export async function appendTreasuryRecord(record: TreasuryRecord): Promise<void> {
  await ensureDir();
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
