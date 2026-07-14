/**
 * Devnet flow: sweep LP SOL + tokens to the sale treasury, create Meteora CP-AMM (DAMM v2)
 * `initialize_customizable_pool` via @meteora-ag/cp-amm-sdk, then register pool + position NFT on PresaleState.
 *
 * Prerequisites:
 * - Presale launched; `presale_state.pool` still default; vault still holds LP SOL + token_vault has lp_tokens_amount.
 * - Treasury keypair (COOP) matches `presale_state.treasury` and has SOL for fees/rent.
 * - Platform keypair matches on-chain `PLATFORM_AUTHORITY_PUBKEY`.
 * - Project mint treasury ATA exists (create before sweep if needed).
 *
 * Usage (from moonpad/):
 *   set SOLANA_RPC_URL=https://api.devnet.solana.com
 *   set NEXT_PUBLIC_PROGRAM_ID=<moonpad program id>
 *   node scripts/meteora-dammv2-devnet.cjs <MINT_PUBKEY> [--skip-sweep] [--skip-pool] [--skip-register]
 *
 * Optional env:
 *   PLATFORM_KEYPAIR   — path to platform JSON keypair (default: .keys/platform-authority.json)
 *   TREASURY_JSON      — path to treasury-by-mint list (default: .data/treasury-by-mint.json)
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} = require("@solana/spl-token");
const { Program, AnchorProvider, Wallet, BN } = require("@coral-xyz/anchor");
const {
  CpAmm,
  CollectFeeMode,
  ActivationType,
  BaseFeeMode,
  getBaseFeeParams,
  getDynamicFeeParams,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE,
} = require("@meteora-ag/cp-amm-sdk");

const ROOT = path.join(__dirname, "..");
const DEFAULT_PLATFORM_KEYPAIR = path.join(ROOT, ".keys", "platform-authority.json");
const DEFAULT_TREASURY_JSON = path.join(ROOT, ".data", "treasury-by-mint.json");
const IDL_PATH = path.join(ROOT, "public", "idl", "moonpad.json");

const LP_NUM = 80n;
const LP_DEN = 85n;
const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

function loadKeypairJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(raw)) {
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  if (raw._keypair) {
    return Keypair.fromSecretKey(Uint8Array.from(raw._keypair.secretKey));
  }
  throw new Error(`Unrecognized keypair format: ${filePath}`);
}

function findTreasuryForMint(listPath, mintStr) {
  const raw = JSON.parse(fs.readFileSync(listPath, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error(`Expected array in ${listPath}`);
  }
  const row = raw.find((e) => e.mint === mintStr);
  if (!row || !Array.isArray(row.treasurySecretKey)) {
    throw new Error(`No treasurySecretKey for mint ${mintStr} in ${listPath}`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(row.treasurySecretKey));
}

function presalePda(programId, mint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("presale"), mint.toBuffer()],
    programId
  )[0];
}

function vaultPda(programId, mint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), mint.toBuffer()],
    programId
  )[0];
}

function tokenVaultPda(programId, mint) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("token_vault"), mint.toBuffer()],
    programId
  )[0];
}

function parseArgs(argv) {
  const args = argv.slice(2).filter((a) => a !== "--");
  const flags = new Set();
  const positional = [];
  for (const a of args) {
    if (a.startsWith("--")) flags.add(a);
    else positional.push(a);
  }
  return { flags, positional };
}

async function ensureTreasuryMintAta(conn, mint, treasuryKp) {
  const ata = getAssociatedTokenAddressSync(
    mint,
    treasuryKp.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const ix = createAssociatedTokenAccountIdempotentInstruction(
    treasuryKp.publicKey,
    ata,
    treasuryKp.publicKey,
    mint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const bh = await conn.getLatestBlockhash();
  const tx = new Transaction({
    feePayer: treasuryKp.publicKey,
    recentBlockhash: bh.blockhash,
  }).add(ix);
  tx.sign(treasuryKp);
  const sig = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await conn.confirmTransaction(
    { signature: sig, ...bh },
    "confirmed"
  );
  return ata;
}

async function main() {
  const { flags, positional } = parseArgs(process.argv);
  const mintStr = positional[0];
  if (!mintStr) {
    console.error(
      "Usage: node scripts/meteora-dammv2-devnet.cjs <MINT> [--skip-sweep] [--skip-pool] [--skip-register]"
    );
    process.exit(1);
  }

  try {
    require("dotenv").config({ path: path.join(ROOT, ".env.local") });
  } catch (_) {
    /* optional */
  }
  try {
    require("dotenv").config({ path: path.join(ROOT, ".env") });
  } catch (_) {
    /* optional */
  }

  const rpc =
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://api.devnet.solana.com";
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const programId = new PublicKey(
    process.env.NEXT_PUBLIC_PROGRAM_ID || idl.metadata?.address || idl.address
  );

  const mint = new PublicKey(mintStr);
  const conn = new Connection(rpc, "confirmed");

  const platformPath =
    process.env.PLATFORM_KEYPAIR || DEFAULT_PLATFORM_KEYPAIR;
  const treasuryListPath =
    process.env.TREASURY_JSON || DEFAULT_TREASURY_JSON;

  const platformKp = loadKeypairJson(platformPath);
  const treasuryKp = findTreasuryForMint(treasuryListPath, mintStr);

  const presalePk = presalePda(programId, mint);
  const vaultPk = vaultPda(programId, mint);
  const tokenVaultPk = tokenVaultPda(programId, mint);

  const platformProvider = new AnchorProvider(
    conn,
    new Wallet(platformKp),
    { commitment: "confirmed" }
  );
  const program = new Program(idl, programId, platformProvider);

  const state = await program.account.presaleState.fetch(presalePk);
  if (!state.launched) {
    throw new Error("Presale not launched");
  }
  const defaultPk = PublicKey.default;
  if (!state.pool.equals(defaultPk)) {
    throw new Error(
      `Presale already has pool ${state.pool.toBase58()} — register/sweep are one-shot`
    );
  }

  const treasuryPk = state.treasury;
  if (!treasuryPk.equals(treasuryKp.publicKey)) {
    throw new Error(
      `Treasury keypair ${treasuryKp.publicKey.toBase58()} !== presale treasury ${treasuryPk.toBase58()}`
    );
  }

  const totalRaised = BigInt(state.totalRaised.toString());
  const lpSol = (totalRaised * LP_NUM) / LP_DEN;
  const lpTokens = BigInt(state.lpTokensAmount.toString());

  console.log("Mint", mint.toBase58());
  console.log("Presale", presalePk.toBase58());
  console.log("Treasury", treasuryPk.toBase58());
  console.log("LP leg: SOL lamports", lpSol.toString(), "tokens raw", lpTokens.toString());

  let treasuryMintAta = getAssociatedTokenAddressSync(
    mint,
    treasuryPk,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const info = await conn.getAccountInfo(treasuryMintAta);
  if (!info && !flags.has("--skip-sweep")) {
    console.log("Creating treasury ATA for project mint…");
    treasuryMintAta = await ensureTreasuryMintAta(conn, mint, treasuryKp);
  }

  if (!flags.has("--skip-sweep")) {
    console.log("Sending sweep_lp_for_meteora (platform signs)…");
    const sig = await program.methods
      .sweepLpForMeteora()
      .accounts({
        platformAuthority: platformKp.publicKey,
        mint,
        presaleState: presalePk,
        vault: vaultPk,
        tokenVault: tokenVaultPk,
        treasury: treasuryPk,
        treasuryTokenAccount: treasuryMintAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Sweep ok:", sig);
  } else {
    console.log("Skipped sweep (--skip-sweep)");
  }

  if (flags.has("--skip-pool")) {
    console.log("Stopped after sweep (--skip-pool)");
    return;
  }

  const tokenAMint =
    Buffer.compare(mint.toBuffer(), WSOL.toBuffer()) < 0 ? mint : WSOL;
  const tokenBMint = tokenAMint.equals(mint) ? WSOL : mint;
  const tokenBDecimals = tokenBMint.equals(WSOL) ? 9 : 6;

  const tokenAAmount = tokenAMint.equals(mint)
    ? new BN(lpTokens.toString())
    : new BN(lpSol.toString());
  const tokenBAmount = tokenBMint.equals(mint)
    ? new BN(lpTokens.toString())
    : new BN(lpSol.toString());

  const cpAmm = new CpAmm(conn);
  const collectFeeMode = CollectFeeMode.OnlyB;
  const prepared = cpAmm.preparePoolCreationParams({
    tokenAAmount,
    tokenBAmount,
    minSqrtPrice: MIN_SQRT_PRICE,
    maxSqrtPrice: MAX_SQRT_PRICE,
    collectFeeMode,
  });

  const poolFees = {
    baseFee: getBaseFeeParams(
      {
        baseFeeMode: BaseFeeMode.FeeTimeSchedulerExponential,
        feeTimeSchedulerParam: {
          startingFeeBps: 200,
          endingFeeBps: 50,
          numberOfPeriod: 10,
          totalDuration: 3600,
        },
      },
      tokenBDecimals,
      ActivationType.Timestamp
    ),
    compoundingFeeBps: 0,
    padding: 0,
    dynamicFee: getDynamicFeeParams(100),
  };

  const positionNft = Keypair.generate();
  const payer = treasuryKp.publicKey;

  console.log("Building Meteora initialize_customizable_pool…");
  const { tx: poolTx, pool: poolPk } = await cpAmm.createCustomPool({
    payer,
    creator: payer,
    positionNft: positionNft.publicKey,
    tokenAMint,
    tokenBMint,
    tokenAAmount,
    tokenBAmount,
    sqrtMinPrice: MIN_SQRT_PRICE,
    sqrtMaxPrice: MAX_SQRT_PRICE,
    liquidityDelta: prepared.liquidityDelta,
    initSqrtPrice: prepared.initSqrtPrice,
    poolFees,
    hasAlphaVault: false,
    activationType: ActivationType.Timestamp,
    collectFeeMode,
    activationPoint: null,
    tokenAProgram: TOKEN_PROGRAM_ID,
    tokenBProgram: TOKEN_PROGRAM_ID,
  });

  const bh = await conn.getLatestBlockhash();
  poolTx.recentBlockhash = bh.blockhash;
  poolTx.feePayer = payer;
  poolTx.partialSign(treasuryKp, positionNft);

  console.log("Sending pool tx (treasury + position NFT mint sign)…");
  const poolSig = await conn.sendRawTransaction(poolTx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await conn.confirmTransaction(
    { signature: poolSig, ...bh },
    "confirmed"
  );
  console.log("Pool ok:", poolSig);
  console.log("Pool address:", poolPk.toBase58());
  console.log("Position NFT mint:", positionNft.publicKey.toBase58());

  if (flags.has("--skip-register")) {
    console.log("Skipped register (--skip-register)");
    return;
  }

  console.log("Registering pool on moonpad (platform signs)…");
  const regSig = await program.methods
    .registerMeteoraPool(poolPk, positionNft.publicKey)
    .accounts({
      platformAuthority: platformKp.publicKey,
      mint,
      presaleState: presalePk,
    })
    .rpc();
  console.log("Register ok:", regSig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
