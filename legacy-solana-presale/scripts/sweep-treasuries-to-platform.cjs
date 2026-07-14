/**
 * Sweep almost all SOL from each unique treasury in .data/treasury-by-mint.json
 * to the platform authority (leaves rent-exempt minimum + fee buffer per wallet).
 *
 * Usage (from moonpad/):
 *   node scripts/sweep-treasuries-to-platform.cjs <DESTINATION_PUBKEY>
 *
 * RPC: SOLANA_RPC_URL or NEXT_PUBLIC_RPC_URL or devnet default.
 */
const fs = require("fs");
const path = require("path");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} = require("@solana/web3.js");

const ROOT = path.join(__dirname, "..");
const TREASURY_FILE = path.join(ROOT, ".data", "treasury-by-mint.json");
const FEE_BUFFER_LAMPORTS = 10_000;

async function main() {
  const destStr = process.argv[2];
  if (!destStr) {
    console.error("Usage: node scripts/sweep-treasuries-to-platform.cjs <DESTINATION>");
    process.exit(1);
  }
  const destination = new PublicKey(destStr);

  const rpc =
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");

  const raw = JSON.parse(fs.readFileSync(TREASURY_FILE, "utf8"));
  if (!Array.isArray(raw)) {
    console.error("treasury-by-mint.json must be an array");
    process.exit(1);
  }

  /** @type {Map<string, Keypair>} */
  const byPub = new Map();
  for (const row of raw) {
    if (!row?.treasurySecretKey || !Array.isArray(row.treasurySecretKey)) continue;
    const kp = Keypair.fromSecretKey(Uint8Array.from(row.treasurySecretKey));
    const pk = kp.publicKey.toBase58();
    if (pk === destination.toBase58()) continue;
    byPub.set(pk, kp);
  }

  const rent = await connection.getMinimumBalanceForRentExemption(0);
  let totalSent = 0n;

  for (const [pk58, kp] of byPub) {
    const balance = await connection.getBalance(kp.publicKey);
    const send = balance - rent - FEE_BUFFER_LAMPORTS;
    if (send <= 0) {
      console.log(`${pk58}: skip (balance ${balance} ≤ rent+buffer)`);
      continue;
    }
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: kp.publicKey,
        toPubkey: destination,
        lamports: send,
      })
    );
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = kp.publicKey;
    tx.sign(kp);
    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    totalSent += BigInt(send);
    console.log(`${pk58}: sent ${send} lamports → ${destination.toBase58()} (${sig})`);
  }

  console.log(`Done. Total swept (lamports): ${totalSent.toString()}`);
  const destBal = await connection.getBalance(destination);
  console.log(`Destination balance now: ${destBal}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
