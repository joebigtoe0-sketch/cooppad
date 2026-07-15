"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CurveTokenCard } from "@/components/curve/CurveTokenCard";
import { FlavorBadge } from "@/components/curve/FlavorBadge";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { CurveTokenJson } from "@/types/curve";

type Status = "all" | "live" | "graduated";
type Sort = "activity" | "new" | "gainers" | "marketcap" | "volume";

// "live" is the API's name for not-yet-graduated (phase=trading) — shown to
// users as "Climbing" since every V2 token trades forever either way.
const STATUS_TABS: { key: Status; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Climbing" },
  { key: "graduated", label: "Graduated" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "activity", label: "Active" },
  { key: "new", label: "New" },
  { key: "gainers", label: "Gainers" },
  { key: "marketcap", label: "Mcap" },
  { key: "volume", label: "Volume" },
];

export function CurveExplorer() {
  const [tokens, setTokens] = useState<CurveTokenJson[]>([]);
  const [koth, setKoth] = useState<CurveTokenJson | null>(null);
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<Sort>("activity");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/curve/tokens?status=${status}&sort=${sort}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        tokens?: CurveTokenJson[];
        koth?: CurveTokenJson | null;
      };
      setTokens(data.tokens ?? []);
      setKoth(data.koth ?? null);
    } catch {
      /* keep previous state */
    } finally {
      setLoading(false);
    }
  }, [status, sort]);

  useEffect(() => {
    setLoading(true);
    void load();
    const id = setInterval(() => void load(), 8_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section>
      {koth && koth.phase === "trading" ? (
        <Link
          href={`/coin/${koth.address}`}
          className="mb-6 flex items-center gap-4 rounded-2xl border-2 border-coop-yolk/70 bg-gradient-to-r from-coop-yolk/15 via-coop-surface to-coop-surface p-4 shadow-md transition hover:border-coop-yolk dark:from-coop-yolk/10 dark:via-coop-900 dark:to-coop-900"
        >
          <span className="text-3xl" aria-hidden>
            👑
          </span>
          {koth.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ipfsToHttp(koth.imageUrl)}
              alt=""
              className="h-12 w-12 rounded-xl object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-coop-yolk/25 font-display text-base font-extrabold text-coop-wood dark:text-coop-yolk-soft">
              {koth.symbol.slice(0, 3)}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-coop-orange">
              King of the coop
            </p>
            <p className="truncate font-display text-base font-extrabold text-coop-ink dark:text-coop-shell">
              {koth.name}{" "}
              <span className="font-mono text-xs text-coop-wood/70 dark:text-coop-shell/60">
                {koth.symbol}
              </span>
            </p>
            <FlavorBadge flavor={koth.flavor} className="mt-1" />
          </div>
          <div className="ml-auto text-right">
            <p className="font-mono text-sm font-bold text-coop-ink dark:text-coop-yolk">
              {Math.round(koth.progress * 100)}%
            </p>
            <p className="text-[10px] text-coop-wood/60 dark:text-coop-shell/50">
              to graduation
            </p>
          </div>
        </Link>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-coop-straw/40 bg-coop-surface p-1 dark:border-coop-700 dark:bg-coop-900/60">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatus(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                status === t.key
                  ? "bg-coop-yolk/30 text-coop-ink dark:bg-coop-yolk/20 dark:text-coop-shell"
                  : "text-coop-wood/70 hover:text-coop-ink dark:text-coop-shell/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex rounded-xl border border-coop-straw/40 bg-coop-surface p-1 dark:border-coop-700 dark:bg-coop-900/60">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                sort === s.key
                  ? "bg-coop-yolk/30 text-coop-ink dark:bg-coop-yolk/20 dark:text-coop-shell"
                  : "text-coop-wood/70 hover:text-coop-ink dark:text-coop-shell/60"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading && tokens.length === 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-coop-straw/30 bg-coop-surface-warm/40 dark:border-coop-700 dark:bg-coop-800/40"
            />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-coop-straw/50 bg-coop-surface-warm/30 px-6 py-14 text-center dark:border-coop-700 dark:bg-coop-800/30">
          <p className="text-4xl" aria-hidden>
            🐔
          </p>
          <p className="mt-3 font-display text-lg font-extrabold text-coop-ink dark:text-coop-shell">
            Nothing here yet
          </p>
          <p className="mt-1 text-sm text-coop-wood/70 dark:text-coop-shell/60">
            Be the first to launch a token on Robinhood Chain.
          </p>
          <Link
            href="/launch"
            className="mt-5 inline-flex items-center rounded-xl bg-coop-ink px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-coop-orange dark:bg-coop-yolk dark:text-coop-950 dark:hover:bg-white"
          >
            Launch the first token
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tokens.map((t) => (
            <CurveTokenCard key={t.address} token={t} />
          ))}
        </div>
      )}
    </section>
  );
}
