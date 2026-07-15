"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { FlavorBadge } from "@/components/curve/FlavorBadge";
import { useCurrency } from "@/components/curve/CurrencyProvider";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { CurveTokenJson } from "@/types/curve";

/** Top-bar token search: name, ticker, or 0x address. */
export function CoinSearch() {
  const router = useRouter();
  const { fmt } = useCurrency();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CurveTokenJson[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/curve/search?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { tokens?: CurveTokenJson[] };
        setResults(data.tokens ?? []);
        setActive(0);
        setOpen(true);
      } catch {
        /* transient */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (address: string) => {
    setOpen(false);
    setQ("");
    router.push(`/coin/${address.toLowerCase()}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) {
      // A pasted address navigates directly even before the index knows it.
      if (e.key === "Enter" && /^0x[0-9a-fA-F]{40}$/.test(q.trim())) go(q.trim());
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]?.address ?? results[0].address);
    }
  };

  return (
    <div ref={boxRef} className="relative hidden w-full max-w-xs sm:block md:max-w-sm">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search name, ticker, or 0x address…"
        className="w-full rounded-xl border border-coop-straw/50 bg-coop-canvas px-3 py-2 pl-8 text-sm text-coop-ink outline-none transition focus:border-coop-yolk dark:border-coop-700 dark:bg-coop-950 dark:text-coop-shell"
      />
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-coop-wood/50 dark:text-coop-shell/40">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
          />
        </svg>
      </span>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-coop-straw/40 bg-coop-surface shadow-lg dark:border-coop-700 dark:bg-coop-900">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-coop-wood/60 dark:text-coop-shell/50">
              No tokens found
              {/^0x[0-9a-fA-F]{40}$/.test(q.trim()) ? " — press Enter to open the address anyway" : ""}
            </p>
          ) : (
            results.map((t, i) => (
              <button
                key={t.address}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(t.address)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                  i === active ? "bg-coop-yolk/15 dark:bg-coop-yolk/10" : ""
                }`}
              >
                {t.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ipfsToHttp(t.imageUrl)}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-coop-yolk/20 text-[10px] font-extrabold text-coop-wood dark:text-coop-yolk-soft">
                    {t.symbol.slice(0, 3)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-coop-ink dark:text-coop-shell">
                      {t.name}
                    </span>
                    <FlavorBadge flavor={t.flavor} />
                  </span>
                  <span className="block font-mono text-[10px] text-coop-wood/60 dark:text-coop-shell/50">
                    {t.symbol} · {t.address.slice(0, 6)}…{t.address.slice(-4)}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-xs font-bold text-coop-ink dark:text-coop-shell">
                  {fmt(t.marketCapEth)}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
