import { Connection, PublicKey } from "@solana/web3.js";

import { PROGRAM_ID } from "@/lib/anchor";
import { decodePresaleAccount } from "@/lib/decodePresaleAccount";
import { findPresaleState } from "@/lib/pda";

function rpcConnection(): Connection {
  const url =
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
  return new Connection(url, "confirmed");
}

function isPlaceholderTokenUri(uri: string): boolean {
  const u = uri.trim().toLowerCase();
  return u === "" || u.includes("moonpad.local");
}

function isSafeHttpUrl(u: string): boolean {
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * If `PresaleState.token_uri` points at Metaplex-style JSON, return its `image` URL
 * (for avatars when no disk cover exists — e.g. Pinata-only flow).
 */
export async function resolveImageUrlFromPresaleTokenUri(
  mintBase58: string
): Promise<string | null> {
  let mintPk: PublicKey;
  try {
    mintPk = new PublicKey(mintBase58);
  } catch {
    return null;
  }

  const [presalePda] = findPresaleState(mintPk);
  const conn = rpcConnection();
  const info = await conn.getAccountInfo(presalePda, "confirmed");
  if (!info?.data) return null;

  const decoded = decodePresaleAccount(Buffer.from(info.data));
  if (!decoded) return null;

  const tokenUri = decoded.tokenUri?.trim() ?? "";
  if (!tokenUri || isPlaceholderTokenUri(tokenUri)) return null;
  if (!isSafeHttpUrl(tokenUri)) return null;

  let json: unknown;
  try {
    const res = await fetch(tokenUri, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  }

  if (!json || typeof json !== "object") return null;
  const image = (json as { image?: unknown }).image;
  if (typeof image !== "string") return null;
  const url = image.trim();
  if (!url || !isSafeHttpUrl(url)) return null;
  return url;
}
