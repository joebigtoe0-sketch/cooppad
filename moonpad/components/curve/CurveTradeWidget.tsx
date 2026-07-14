"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useState } from "react";
import { formatEther, maxUint256, parseEther } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import { coopLaunchpadAbi } from "@/lib/evm/abi/coopLaunchpad";
import { coopLaunchTokenAbi } from "@/lib/evm/abi/coopLaunchToken";
import { activeChain, launchpadAddress } from "@/lib/evm/chains";
import type { CurveTokenJson } from "@/types/curve";

const SLIPPAGE_PRESETS = [0.5, 1, 2, 5];
const ETH_PRESETS = ["0.05", "0.1", "0.5", "1"];
const USD_PRESETS = ["10", "50", "100", "250"];

export function CurveTradeWidget({
  token,
  onTraded,
}: {
  token: CurveTokenJson;
  onTraded?: () => void;
}) {
  const { address: account, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { currency, ethUsd, fmt } = useCurrency();

  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  // Denomination of the buy input; follows the global display currency initially.
  const [inputCur, setInputCur] = useState<"ETH" | "USD">("ETH");
  const [slippagePct, setSlippagePct] = useState(2);
  const [customSlippage, setCustomSlippage] = useState("");

  useEffect(() => {
    setInputCur(currency === "USD" && ethUsd > 0 ? "USD" : "ETH");
  }, [currency, ethUsd]);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem("coop-slippage-pct"));
    if (saved > 0 && saved <= 50) {
      setSlippagePct(saved);
      if (!SLIPPAGE_PRESETS.includes(saved)) setCustomSlippage(String(saved));
    }
  }, []);

  const chain = activeChain();
  const launchpad = launchpadAddress();
  const tokenAddr = token.address as `0x${string}`;
  const graduated = token.phase === "graduated";
  const wrongChain = isConnected && chainId !== chain.id;
  const usdMode = inputCur === "USD" && ethUsd > 0;

  const applySlippage = (v: bigint): bigint => {
    const bps = BigInt(Math.round(slippagePct * 100));
    return (v * (10_000n - bps)) / 10_000n;
  };

  const setSlippage = (pct: number) => {
    if (!(pct > 0) || pct > 50) return;
    setSlippagePct(pct);
    window.localStorage.setItem("coop-slippage-pct", String(pct));
  };

  const buyWei = useMemo(() => {
    if (tab !== "buy") return 0n;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    try {
      const eth = usdMode ? n / ethUsd : n;
      return parseEther(eth.toFixed(18));
    } catch {
      return 0n;
    }
  }, [amount, tab, usdMode, ethUsd]);

  const sellTokens = useMemo(() => {
    if (tab !== "sell") return 0n;
    try {
      return parseEther(amount || "0"); // tokens are 18-dec too
    } catch {
      return 0n;
    }
  }, [amount, tab]);

  const { data: buyQuote } = useReadContract({
    abi: coopLaunchpadAbi,
    address: launchpad,
    functionName: "quoteBuy",
    args: [tokenAddr, buyWei],
    query: { enabled: !graduated && buyWei > 0n, refetchInterval: 4_000 },
  });

  const { data: sellQuote } = useReadContract({
    abi: coopLaunchpadAbi,
    address: launchpad,
    functionName: "quoteSell",
    args: [tokenAddr, sellTokens],
    query: { enabled: !graduated && sellTokens > 0n, refetchInterval: 4_000 },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: coopLaunchTokenAbi,
    address: tokenAddr,
    functionName: "balanceOf",
    args: [account ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(account) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: coopLaunchTokenAbi,
    address: tokenAddr,
    functionName: "allowance",
    args: [account ?? "0x0000000000000000000000000000000000000000", launchpad],
    query: { enabled: Boolean(account) },
  });

  const { writeContract, data: txHash, isPending, error: writeError, reset } =
    useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (confirmed) {
      setAmount("");
      reset();
      void refetchBalance();
      void refetchAllowance();
      onTraded?.();
    }
  }, [confirmed, onTraded, refetchAllowance, refetchBalance, reset]);

  const needsApproval =
    tab === "sell" && sellTokens > 0n && (allowance ?? 0n) < sellTokens;

  const busy = isPending || confirming;

  const submit = () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (wrongChain) {
      switchChain({ chainId: chain.id });
      return;
    }
    if (tab === "buy") {
      if (buyWei === 0n || !buyQuote) return;
      writeContract({
        abi: coopLaunchpadAbi,
        address: launchpad,
        functionName: "buy",
        args: [tokenAddr, applySlippage(buyQuote[0])],
        value: buyWei,
      });
    } else if (needsApproval) {
      writeContract({
        abi: coopLaunchTokenAbi,
        address: tokenAddr,
        functionName: "approve",
        args: [launchpad, maxUint256],
      });
    } else {
      if (sellTokens === 0n || !sellQuote) return;
      writeContract({
        abi: coopLaunchpadAbi,
        address: launchpad,
        functionName: "sell",
        args: [tokenAddr, sellTokens, applySlippage(sellQuote[0])],
      });
    }
  };

  if (graduated) {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
        <p className="text-3xl" aria-hidden>
          🎓
        </p>
        <p className="mt-2 font-display text-base font-extrabold text-coop-ink dark:text-coop-shell">
          Graduated to Uniswap
        </p>
        <p className="mt-1 text-xs leading-relaxed text-coop-wood/75 dark:text-coop-shell/60">
          The bonding curve is complete — trading now happens on Uniswap v3 with
          the liquidity locked forever.
        </p>
        {token.pair ? (
          <a
            href={`${chain.blockExplorers?.default.url ?? ""}/address/${token.pair}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-lg bg-coop-ink px-4 py-2 text-xs font-bold text-white transition hover:bg-coop-orange dark:bg-coop-yolk dark:text-coop-950"
          >
            View Uniswap pool ↗
          </a>
        ) : null}
      </div>
    );
  }

  const label = !isConnected
    ? "Connect wallet"
    : wrongChain
      ? `Switch to ${chain.name}`
      : busy
        ? "Confirming…"
        : tab === "buy"
          ? "Buy"
          : needsApproval
            ? "Approve"
            : "Sell";

  const presets = usdMode ? USD_PRESETS : ETH_PRESETS;

  return (
    <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
      <div className="flex rounded-xl border border-coop-straw/40 p-1 dark:border-coop-700">
        {(["buy", "sell"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setAmount("");
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold capitalize transition ${
              tab === t
                ? t === "buy"
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-500/15 text-red-600 dark:text-red-400"
                : "text-coop-wood/60 dark:text-coop-shell/50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-coop-wood/65 dark:text-coop-shell/55">
          {tab === "buy" ? (
            <span className="flex items-center gap-1.5">
              Spend
              <span className="flex rounded-md border border-coop-straw/40 p-0.5 dark:border-coop-700">
                {(["ETH", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={c === "USD" && ethUsd <= 0}
                    onClick={() => {
                      setInputCur(c);
                      setAmount("");
                    }}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition disabled:opacity-40 ${
                      inputCur === c
                        ? "bg-coop-yolk/30 text-coop-ink dark:bg-coop-yolk/20 dark:text-coop-shell"
                        : "text-coop-wood/60 dark:text-coop-shell/50"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </span>
            </span>
          ) : (
            <span>Sell ({token.symbol})</span>
          )}
          {tab === "sell" && balance !== undefined ? (
            <button
              type="button"
              className="font-mono underline decoration-dotted"
              onClick={() => setAmount(formatEther(balance))}
            >
              max {Number(formatEther(balance)).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </button>
          ) : null}
        </div>
        <div className="relative mt-1">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            inputMode="decimal"
            placeholder="0.0"
            className="w-full rounded-xl border border-coop-straw/50 bg-coop-canvas px-3 py-2.5 pr-14 font-mono text-lg font-semibold text-coop-ink outline-none transition focus:border-coop-yolk dark:border-coop-700 dark:bg-coop-950 dark:text-coop-shell"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-coop-wood/50 dark:text-coop-shell/40">
            {tab === "buy" ? (usdMode ? "USD" : "ETH") : token.symbol}
          </span>
        </div>
        {tab === "buy" ? (
          <div className="mt-1 flex gap-1.5">
            {presets.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className="rounded-lg border border-coop-straw/40 px-2 py-1 text-[11px] font-bold text-coop-wood/75 transition hover:border-coop-yolk dark:border-coop-700 dark:text-coop-shell/60"
              >
                {usdMode ? `$${v}` : `${v} ETH`}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-1 flex gap-1.5">
            {[25, 50, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  if (balance !== undefined) {
                    setAmount(formatEther((balance * BigInt(pct)) / 100n));
                  }
                }}
                className="rounded-lg border border-coop-straw/40 px-2 py-1 text-[11px] font-bold text-coop-wood/75 transition hover:border-coop-yolk dark:border-coop-700 dark:text-coop-shell/60"
              >
                {pct}%
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-coop-surface-warm/50 px-3 py-2 text-xs text-coop-wood/80 dark:bg-coop-800/50 dark:text-coop-shell/65">
        {tab === "buy" ? (
          buyWei > 0n && buyQuote ? (
            <>
              <div className="flex justify-between">
                <span>You receive ≈</span>
                <span className="font-mono font-bold">
                  {Number(formatEther(buyQuote[0])).toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  {token.symbol}
                </span>
              </div>
              {usdMode ? (
                <div className="mt-1 flex justify-between text-coop-wood/60 dark:text-coop-shell/50">
                  <span>Paying</span>
                  <span className="font-mono">{Number(formatEther(buyWei)).toFixed(5)} ETH</span>
                </div>
              ) : null}
              {buyQuote[3] > 0n ? (
                <div className="mt-1 flex justify-between text-coop-orange">
                  <span>Completes the curve — refund</span>
                  <span className="font-mono">{fmt(Number(formatEther(buyQuote[3])))}</span>
                </div>
              ) : null}
            </>
          ) : (
            <span>Enter an amount to see the quote (1% curve fee included).</span>
          )
        ) : sellTokens > 0n && sellQuote ? (
          <div className="flex justify-between">
            <span>You receive ≈</span>
            <span className="font-mono font-bold">{fmt(Number(formatEther(sellQuote[0])))}</span>
          </div>
        ) : (
          <span>Enter an amount to see the quote (1% curve fee included).</span>
        )}
      </div>

      {/* slippage */}
      <div className="mt-3 flex items-center gap-1.5 text-[11px]">
        <span className="text-coop-wood/60 dark:text-coop-shell/50">Slippage</span>
        {SLIPPAGE_PRESETS.map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => {
              setSlippage(pct);
              setCustomSlippage("");
            }}
            className={`rounded-md border px-1.5 py-0.5 font-bold transition ${
              slippagePct === pct && customSlippage === ""
                ? "border-coop-yolk bg-coop-yolk/20 text-coop-ink dark:text-coop-shell"
                : "border-coop-straw/40 text-coop-wood/60 hover:border-coop-yolk dark:border-coop-700 dark:text-coop-shell/50"
            }`}
          >
            {pct}%
          </button>
        ))}
        <div className="relative">
          <input
            value={customSlippage}
            onChange={(e) => {
              const v = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
              setCustomSlippage(v);
              const n = Number(v);
              if (n > 0 && n <= 50) setSlippage(n);
            }}
            placeholder="…"
            inputMode="decimal"
            className={`w-14 rounded-md border bg-transparent px-1.5 py-0.5 pr-4 text-right font-mono font-bold outline-none transition focus:border-coop-yolk dark:text-coop-shell ${
              customSlippage !== ""
                ? "border-coop-yolk bg-coop-yolk/10"
                : "border-coop-straw/40 dark:border-coop-700"
            }`}
          />
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-coop-wood/50 dark:text-coop-shell/40">
            %
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-extrabold text-white shadow-md transition disabled:opacity-50 ${
          tab === "buy"
            ? "bg-emerald-600 hover:bg-emerald-500"
            : "bg-red-500 hover:bg-red-400"
        }`}
      >
        {label}
      </button>

      {writeError ? (
        <p className="mt-2 break-words text-[11px] leading-snug text-red-500">
          {writeError.message.split("\n")[0].slice(0, 160)}
        </p>
      ) : null}
      <p className="mt-2 text-center text-[10px] text-coop-wood/50 dark:text-coop-shell/40">
        Curve fees: 0.5% platform + 0.5% creator
      </p>
    </div>
  );
}
