import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import type { Idl } from "@coral-xyz/anchor";

import { MOONPAD_IDL } from "@/lib/anchor";
import { buildInitializePresaleTx, type InitPresaleParams } from "@/lib/instructions";
import { appendTreasuryRecord } from "@/lib/server/treasuryStore";

export const runtime = "nodejs";

type PrepareBody = {
  creator: string;
  mint: string;
  blockhash: string;
  lastValidBlockHeight: number;
  tokenName: string;
  tokenTicker: string;
  tokenUri: string;
  description: string;
  durationSeconds: number;
  /** Bigint lamports as decimal string */
  maxContribution: string;
  twitter: string;
  telegram: string;
  website: string;
};

function loadPlatformKeypair(): Keypair {
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PrepareBody;
    const platformKp = loadPlatformKeypair();
    const treasuryKp = Keypair.generate();

    const creator = new PublicKey(body.creator);
    const mint = new PublicKey(body.mint);

    const params: InitPresaleParams = {
      tokenName: body.tokenName,
      tokenTicker: body.tokenTicker,
      tokenUri: body.tokenUri,
      description: body.description,
      durationSeconds: body.durationSeconds,
      maxContribution: BigInt(body.maxContribution),
      twitter: body.twitter ?? "",
      telegram: body.telegram ?? "",
      website: body.website ?? "",
    };

    const rpc =
      process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
    const connection = new Connection(rpc, "confirmed");
    const wallet = new Wallet(platformKp);
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    const program = new Program(MOONPAD_IDL as Idl, provider);

    const tx = await buildInitializePresaleTx(
      program,
      creator,
      mint,
      params,
      {
        treasury: treasuryKp.publicKey,
        platformAuthority: platformKp.publicKey,
      }
    );

    tx.feePayer = creator;
    tx.recentBlockhash = body.blockhash;
    tx.partialSign(platformKp);

    await appendTreasuryRecord({
      mint: mint.toBase58(),
      treasuryPublicKey: treasuryKp.publicKey.toBase58(),
      treasurySecretKey: Array.from(treasuryKp.secretKey),
      createdAt: new Date().toISOString(),
    });

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return NextResponse.json({
      treasuryPubkey: treasuryKp.publicKey.toBase58(),
      transaction: Buffer.from(serialized).toString("base64"),
      lastValidBlockHeight: body.lastValidBlockHeight,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Prepare failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
