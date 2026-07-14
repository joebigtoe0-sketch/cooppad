import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import type { Idl } from "@coral-xyz/anchor";

import { MOONPAD_IDL } from "@/lib/anchor";
import {
  buildContributeTx,
  buildInitializePresaleTx,
  type InitPresaleParams,
} from "@/lib/instructions";
import {
  INIT_TOKEN_URI_MAX_BYTES,
  ONCHAIN_RAISE_TARGET_LAMPORTS,
  PLATFORM_MIN_CONTRIBUTION_LAMPORTS,
  placeholderTokenUri,
} from "@/lib/presaleConstants";
import {
  MintPoolEmptyError,
  withPooledMint,
} from "@/lib/server/mintPoolStore";
import { loadPlatformAuthorityKeypair } from "@/lib/server/platformAuthorityKeypair";
import { appendTreasuryRecord } from "@/lib/server/treasuryStore";
import { walletFromKeypair } from "@/lib/server/walletFromKeypair";

export const runtime = "nodejs";

type PrepareBody = {
  creator: string;
  blockhash: string;
  lastValidBlockHeight: number;
  tokenName: string;
  tokenTicker: string;
  description: string;
  durationSeconds: number;
  /** Bigint lamports as decimal string */
  maxContribution: string;
  twitter: string;
  telegram: string;
  website: string;
  /** Off-chain Metaplex JSON URI (e.g. Pinata gateway); must be ≤200 UTF-8 bytes on-chain. */
  tokenUri?: string;
  /**
   * Optional net lamports for creator's first buy in the same tx (after initialize).
   * Decimal string; 0 or omit = skip.
   */
  initialContributionLamports?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PrepareBody;

    return await withPooledMint(async (mintKp) => {
      const platformKp = loadPlatformAuthorityKeypair();
      const treasuryKp = Keypair.generate();

      const creator = new PublicKey(body.creator);
      const mint = mintKp.publicKey;
      const fromBody = body.tokenUri?.trim();
      const tokenUri =
        fromBody && fromBody.length > 0
          ? fromBody
          : placeholderTokenUri(mint.toBase58());
      const uriBytes = new TextEncoder().encode(tokenUri);
      if (uriBytes.length > INIT_TOKEN_URI_MAX_BYTES) {
        throw new Error(
          `tokenUri exceeds ${INIT_TOKEN_URI_MAX_BYTES} UTF-8 bytes (Metaplex limit)`
        );
      }

      const params: InitPresaleParams = {
        tokenName: body.tokenName,
        tokenTicker: body.tokenTicker,
        tokenUri,
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
      const wallet = walletFromKeypair(platformKp);
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

      const initialRaw = body.initialContributionLamports?.trim() ?? "0";
      const initialNet = BigInt(initialRaw || "0");
      if (initialNet > 0n) {
        if (initialNet < PLATFORM_MIN_CONTRIBUTION_LAMPORTS) {
          throw new Error("initialContributionLamports below on-chain minimum (0.01 SOL)");
        }
        const maxContrib = BigInt(body.maxContribution);
        if (initialNet > maxContrib) {
          throw new Error("initialContributionLamports exceeds maxContribution");
        }
        if (initialNet > ONCHAIN_RAISE_TARGET_LAMPORTS) {
          throw new Error("initialContributionLamports exceeds on-chain raise target");
        }
        const contribTx = await buildContributeTx(
          program,
          creator,
          mint,
          initialNet,
          treasuryKp.publicKey
        );
        for (const ix of contribTx.instructions) {
          tx.add(ix);
        }
      }

      tx.feePayer = creator;
      tx.recentBlockhash = body.blockhash;
      tx.partialSign(platformKp, mintKp);

      await appendTreasuryRecord({
        mint: mint.toBase58(),
        tokenName: body.tokenName,
        tokenTicker: body.tokenTicker,
        treasuryPublicKey: treasuryKp.publicKey.toBase58(),
        treasurySecretKey: Array.from(treasuryKp.secretKey),
        createdAt: new Date().toISOString(),
      });

      const serialized = tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      return NextResponse.json({
        mint: mint.toBase58(),
        treasuryPubkey: treasuryKp.publicKey.toBase58(),
        transaction: Buffer.from(serialized).toString("base64"),
        lastValidBlockHeight: body.lastValidBlockHeight,
      });
    });
  } catch (e) {
    if (e instanceof MintPoolEmptyError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : "Prepare failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
