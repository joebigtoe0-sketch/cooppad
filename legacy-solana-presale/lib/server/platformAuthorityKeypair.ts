import { Keypair } from "@solana/web3.js";

/** Same JSON-array format as Solana CLI keypair export / `PLATFORM_AUTHORITY_SECRET` in `.env.local`. */
export function loadPlatformAuthorityKeypair(): Keypair {
  const raw = process.env.PLATFORM_AUTHORITY_SECRET;
  if (!raw?.trim()) {
    throw new Error(
      "PLATFORM_AUTHORITY_SECRET is not set (JSON byte array, same format as Solana keypair file)"
    );
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.length < 64) {
    throw new Error(
      "PLATFORM_AUTHORITY_SECRET must be a JSON array of 64 numbers (secret key bytes)"
    );
  }
  return Keypair.fromSecretKey(Uint8Array.from(parsed.map(Number)));
}
