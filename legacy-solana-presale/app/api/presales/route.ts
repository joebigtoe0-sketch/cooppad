import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import bs58 from "bs58";

import { PROGRAM_ID, getConnection } from "@/lib/anchor";
import {
  decodePresaleAccount,
  PRESALE_STATE_DISCRIMINATOR,
} from "@/lib/decodePresaleAccount";
import { computeListingStatus } from "@/lib/presaleListing";
import { presaleStateToJson } from "@/lib/presaleListDto";
import { readTreasuryMintBase58List } from "@/lib/server/treasuryStore";
import type { PresaleDecoded, PresaleOnChainState } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCOUNT_CHUNK = 99;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** PresaleState PDA — inlined so this route does not depend on a separate helper module (avoids rare bundler ReferenceErrors). */
function presaleStatePda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("presale"), mint.toBuffer()],
    PROGRAM_ID
  )[0];
}

function withListing(dec: PresaleDecoded, now: Date): PresaleOnChainState {
  return {
    ...dec,
    listingStatus: computeListingStatus(dec, now),
  };
}

export async function GET() {
  try {
    const connection = getConnection("confirmed");
    const byMint = new Map<string, PresaleOnChainState>();
    const now = new Date();

    const listFromChain =
      process.env.NEXT_PUBLIC_LIST_PRESALES_FROM_CHAIN === "true" ||
      process.env.NEXT_PUBLIC_LIST_PRESALES_FROM_CHAIN === "1";

    if (listFromChain) {
      try {
        const discBytes = bs58.encode(PRESALE_STATE_DISCRIMINATOR);
        const programAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
          commitment: "confirmed",
          filters: [{ memcmp: { offset: 0, bytes: discBytes } }],
        });
        for (const { account } of programAccounts) {
          if (!account.owner.equals(PROGRAM_ID)) continue;
          const dec = decodePresaleAccount(Buffer.from(account.data));
          if (dec) byMint.set(dec.mint, withListing(dec, now));
        }
      } catch (e) {
        console.warn("getProgramAccounts presales skipped:", e);
      }
    }

    const treasuryMints = await readTreasuryMintBase58List();
    const missing = treasuryMints.filter((m) => !byMint.has(m));

    for (const group of chunk(missing, ACCOUNT_CHUNK)) {
      const pdas = group.map((m) => presaleStatePda(new PublicKey(m)));
      const infos = await connection.getMultipleAccountsInfo(pdas, "confirmed");
      for (let i = 0; i < group.length; i++) {
        const info = infos[i];
        if (!info || !info.owner.equals(PROGRAM_ID)) continue;
        const dec = decodePresaleAccount(Buffer.from(info.data));
        if (dec) byMint.set(dec.mint, withListing(dec, now));
      }
    }

    const presales = [...byMint.values()].sort(
      (a, b) => b.endTime.getTime() - a.endTime.getTime()
    );

    return NextResponse.json(
      {
        presales: presales.map(presaleStateToJson),
        count: presales.length,
        generatedAt: now.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list presales";
    return NextResponse.json({ error: msg, presales: [] }, { status: 500 });
  }
}
