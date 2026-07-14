"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PresaleCard } from "@/components/PresaleCard";
import { jsonToPresaleState, type PresaleListItemJson } from "@/lib/presaleListDto";
import type { PresaleOnChainState } from "@/types";

type Tab = "live" | "upcoming" | "filled" | "all";
type SortKey = "end" | "progress" | "raised" | "contributors";

function matchScore(p: PresaleOnChainState, t: string): number {
  const name = (p.tokenName || "").toLowerCase();
  const tick = (p.tokenTicker || "").toLowerCase();
  const mint = p.mint.toLowerCase();
  const desc = (p.description || "").toLowerCase();
  let s = 0;
  if (tick === t) s += 100;
  else if (tick.startsWith(t)) s += 50;
  else if (tick.includes(t)) s += 30;
  if (name === t) s += 80;
  else if (name.startsWith(t)) s += 40;
  else if (name.includes(t)) s += 25;
  if (mint.includes(t)) s += 35;
  if (desc.includes(t)) s += 10;
  return s;
}

function filterBySearch(
  list: PresaleOnChainState[],
  q: string
): PresaleOnChainState[] {
  const t = q.trim().toLowerCase();
  if (!t) return list;
  return list
    .map((p) => ({ p, score: matchScore(p, t) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.p.endTime.getTime() - b.p.endTime.getTime()
    )
    .map((x) => x.p);
}

function tabFilter(list: PresaleOnChainState[], tab: Tab): PresaleOnChainState[] {
  if (tab === "all") return list;
  if (tab === "filled") {
    return list.filter(
      (p) =>
        p.listingStatus === "filled" || p.listingStatus === "launching"
    );
  }
  return list.filter((p) => p.listingStatus === tab);
}

function sortPresales(
  list: PresaleOnChainState[],
  key: SortKey
): PresaleOnChainState[] {
  const out = [...list];
  switch (key) {
    case "end":
      return out.sort((a, b) => a.endTime.getTime() - b.endTime.getTime());
    case "progress":
      return out.sort((a, b) => b.progressPercent - a.progressPercent);
    case "raised":
      return out.sort((a, b) =>
        a.totalRaised > b.totalRaised ? -1 : a.totalRaised < b.totalRaised ? 1 : 0
      );
    case "contributors":
      return out.sort((a, b) => b.totalContributors - a.totalContributors);
    default:
      return out;
  }
}

const tabs: { id: Tab; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "filled", label: "Just filled" },
  { id: "all", label: "All" },
];

export function HomePresaleExplorer() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("live");
  const [sortKey, setSortKey] = useState<SortKey>("end");
  const [list, setList] = useState<PresaleOnChainState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/presales", { cache: "no-store" });
      const data = (await res.json()) as {
        error?: string;
        presales?: PresaleListItemJson[];
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load eggs");
      }
      setList((data.presales ?? []).map(jsonToPresaleState));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load eggs");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        !el ||
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      document.getElementById("egg-search")?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const trending = useMemo(() => {
    return [...list]
      .filter(
        (p) =>
          p.listingStatus === "live" || p.listingStatus === "launching"
      )
      .sort((a, b) => b.progressPercent - a.progressPercent)
      .slice(0, 10);
  }, [list]);

  const visible = useMemo(() => {
    const scoped = tabFilter(list, tab);
    const searched = filterBySearch(scoped, search);
    return sortPresales(searched, sortKey);
  }, [list, tab, search, sortKey]);

  return (
    <section className="space-y-8">
      <div className="relative mx-auto max-w-3xl">
        <label className="sr-only" htmlFor="egg-search">
          Search launchpads
        </label>
        <input
          id="egg-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type token symbol, name, or mint address to find your launchpad…"
          className="w-full rounded-2xl border-2 border-coop-straw/40 bg-white py-3.5 pl-5 pr-14 text-sm text-coop-ink shadow-sm outline-none ring-coop-yolk/30 placeholder:text-coop-wood/45 focus:border-coop-yolk focus:ring-2 dark:border-coop-600 dark:bg-coop-900 dark:text-coop-shell dark:placeholder:text-coop-shell/35"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-md border border-coop-straw/40 bg-coop-surface-warm/90 px-2 py-0.5 text-[10px] font-mono text-coop-wood/60 dark:border-coop-600 dark:bg-coop-800 dark:text-coop-shell/50">
          /
        </span>
        <p className="mt-2 text-center text-xs text-coop-wood/70 dark:text-coop-shell/55">
          {loading
            ? "Loading the flock…"
            : error
              ? error
              : search.trim()
                ? `${visible.length} match${visible.length === 1 ? "" : "es"}`
                : `${visible.length} shown · ${list.length} total in index`}
        </p>
      </div>

      {trending.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-coop-wood/60 dark:text-coop-shell/50">
            Trending heat
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {trending.map((p) => (
              <Link
                key={p.mint}
                href={`/presale/${p.mint}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-coop-straw/35 bg-coop-surface px-3 py-1.5 text-xs font-medium text-coop-ink shadow-sm transition hover:border-coop-yolk/60 dark:border-coop-700 dark:bg-coop-800 dark:text-coop-shell"
              >
                <span className="font-bold">${p.tokenTicker}</span>
                <span className="text-coop-grass dark:text-emerald-400">
                  +{p.progressPercent}%
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === t.id
                  ? "bg-coop-ink text-white dark:bg-coop-yolk dark:text-coop-950"
                  : "bg-coop-surface-warm/80 text-coop-wood hover:bg-coop-straw/30 dark:bg-coop-800 dark:text-coop-shell/80 dark:hover:bg-coop-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-coop-wood/80 dark:text-coop-shell/60">
            <span className="whitespace-nowrap">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-lg border border-coop-straw/45 bg-white px-2 py-1.5 text-sm text-coop-ink dark:border-coop-600 dark:bg-coop-900 dark:text-coop-shell"
            >
              <option value="end">End time</option>
              <option value="progress">Fill %</option>
              <option value="raised">Raised (SOL)</option>
              <option value="contributors">Contributors</option>
            </select>
          </label>
          <span className="rounded-lg border border-coop-straw/30 bg-coop-surface-warm/40 px-3 py-1.5 text-xs text-coop-wood/55 dark:border-coop-700 dark:bg-coop-800 dark:text-coop-shell/45">
            Chains: Solana
          </span>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-96 animate-pulse rounded-2xl border border-coop-straw/25 bg-coop-surface/80 dark:border-coop-800 dark:bg-coop-900/50"
            />
          ))}
        </div>
      ) : list.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-coop-straw/45 bg-coop-surface-warm/35 px-6 py-14 text-center dark:border-coop-700 dark:bg-coop-900/40">
          <p className="text-3xl" aria-hidden>
            🥚
          </p>
          <p className="mt-3 text-sm text-coop-wood/90 dark:text-coop-shell/80">
            No eggs in the index yet.
          </p>
          <Link
            href="/launch"
            className="mt-4 inline-block rounded-xl bg-coop-yolk px-5 py-2.5 text-sm font-bold text-coop-ink hover:bg-coop-orange hover:text-white dark:text-coop-950"
          >
            Lay the first egg
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-coop-wood/80 dark:text-coop-shell/65">
          {search.trim()
            ? `Nothing matches "${search.trim()}". Try another name, ticker, or mint.`
            : `No eggs in "${tabs.find((x) => x.id === tab)?.label}". Try another tab or All.`}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <PresaleCard key={p.mint} presale={p} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-6 text-sm">
        <button
          type="button"
          onClick={() => void load()}
          className="font-medium text-coop-sky hover:text-coop-orange dark:text-coop-yolk-soft"
        >
          Refresh list
        </button>
        <Link
          href="/launch"
          className="font-semibold text-coop-sky hover:text-coop-orange dark:text-coop-yolk-soft"
        >
          Lay an egg →
        </Link>
      </div>
    </section>
  );
}
