import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  CpAmm,
  getBaseFeeParams,
  getDynamicFeeParams,
  MAX_SQRT_PRICE,
  MIN_SQRT_PRICE,
} from "@meteora-ag/cp-amm-sdk";

import { MOONPAD_IDL, PLATFORM_AUTHORITY, PROGRAM_ID } from "@/lib/anchor";
import { decodePresaleAccount } from "@/lib/decodePresaleAccount";
import {
  buildLaunchPresaleTx,
  buildRegisterMeteoraPoolTx,
  buildSweepLpForMeteoraTx,
} from "@/lib/instructions";
import { POST_GOAL_LAUNCH_DELAY_SECS } from "@/lib/presaleConstants";
import { findPresaleState } from "@/lib/pda";
import { loadPlatformAuthorityKeypair } from "@/lib/server/platformAuthorityKeypair";
import {
  findTreasuryRecordByMint,
  readTreasuryMintBase58List,
} from "@/lib/server/treasuryStore";
import { walletFromKeypair } from "@/lib/server/walletFromKeypair";
import type { PresaleDecoded } from "@/types";

const LP_NUM = 80n;
const LP_DEN = 85n;
const DEFAULT_PUBKEY = PublicKey.default.toBase58();

function presalePda(mint: PublicKey): PublicKey {
  return findPresaleState(mint)[0];
}

async function fetchDecoded(
  connection: Connection,
  mint: PublicKey
): Promise<PresaleDecoded | null> {
  const pda = presalePda(mint);
  const info = await connection.getAccountInfo(pda, "confirmed");
  if (!info?.owner.equals(PROGRAM_ID)) return null;
  return decodePresaleAccount(Buffer.from(info.data));
}

function canLaunchNow(dec: PresaleDecoded, now: Date): boolean {
  if (dec.launched || dec.refundEnabled) return false;
  if (!dec.goalReachedAt) return false;
  if (dec.totalRaised < dec.raiseTarget) return false;
  const unlockMs =
    dec.goalReachedAt.getTime() + POST_GOAL_LAUNCH_DELAY_SECS * 1000;
  return now.getTime() >= unlockMs;
}

function poolUnset(dec: PresaleDecoded): boolean {
  return !dec.pool || dec.pool === DEFAULT_PUBKEY;
}

async function ensureTreasuryMintAta(
  connection: Connection,
  mint: PublicKey,
  treasuryKp: Keypair
): Promise<PublicKey> {
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
  const bh = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: treasuryKp.publicKey,
    recentBlockhash: bh.blockhash,
  }).add(ix);
  tx.sign(treasuryKp);
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 2,
  });
  await connection.confirmTransaction(
    { signature: sig, ...bh },
    "confirmed"
  );
  return ata;
}

export type EggHatchAttempt = {
  mint: string;
  launch: "skipped" | "already" | "sent" | "error";
  meteora: "skipped" | "ok" | "error" | "partial";
  messages: string[];
};

export type MeteoraLiquidityResult = {
  ok: boolean;
  status: "ok" | "skipped" | "error";
  messages: string[];
  /** Set when status is ok or pool was already registered (skipped). */
  poolAddress?: string;
};

/**
 * Sweep LP → Meteora `initialize_customizable_pool` → `register_meteora_pool`.
 * Requires `launched`, `pool` still default, treasury row + `PLATFORM_AUTHORITY_SECRET`.
 */
