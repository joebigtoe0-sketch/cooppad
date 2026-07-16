import { encodeAbiParameters } from "viem";

import { activeChain } from "@/lib/evm/chains";

import stdJson from "./coopTokenV2.stdjson.json";

/**
 * Auto-verifies a freshly launched CoopLaunchTokenV2's source on Blockscout.
 *
 * Terminals (GMGN/GoPlus etc.) decompile UNVERIFIED bytecode and misread the
 * anti-snipe/dev-buy mechanics as honeypot/backdoor flags; with verified
 * source they read the real code and the flags disappear. Pons verifies every
 * token — this brings us to parity, automatically, for every launch.
 *
 * The committed standard-JSON input reproduces the deployed bytecode exactly
 * (metadata hash match confirmed against mainnet). COMPILER_VERSION must stay
 * in sync with it — both come from the same forge build that deployed V2.
 */
const COMPILER_VERSION = "v0.8.35+commit.47b9dedd";
const CONTRACT_NAME = "CoopLaunchTokenV2";
// First attempt waits for Blockscout to index the new contract; later
// attempts retry through explorer hiccups (their API 500s intermittently).
const ATTEMPT_DELAYS_MS = [45_000, 180_000, 600_000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function explorerUrl(): string | null {
  const url = activeChain().blockExplorers?.default?.url;
  return url ? url.replace(/\/$/, "") : null; // local anvil has none — skip
}

async function isVerified(base: string, token: string): Promise<boolean> {
  const res = await fetch(
    `${base}/api?module=contract&action=getabi&address=${token}`,
    { signal: AbortSignal.timeout(20_000) }
  );
  const j = (await res.json().catch(() => null)) as { status?: string } | null;
  return j?.status === "1";
}

export interface TokenVerifyFields {
  name: string;
  symbol: string;
  metadataUri: string;
  creator: `0x${string}`;
  taxBps: number;
}

/** Fire-and-forget: submit source verification with retries. Never throws. */
export function verifyTokenSource(token: string, fields: TokenVerifyFields): void {
  const base = explorerUrl();
  if (!base) return;

  void (async () => {
    for (const delay of ATTEMPT_DELAYS_MS) {
      await sleep(delay);
      try {
        if (await isVerified(base, token)) {
          console.log(`[token-verifier] ${token} verified ✓`);
          return;
        }

        const ctorArgs = encodeAbiParameters(
          [
            { type: "string" },
            { type: "string" },
            { type: "string" },
            { type: "address" },
            { type: "uint16" },
          ],
          [fields.name, fields.symbol, fields.metadataUri, fields.creator, fields.taxBps]
        );

        const form = new FormData();
        form.set("compiler_version", COMPILER_VERSION);
        form.set("contract_name", CONTRACT_NAME);
        form.set("constructor_args", ctorArgs);
        form.set("autodetect_constructor_args", "false");
        form.set("license_type", "mit");
        form.set(
          "files[0]",
          new Blob([JSON.stringify(stdJson)], { type: "application/json" }),
          "input.json"
        );

        const res = await fetch(
          `${base}/api/v2/smart-contracts/${token}/verification/via/standard-input`,
          { method: "POST", body: form, signal: AbortSignal.timeout(60_000) }
        );
        console.log(`[token-verifier] ${token} submitted (http ${res.status})`);
      } catch (err) {
        console.warn(
          `[token-verifier] ${token} attempt failed:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    // Final status for the logs — verification lands async on their side.
    try {
      const ok = await isVerified(base, token);
      console.log(`[token-verifier] ${token} final status: ${ok ? "verified ✓" : "unverified"}`);
    } catch {
      /* logging only */
    }
  })();
}
