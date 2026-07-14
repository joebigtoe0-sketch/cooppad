/**
 * Sweep all SOL from treasury keypairs in .data/treasury-by-mint.json → destination.
 * Uses .keys/platform-authority.json as fee payer so treasuries can be drained to 0.
 *
 * Usage (from moonpad/): node scripts/sweep-treasuries.cjs
 */
const fs = require("fs");
const path = require("path");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const DEST = new PublicKey("C7bttWUQDVGjxtUpAh1n18vRwQrbTaxV2kVmMkgD16xF");
const ROOT = path.join(__dirname, "..");
const TREASURY_FILE = path.join(ROOT, ".data", "treasury-by-mint.json");
const PLATFORM_FILE = path.join(ROOT, ".keys", "platform-authority.json");

const RPC =
  process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

async function main() {
  const platformSecret = JSON.parse(fs.readFileSync(PLATFORM_FILE, "utf8"));
  const platformKp = Keypair.fromSecretKey(Uint8Array.from(platformSecret));
  if (!platformKp.publicKey.equals(DEST)) {
    throw new Error(
      `Platform keypair ${platformKp.publicKey.toBase58()} !== destination ${DEST.toBase58()}`
    );
  }

  const list = JSON.parse(fs.readFileSync(TREASURY_FILE, "utf8"));
  if (!Array.isArray(list)) throw new Error("treasury-by-mint.json must be an array");

  const connection = new Connection(RPC, "confirmed");
  const seen = new Set();

  for (const row of list) {
    const pub = row.treasuryPublicKey;
    if (!pub || seen.has(pub)) continue;
    seen.add(pub);

    const sk = row.treasurySecretKey;
    if (!Array.isArray(sk) || sk.length < 64) {
      console.warn("Skip (bad secret):", pub);
      continue;
    }

    const treasuryKp = Keypair.fromSecretKey(Uint8Array.from(sk));
    if (treasuryKp.publicKey.toBase58() !== pub) {
      console.warn("Skip (pub/sk mismatch):", pub);
      continue;
    }

    const bal = await connection.getBalance(treasuryKp.publicKey);
    if (bal === 0) {
      console.log("Empty:", pub);
      continue;
    }

    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction({
      feePayer: platformKp.publicKey,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: treasuryKp.publicKey,
        toPubkey: DEST,
        lamports: bal,
      })
    );

    const sig = await sendAndConfirmTransaction(
      connection,
      tx,
      [platformKp, treasuryKp],
      { commitment: "confirmed" }
    );

    console.log(
      `Swept ${bal} lamports from ${pub} → ${DEST.toBase58()}  ${sig}`
    );
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