export async function runMeteoraLiquidityForMint(
  connection: Connection,
  mintStr: string
): Promise<MeteoraLiquidityResult> {
  const messages: string[] = [];
  let mint: PublicKey;
  try {
    mint = new PublicKey(mintStr);
  } catch {
    return { ok: false, status: "error", messages: ["invalid mint"] };
  }

  if (process.env.DISABLE_AUTO_METEORA_POOL === "1") {
    messages.push("DISABLE_AUTO_METEORA_POOL=1");
    return { ok: false, status: "skipped", messages };
  }

  const dec = await fetchDecoded(connection, mint);
  if (!dec) {
    messages.push("presale account missing");
    return { ok: false, status: "error", messages };
  }
  if (!dec.launched) {
    messages.push("not launched yet");
    return { ok: false, status: "skipped", messages };
  }
  if (!poolUnset(dec)) {
    messages.push(`pool already registered: ${dec.pool}`);
    return {
      ok: true,
      status: "skipped",
      messages,
      poolAddress: dec.pool,
    };
  }

  try {
    const row = await findTreasuryRecordByMint(mintStr);
    if (!row?.treasurySecretKey?.length) {
      messages.push("missing treasury secret in treasury-by-mint store");
      return { ok: false, status: "error", messages };
    }
    const treasuryKp = Keypair.fromSecretKey(
      Uint8Array.from(row.treasurySecretKey)
    );
    const treasuryPk = new PublicKey(dec.treasury);
    if (!treasuryKp.publicKey.equals(treasuryPk)) {
      messages.push("treasury keypair does not match on-chain treasury");
      return { ok: false, status: "error", messages };
    }

    let treasuryMintAta = getAssociatedTokenAddressSync(
      mint,
      treasuryPk,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const ataInfo = await connection.getAccountInfo(treasuryMintAta, "confirmed");
    if (!ataInfo) {
      messages.push("creating treasury token ATA");
      treasuryMintAta = await ensureTreasuryMintAta(
        connection,
        mint,
        treasuryKp
      );
    }

    const platformKp = loadPlatformAuthorityKeypair();
    if (!platformKp.publicKey.equals(PLATFORM_AUTHORITY)) {
      messages.push("platform secret pubkey !== NEXT_PUBLIC_PLATFORM_AUTHORITY");
      return { ok: false, status: "error", messages };
    }

    const platWallet = walletFromKeypair(platformKp);
    const platProvider = new AnchorProvider(connection, platWallet, {
      commitment: "confirmed",
    });
    const pProgram = new Program(MOONPAD_IDL as Idl, platProvider);

    const sweepTx = await buildSweepLpForMeteoraTx(
      pProgram,
      mint,
      treasuryPk,
      treasuryMintAta
    );
    const sbh = await connection.getLatestBlockhash("confirmed");
    sweepTx.recentBlockhash = sbh.blockhash;
    sweepTx.feePayer = platformKp.publicKey;
    sweepTx.sign(platformKp);
    const sweepSig = await connection.sendRawTransaction(sweepTx.serialize(), {
      skipPreflight: false,
      maxRetries: 2,
    });
    await connection.confirmTransaction(
      { signature: sweepSig, ...sbh },
      "confirmed"
    );
    messages.push(`sweep_lp_for_meteora ${sweepSig}`);

    const WSOL = new PublicKey(
      "So11111111111111111111111111111111111111112"
    );
    const totalRaised = BigInt(dec.totalRaised.toString());
    const lpSol = (totalRaised * LP_NUM) / LP_DEN;
    const lpTokens = BigInt(dec.lpTokensAmount.toString());

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

    const cpAmm = new CpAmm(connection);
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

    const pbh = await connection.getLatestBlockhash("confirmed");
    poolTx.recentBlockhash = pbh.blockhash;
    poolTx.feePayer = payer;
    poolTx.partialSign(treasuryKp, positionNft);
    const poolSig = await connection.sendRawTransaction(poolTx.serialize(), {
      skipPreflight: false,
      maxRetries: 2,
    });
    await connection.confirmTransaction(
      { signature: poolSig, ...pbh },
      "confirmed"
    );
    messages.push(`meteora pool ${poolSig} pool=${poolPk.toBase58()}`);

    const regTx = await buildRegisterMeteoraPoolTx(
      pProgram,
      mint,
      poolPk,
      positionNft.publicKey
    );
    const rbh = await connection.getLatestBlockhash("confirmed");
    regTx.recentBlockhash = rbh.blockhash;
    regTx.feePayer = platformKp.publicKey;
    regTx.sign(platformKp);
    const regSig = await connection.sendRawTransaction(regTx.serialize(), {
      skipPreflight: false,
      maxRetries: 2,
    });
    await connection.confirmTransaction(
      { signature: regSig, ...rbh },
      "confirmed"
    );
    messages.push(`register_meteora_pool ${regSig}`);

    return {
      ok: true,
      status: "ok",
      messages,
      poolAddress: poolPk.toBase58(),
    };
  } catch (e) {
    messages.push(
      `meteora: ${e instanceof Error ? e.message : String(e)}`
    );
    return { ok: false, status: "error", messages };
  }
}

/**
 * Server-only: treasury signs `launch_presale` when the hatch timer has passed, then (unless
 * `DISABLE_AUTO_METEORA_POOL=1`) platform + treasury run sweep → Meteora pool → register.
 */
export async function tryCompleteEggHatchForMint(
  mintStr: string,
  connection: Connection
): Promise<EggHatchAttempt> {
  const messages: string[] = [];
  const out: EggHatchAttempt = {
    mint: mintStr,
    launch: "skipped",
    meteora: "skipped",
    messages,
  };

  let mint: PublicKey;
  try {
    mint = new PublicKey(mintStr);
  } catch {
    out.launch = "error";
    messages.push("invalid mint");
    return out;
  }

  const now = new Date();
  let dec = await fetchDecoded(connection, mint);
  if (!dec) {
    out.launch = "error";
    messages.push("presale account missing");
    return out;
  }

  if (dec.launched) {
    out.launch = "already";
    messages.push("already launched");
  } else if (!canLaunchNow(dec, now)) {
    out.launch = "skipped";
    messages.push("not eligible for launch yet");
    return out;
  } else {
    const row = await findTreasuryRecordByMint(mintStr);
    if (!row?.treasurySecretKey?.length) {
      out.launch = "error";
      messages.push("no treasury key in treasury-by-mint store");
      return out;
    }
    const treasuryKp = Keypair.fromSecretKey(
      Uint8Array.from(row.treasurySecretKey)
    );
    const treasuryPk = new PublicKey(dec.treasury);
    if (!treasuryKp.publicKey.equals(treasuryPk)) {
      out.launch = "error";
      messages.push("treasury keypair does not match on-chain treasury");
      return out;
    }

    const treasuryWallet = walletFromKeypair(treasuryKp);
    const treasuryProvider = new AnchorProvider(connection, treasuryWallet, {
      commitment: "confirmed",
    });
    const tProgram = new Program(MOONPAD_IDL as Idl, treasuryProvider);

    const launchTx = await buildLaunchPresaleTx(
      tProgram,
      treasuryKp.publicKey,
      mint,
      treasuryPk
    );
    const bh = await connection.getLatestBlockhash("confirmed");
    launchTx.recentBlockhash = bh.blockhash;
    launchTx.feePayer = treasuryKp.publicKey;
    launchTx.sign(treasuryKp);
    const sig = await connection.sendRawTransaction(launchTx.serialize(), {
      skipPreflight: false,
      maxRetries: 2,
    });
    await connection.confirmTransaction(
      { signature: sig, ...bh },
      "confirmed"
    );
    out.launch = "sent";
    messages.push(`launch_presale ${sig}`);
  }

  const liq = await runMeteoraLiquidityForMint(connection, mintStr);
  messages.push(...liq.messages);
  if (liq.status === "ok") {
    out.meteora = "ok";
  } else if (liq.status === "skipped") {
    out.meteora = "skipped";
  } else {
    out.meteora =
      out.launch === "sent" || out.launch === "already" ? "partial" : "error";
  }

  return out;
}

export async function runEggHatchCron(connection: Connection): Promise<{
  results: EggHatchAttempt[];
}> {
  const mints = await readTreasuryMintBase58List();
  const results: EggHatchAttempt[] = [];
  for (const m of mints) {
    try {
      results.push(await tryCompleteEggHatchForMint(m, connection));
    } catch (e) {
      results.push({
        mint: m,
        launch: "error",
        meteora: "skipped",
        messages: [e instanceof Error ? e.message : String(e)],
      });
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { results };
}
