"use client";

import { useEffect } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import { coopLaunchpadV2Abi } from "@/lib/evm/abi/coopLaunchpadV2";
import { coopLockerV2Abi } from "@/lib/evm/abi/coopLockerV2";
import { launchpadAddress } from "@/lib/evm/chains";
import type { CurveTokenJson } from "@/types/curve";

const Q128 = 1n << 128n;
const BPS = 10_000n;
const CREATOR_SHARE_BPS = 5_000n;

/** Minimal Uniswap v3 pool surface needed to preview uncollected fees. */
const poolAbi = [
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "key", type: "bytes32" }],
    outputs: [
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" },
    ],
  },
  {
    type: "function",
    name: "feeGrowthGlobal0X128",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "feeGrowthGlobal1X128",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

function fmtToken(amountWei: bigint): string {
  const v = Number(formatEther(amountWei));
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

/**
 * Shown on a coin page only when the connected wallet created the token.
 * V2: the locked position's Uniswap fees are the whole reward stream — the
 * locker pays the creator's share straight to their wallet on every collect,
 * so there is nothing to "claim", only a crank anyone can press.
 */
export function CreatorRewards({ token }: { token: CurveTokenJson }) {
  const { address: account } = useAccount();
  const { fmt } = useCurrency();
  const launchpad = launchpadAddress();

  const isCreator = Boolean(
    account && account.toLowerCase() === token.creator.toLowerCase()
  );

  const { data: lockerAddr } = useReadContract({
    abi: coopLaunchpadV2Abi,
    address: launchpad,
    functionName: "locker",
    query: { enabled: isCreator },
  });

  const { data: lock } = useReadContract({
    abi: coopLockerV2Abi,
    address: lockerAddr,
    functionName: "locks",
    args: [token.address as `0x${string}`],
    query: { enabled: Boolean(isCreator && lockerAddr) },
  });
  const poolAddr = lock?.[0];
  const reinvestBps = lock ? BigInt(lock[2]) : 0n;

  const { data: positionKey } = useReadContract({
    abi: coopLockerV2Abi,
    address: lockerAddr,
    functionName: "positionKey",
    args: [token.address as `0x${string}`],
    query: { enabled: Boolean(isCreator && lockerAddr) },
  });

  const poolQuery = {
    abi: poolAbi,
    address: poolAddr,
    query: {
      enabled: Boolean(isCreator && poolAddr && positionKey),
      refetchInterval: 15_000,
    },
  } as const;
  const { data: pos, refetch: refetchPos } = useReadContract({
    ...poolQuery,
    functionName: "positions",
    args: [positionKey ?? "0x0000000000000000000000000000000000000000000000000000000000000000"],
  });
  const { data: growth0 } = useReadContract({ ...poolQuery, functionName: "feeGrowthGlobal0X128" });
  const { data: growth1 } = useReadContract({ ...poolQuery, functionName: "feeGrowthGlobal1X128" });
  const { data: token0 } = useReadContract({ ...poolQuery, functionName: "token0" });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (confirmed) void refetchPos();
  }, [confirmed, refetchPos]);

  if (!isCreator) return null;

  // Pending pool fees = fees already owed to the position + growth since the
  // last poke. The position never trades beyond its edge ticks, so
  // feeGrowthInside == feeGrowthGlobal here.
  let pendingToken = 0n;
  let pendingWeth = 0n;
  if (pos && growth0 !== undefined && growth1 !== undefined && token0) {
    const [liquidity, inside0Last, inside1Last, owed0, owed1] = pos;
    const pending0 = owed0 + (liquidity * (growth0 - inside0Last)) / Q128;
    const pending1 = owed1 + (liquidity * (growth1 - inside1Last)) / Q128;
    const tokenIs0 = token0.toLowerCase() === token.address.toLowerCase();
    pendingToken = tokenIs0 ? pending0 : pending1;
    pendingWeth = tokenIs0 ? pending1 : pending0;
  }

  // Creator receives half of whatever fee share is paid out after reinvest.
  const creatorCutBps = ((BPS - reinvestBps) * CREATOR_SHARE_BPS) / BPS;
  const creatorToken = (pendingToken * creatorCutBps) / BPS;
  const creatorWeth = (pendingWeth * creatorCutBps) / BPS;
  const hasPoolFees = creatorToken > 0n || creatorWeth > 0n;

  return (
    <div className="rounded-2xl border border-coop-yolk/50 bg-coop-yolk/5 p-4 dark:border-coop-yolk/30 dark:bg-coop-yolk/10">
      <p className="text-[10px] font-bold uppercase tracking-wider text-coop-wood/70 dark:text-coop-yolk-soft">
        👑 Creator rewards
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-coop-ink dark:text-coop-shell">
            {fmtToken(creatorToken)} {token.symbol}
            <span className="text-coop-wood/50 dark:text-coop-shell/40"> + </span>
            {Number(formatEther(creatorWeth)).toFixed(creatorWeth > 0n ? 5 : 0)} WETH
            {creatorWeth > 0n ? (
              <span className="text-coop-wood/50 dark:text-coop-shell/40">
                {" "}
                ({fmt(Number(formatEther(creatorWeth)))})
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-coop-wood/65 dark:text-coop-shell/55">
            Your share of uncollected pool fees — paid straight to your wallet on
            collect
            {token.flavor === "lpGrow"
              ? " (70% reinvests into locked liquidity first)"
              : token.flavor === "superLp"
                ? " (the 5% buy tax compounds into LP separately)"
                : " (split 50/50 with the platform)"}
          </p>
        </div>
        <button
          type="button"
          disabled={isPending || !lockerAddr || !hasPoolFees}
          onClick={() =>
            lockerAddr &&
            writeContract({
              abi: coopLockerV2Abi,
              address: lockerAddr,
              functionName: "collect",
              args: [token.address as `0x${string}`],
            })
          }
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-40"
        >
          Collect
        </button>
      </div>
    </div>
  );
}
