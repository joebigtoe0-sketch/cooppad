"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useState } from "react";
import { formatEther, maxUint256, parseEther } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSimulateContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import { coopLaunchTokenV2Abi } from "@/lib/evm/abi/coopLaunchTokenV2";
import { coopRouterAbi } from "@/lib/evm/abi/coopRouter";
import { activeChain, routerAddress } from "@/lib/evm/chains";
import type { CurveTokenJson } from "@/types/curve";

const SLIPPAGE_PRESETS = [0.5, 1, 2, 5];
const ETH_PRESETS = ["0.05", "0.1", "0.5", "1"];
const USD_PRESETS = ["10", "50", "100", "250"];
const POOL_FEE = 10_000; // 1% Uniswap v3 tier
// Mirror of the token contract's launch protections (SNIPE_WINDOW /
// SNIPE_MAX_TOKENS): first 120s, max 2% of supply per wallet, buys only.
const SNIPE_WINDOW_MS = 120_000;
const SNIPE_CAP_WEI = 20_000_000n * 10n ** 18n; // 2% of 1B supply

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
  // Sell input denomination: token amount, or the ETH/USD you want to receive.
  const [sellCur, setSellCur] = useState<"TOKEN" | "ETH" | "USD">("TOKEN");
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
  const router = routerAddress();
  const tokenAddr = token.address as `0x${string}`;
  const superLp = token.flavor === "superLp";
  const wrongChain = isConnected && chainId !== chain.id;
  const usdMode = inputCur === "USD" && ethUsd > 0;

  // Live countdown of the on-chain sniper-protection window.
  const launchAt = new Date(token.createdAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const snipeWindowActive = now - launchAt < SNIPE_WINDOW_MS;
  useEffect(() => {
    if (!snipeWindowActive) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [snipeWindowActive]);
  const snipeSecondsLeft = Math.max(0, Math.ceil((launchAt + SNIPE_WINDOW_MS - now) / 1_000));

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

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: coopLaunchTokenV2Abi,
    address: tokenAddr,
    functionName: "balanceOf",
    args: [account ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(account) },
  });

  const sellTokens = useMemo(() => {
    if (tab !== "sell") return 0n;
    try {
      if (sellCur === "TOKEN") {
        return parseEther(amount || "0"); // tokens are 18-dec too
      }
      // "I want to receive N ETH / $N" — invert price (+1% pool fee) into a
      // token amount, capped at the wallet balance.
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0 || token.priceEth <= 0) return 0n;
      const ethWanted = sellCur === "USD" ? (ethUsd > 0 ? n / ethUsd : 0) : n;
      if (ethWanted <= 0) return 0n;
      let wei = parseEther((ethWanted / (token.priceEth * 0.99)).toFixed(18));
      if (balance !== undefined && wei > balance) wei = balance;
      return wei;
    } catch {
      return 0n;
    }
  }, [amount, tab, sellCur, token.priceEth, ethUsd, balance]);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: coopLaunchTokenV2Abi,
    address: tokenAddr,
    functionName: "allowance",
    args: [account ?? "0x0000000000000000000000000000000000000000", router],
    query: { enabled: Boolean(account) },
  });

  const canSimulateSell =
    Boolean(account) && sellTokens > 0n && (allowance ?? 0n) >= sellTokens &&
    (balance ?? 0n) >= sellTokens;

  // Quotes come from eth_call simulation of the actual swap — exact, including
  // the pool fee and (for Super LP) the buy tax, since the router returns what
  // the recipient really receives.
  const { data: buySim } = useSimulateContract({
    abi: coopRouterAbi,
    address: router,
    functionName: "buyExactEth",
    args: [tokenAddr, POOL_FEE, 0n, account ?? router],
    value: buyWei,
    query: { enabled: Boolean(account) && buyWei > 0n, refetchInterval: 4_000 },
  });
  const { data: sellSim } = useSimulateContract({
    abi: coopRouterAbi,
    address: router,
    functionName: "sellExactTokens",
    args: [tokenAddr, POOL_FEE, sellTokens, 0n, account ?? router],
    query: { enabled: canSimulateSell, refetchInterval: 4_000 },
  });

  // Price-based fallback estimates for the not-yet-connected / not-yet-approved
  // states (1% pool fee, and 5% buy tax on Super LP).
  const buyEstimate = useMemo(() => {
    if (buySim?.result !== undefined) return buySim.result;
    if (buyWei === 0n || token.priceEth <= 0) return 0n;
    const eth = Number(formatEther(buyWei)) * 0.99;
    const tokens = (eth / token.priceEth) * (superLp ? 0.95 : 1);
    return parseEther(Math.max(0, tokens).toFixed(18));
  }, [buySim, buyWei, token.priceEth, superLp]);

  const sellEstimate = useMemo(() => {
    if (sellSim?.result !== undefined) return sellSim.result;
    if (sellTokens === 0n || token.priceEth <= 0) return 0n;
    const eth = Number(formatEther(sellTokens)) * token.priceEth * 0.99;
    return parseEther(Math.max(0, eth).toFixed(18));
  }, [sellSim, sellTokens, token.priceEth]);

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

  // Would this buy blow past the 2%-per-wallet launch-window cap? Balance is
  // a close proxy for the contract's cumulative window counter.
  const overSnipeCap =
    snipeWindowActive &&
    tab === "buy" &&
    buyEstimate > 0n &&
    buyEstimate + (balance ?? 0n) > SNIPE_CAP_WEI;

  const busy = isPending || confirming;

  const submit = () => {
    if (!isConnected || !account) {
      openConnectModal?.();
      return;
    }
    if (wrongChain) {
      switchChain({ chainId: chain.id });
      return;
    }
    if (tab === "buy") {
      if (buyWei === 0n) return;
      writeContract({
        abi: coopRouterAbi,
        address: router,
        functionName: "buyExactEth",
        args: [tokenAddr, POOL_FEE, applySlippage(buyEstimate), account],
        value: buyWei,
      });
    } else if (needsApproval) {
      writeContract({
        abi: coopLaunchTokenV2Abi,
        address: tokenAddr,
        functionName: "approve",
        args: [router, maxUint256],
      });
    } else {
      if (sellTokens === 0n) return;
      writeContract({
        abi: coopRouterAbi,
        address: router,
        functionName: "sellExactTokens",
        args: [tokenAddr, POOL_FEE, sellTokens, applySlippage(sellEstimate), account],
      });
    }
  };

  const label = !isConnected
    ? "Connect wallet"
    : wrongChain
      ? `Switch to ${chain.name}`
      : busy
        ? "Confirming…"
        : overSnipeCap
          ? "Over the 2% launch cap"
          : tab === "buy"
            ? "Buy"
            : needsApproval
              ? "Approve"
              : "Sell";

  const presets = usdMode ? USD_PRESETS : ETH_PRESETS;

  return (
    <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
      {token.phase === "graduated" ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
          🎓 Graduated — bonding curve complete. Trading never stops.
        </div>
      ) : null}
      {snipeWindowActive ? (
        <div className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] font-bold leading-snug text-amber-700 dark:text-amber-400">
          🛡️ Sniper protection: {snipeSecondsLeft}s left — max 2% of supply
          (20M tokens) per wallet during the launch window. Sells are never
          restricted.
        </div>
      ) : null}
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
            <span className="flex items-center gap-1.5">
              Sell
              <span className="flex rounded-md border border-coop-straw/40 p-0.5 dark:border-coop-700">
                {(["TOKEN", "ETH", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={c === "USD" && ethUsd <= 0}
                    onClick={() => {
                      setSellCur(c);
                      setAmount("");
                    }}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition disabled:opacity-40 ${
                      sellCur === c
                        ? "bg-coop-yolk/30 text-coop-ink dark:bg-coop-yolk/20 dark:text-coop-shell"
                        : "text-coop-wood/60 dark:text-coop-shell/50"
                    }`}
                  >
                    {c === "TOKEN" ? token.symbol : c}
                  </button>
                ))}
              </span>
            </span>
          )}
          {tab === "sell" && sellCur === "TOKEN" && balance !== undefined ? (
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
            {tab === "buy"
              ? usdMode
                ? "USD"
                : "ETH"
              : sellCur === "TOKEN"
                ? token.symbol
                : sellCur}
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
        ) : sellCur === "TOKEN" ? (
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
        ) : (
          <div className="mt-1 flex gap-1.5">
            {(sellCur === "USD" ? USD_PRESETS : ETH_PRESETS).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className="rounded-lg border border-coop-straw/40 px-2 py-1 text-[11px] font-bold text-coop-wood/75 transition hover:border-coop-yolk dark:border-coop-700 dark:text-coop-shell/60"
              >
                {sellCur === "USD" ? `$${v}` : `${v} ETH`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-coop-surface-warm/50 px-3 py-2 text-xs text-coop-wood/80 dark:bg-coop-800/50 dark:text-coop-shell/65">
        {tab === "buy" ? (
          buyWei > 0n && buyEstimate > 0n ? (
            <>
              <div className="flex justify-between">
                <span>You receive ≈</span>
                <span className="font-mono font-bold">
                  {Number(formatEther(buyEstimate)).toLocaleString("en-US", {
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
              {superLp ? (
                <div className="mt-1 flex justify-between text-coop-orange">
                  <span>5% buy tax → locked LP</span>
                  <span className="font-mono">included</span>
                </div>
              ) : null}
            </>
          ) : (
            <span>Enter an amount to see the quote (1% pool fee included).</span>
          )
        ) : sellTokens > 0n && sellEstimate > 0n ? (
          <>
            {sellCur !== "TOKEN" ? (
              <div className="flex justify-between text-coop-wood/60 dark:text-coop-shell/50">
                <span>Selling ≈</span>
                <span className="font-mono">
                  {Number(formatEther(sellTokens)).toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  {token.symbol}
                  {balance !== undefined && sellTokens === balance ? " (max)" : ""}
                </span>
              </div>
            ) : null}
            <div className={sellCur !== "TOKEN" ? "mt-1 flex justify-between" : "flex justify-between"}>
              <span>You receive ≈</span>
              <span className="font-mono font-bold">{fmt(Number(formatEther(sellEstimate)))}</span>
            </div>
          </>
        ) : (
          <span>Enter an amount to see the quote (1% pool fee included).</span>
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
        disabled={busy || overSnipeCap}
        className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-extrabold text-white shadow-md transition disabled:opacity-50 ${
          tab === "buy"
            ? "bg-emerald-600 hover:bg-emerald-500"
            : "bg-red-500 hover:bg-red-400"
        }`}
      >
        {label}
      </button>
      {overSnipeCap ? (
        <p className="mt-2 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
          This buy would put your wallet over the launch-window cap of 2% of
          supply. Try a smaller amount, or wait {snipeSecondsLeft}s for the
          window to end.
        </p>
      ) : null}

      {writeError ? (
        <p className="mt-2 break-words text-[11px] leading-snug text-red-500">
          {writeError.message.split("\n")[0].slice(0, 160)}
        </p>
      ) : null}
      <p className="mt-2 text-center text-[10px] text-coop-wood/50 dark:text-coop-shell/40">
        Trades on Uniswap v3 · 1% pool fee split creator/platform
        {superLp ? " · 5% buy tax deepens locked LP" : ""}
      </p>
    </div>
  );
}
