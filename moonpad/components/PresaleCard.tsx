"use client";

import Link from "next/link";

import type { PresaleOnChainState } from "@/types";

export function PresaleCard({ presale }: { presale: PresaleOnChainState }) {
  return (
    <Link
      href={`/presale/${presale.mint}`}
      className="block rounded-xl border border-zinc-800 bg-moon-900/60 p-4 transition hover:border-violet-500/50 hover:bg-moon-800/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white">
            {presale.tokenName || "Untitled"}{" "}
            <span className="text-zinc-500">
              (${presale.tokenTicker || "???"})
            </span>
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
            {presale.description || "No description"}
          </p>
        </div>
        <span className="shrink-0 rounded bg-moon-800 px-2 py-0.5 text-xs text-violet-300">
          {presale.progressPercent}%
        </span>
      </div>
      <p className="mt-3 truncate font-mono text-[10px] text-zinc-600">
        {presale.mint}
      </p>
    </Link>
  );
}
