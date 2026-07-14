import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";

import { PublicKey } from "@solana/web3.js";

import { moonpadDataDir } from "@/lib/server/moonpadDataPath";

function imageDir(): string {
  return path.join(moonpadDataDir(), "presale-images");
}

const MAX_BYTES = 1_500_000;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "bin";
}

function filePathForMint(mint: string, ext: string): string {
  return path.join(imageDir(), `${mint}.${ext}`);
}

export async function savePresaleCover(
  mintBase58: string,
  buf: Buffer,
  mime: string
): Promise<void> {
  const pk = new PublicKey(mintBase58);
  const canonical = pk.toBase58();
  if (canonical !== mintBase58.trim()) {
    throw new Error("Use the canonical mint address string from the API");
  }
  if (!ALLOWED.has(mime)) {
    throw new Error("Only PNG, JPEG, or WebP images are allowed");
  }
  if (buf.length > MAX_BYTES) {
    throw new Error(`Image too large (max ${MAX_BYTES / 1000}KB)`);
  }

  const magicOk =
    (mime === "image/png" &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47) ||
    (mime === "image/jpeg" && buf[0] === 0xff && buf[1] === 0xd8) ||
    (mime === "image/webp" &&
      buf.toString("ascii", 0, 4) === "RIFF" &&
      buf.toString("ascii", 8, 12) === "WEBP");
  if (!magicOk) {
    throw new Error("File content does not match image type");
  }

  await mkdir(imageDir(), { recursive: true });
  const ext = extForMime(mime);
  for (const other of ["png", "jpg", "webp"] as const) {
    if (other === ext) continue;
    try {
      await unlink(filePathForMint(canonical, other));
    } catch {
      /* absent */
    }
  }
  await writeFile(filePathForMint(canonical, ext), buf);
}

export async function readPresaleCover(
  mintBase58: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  let canonical: string;
  try {
    canonical = new PublicKey(mintBase58).toBase58();
  } catch {
    return null;
  }
  for (const ext of ["webp", "png", "jpg"] as const) {
    const p = filePathForMint(canonical, ext);
    try {
      const st = await stat(p);
      if (!st.isFile()) continue;
      const buffer = await readFile(p);
      const contentType =
        ext === "png"
          ? "image/png"
          : ext === "jpg"
            ? "image/jpeg"
            : "image/webp";
      return { buffer, contentType };
    } catch {
      continue;
    }
  }
  return null;
}
