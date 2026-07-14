"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import type { CurveCandleJson } from "@/types/curve";

const RESOLUTIONS = [
  { key: 60, label: "1m" },
  { key: 300, label: "5m" },
  { key: 3600, label: "1h" },
  { key: 86400, label: "1d" },
];

/** Candles are charted as market cap in ETH (price × 1e9) — far more readable
 * than 1e-9-scale per-token prices. */
export function CurveChart({ address }: { address: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [res, setRes] = useState(300);
  const [empty, setEmpty] = useState(false);
  const { currency, ethUsd } = useCurrency();
  const scale = currency === "USD" && ethUsd > 0 ? ethUsd : 1;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8a7a5c",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(138,122,92,0.12)" },
        horzLines: { color: "rgba(138,122,92,0.12)" },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderVisible: false },
      rightPriceScale: { borderVisible: false },
      autoSize: true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#ef4444",
      wickUpColor: "#16a34a",
      wickDownColor: "#ef4444",
      borderVisible: false,
      priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
    });
    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch(`/api/curve/tokens/${address}/candles?res=${res}`, {
          cache: "no-store",
        });
        const data = (await r.json()) as { candles?: CurveCandleJson[] };
        if (cancelled || !seriesRef.current) return;
        const candles = data.candles ?? [];
        setEmpty(candles.length === 0);
        seriesRef.current.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open * 1e9 * scale,
            high: c.high * 1e9 * scale,
            low: c.low * 1e9 * scale,
            close: c.close * 1e9 * scale,
          }))
        );
      } catch {
        /* transient */
      }
    };

    void load();
    const id = setInterval(() => void load(), 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, res, scale]);

  return (
    <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 dark:border-coop-700 dark:bg-coop-900/60">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-coop-wood/70 dark:text-coop-shell/60">
          Market cap ({currency})
        </p>
        <div className="ml-auto flex rounded-lg border border-coop-straw/40 p-0.5 dark:border-coop-700">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRes(r.key)}
              className={`rounded-md px-2 py-1 text-[11px] font-bold transition ${
                res === r.key
                  ? "bg-coop-yolk/30 text-coop-ink dark:bg-coop-yolk/20 dark:text-coop-shell"
                  : "text-coop-wood/60 hover:text-coop-ink dark:text-coop-shell/50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <div ref={containerRef} className="h-[360px] w-full" />
        {empty ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-coop-wood/60 dark:text-coop-shell/50">
            No trades yet — the first trade paints the chart
          </div>
        ) : null}
      </div>
    </div>
  );
}
