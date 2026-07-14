"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type DisplayCurrency = "USD" | "ETH";

type CurrencyContextValue = {
  /** USD whenever a live ETH price is available, ETH as the fallback. */
  currency: DisplayCurrency;
  ethUsd: number;
  /** Format an ETH-denominated amount in the display currency (USD-first). */
  fmt: (amountEth: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function compactUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 10_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (v > 0) return `$${v.toFixed(4)}`;
  return "$0";
}

function compactEth(v: number): string {
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K ETH`;
  if (v >= 1) return `${v.toFixed(2)} ETH`;
  if (v >= 0.001) return `${v.toFixed(4)} ETH`;
  if (v > 0) return `${v.toFixed(6)} ETH`;
  return "0 ETH";
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [ethUsd, setEthUsd] = useState(0);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch("/api/curve/eth-price", { cache: "no-store" });
        const j = (await res.json()) as { usd?: number };
        if (!stop && j.usd && j.usd > 0) setEthUsd(j.usd);
      } catch {
        /* keep last */
      }
    };
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  const value = useMemo<CurrencyContextValue>(() => {
    const useUsd = ethUsd > 0;
    return {
      currency: useUsd ? "USD" : "ETH",
      ethUsd,
      fmt: (amountEth: number) =>
        useUsd ? compactUsd(amountEth * ethUsd) : compactEth(amountEth),
    };
  }, [ethUsd]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    return { currency: "ETH", ethUsd: 0, fmt: compactEth };
  }
  return ctx;
}
