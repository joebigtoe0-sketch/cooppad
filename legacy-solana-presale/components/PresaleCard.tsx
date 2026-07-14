"use client";

import Link from "next/link";

import { PresaleAvatar } from "@/components/PresaleAvatar";
import { ProgressBar } from "@/components/ProgressBar";
import { useCountdown } from "@/hooks/useCountdown";
import { launchUnlockAt } from "@/lib/presaleLaunch";
import type { ListingStatus, PresaleOnChainState } from "@/types";

const statusUi: Record<
  ListingStatus,
  { label: string; dot: boolean; className: string }
> = {
  live: {
    label: "Sale live",
    dot: true,
    className:
      "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  upcoming: {
    label: "Upcoming",
    dot: false,
    className:
      "bg-coop-sky-soft text-coop-sky dark:bg-coop-sky/25 dark:text-coop-sky-soft",
  },
  launching: {
    label: "Hatching soon",
    dot: true,
    className:
      "bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100",
  },
  filled: {
    label: "Just filled",
    dot: false,
    className:
      "bg-coop-orange-soft text-coop-orange dark:bg-coop-orange/20 dark:text-orange-200",
  },
  ended: {
    label: "Ended",
    dot: false,
    className: "bg-coop-straw/30 text-coop-wood dark:bg-coop-800 dark:text-coop-shell/70",
  },
  refund: {
    label: "Refunds",
    dot: false,
    className: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
  },
};

export function PresaleCard({ presale }: { presale: PresaleOnChainState }) {
  const launchAt = launchUnlockAt(presale);
  const countdownTarget =
    presale.listingStatus === "upcoming"
      ? presale.startTime
      : presale.listingStatus === "launching" && launchAt
        ? launchAt
        : presale.endTime;
  const countdown = useCountdown(countdownTarget);
  const raisedSol = (Number(presale.totalRaised) / 1e9).toFixed(2);
  const targetSol = (Number(presale.raiseTarget) / 1e9).toFixed(2);
  const st = statusUi[presale.listingStatus] ?? statusUi.live;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-coop-straw/35 bg-coop-surface shadow-md shadow-coop-ink/5 transition hover:border-coop-yolk/55 hover:shadow-lg dark:border-coop-700 dark:bg-coop-900/60 dark:shadow-black/20">
      <div className="relative aspect-[4/3] w-full bg-coop-surface-warm/50 dark:bg-coop-800/40">
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <PresaleAvatar
            mint={presale.mint}
            name={presale.tokenName}
            size="lg"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-bold text-coop-ink dark:text-coop-shell">
              {presale.tokenName || "Untitled"}
            </h3>
            <p className="text-sm font-medium text-coop-wood/80 dark:text-coop-shell/65">
              ${presale.tokenTicker || "???"}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${st.className}`}
          >
            {st.dot ? (
              <span
                className={`h-1.5 w-1.5 animate-pulse rounded-full ${
                  presale.listingStatus === "launching"
                    ? "bg-amber-500 dark:bg-amber-400"
                    : "bg-emerald-500 dark:bg-emerald-400"
                }`}
              />
            ) : null}
            {st.label}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-coop-wood/80 dark:text-coop-shell/65">
          {presale.description || "No description yet."}
        </p>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] font-medium text-coop-wood dark:text-coop-shell/75">
            <span>Raised {presale.progressPercent}%</span>
            <span className="font-mono text-coop-orange tabular-nums dark:text-coop-yolk">
              {presale.listingStatus === "upcoming"
                ? `Starts in ${countdown.label}`
                : presale.listingStatus === "launching"
                  ? `Hatch in ${countdown.label}`
                  : countdown.label}
            </span>
          </div>
          <ProgressBar percent={presale.progressPercent} />
          <div className="mt-1 text-[11px] text-coop-wood/70 dark:text-coop-shell/55">
            {raisedSol} / {targetSol} SOL
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-coop-wood/60 dark:text-coop-shell/50">
          <span>{presale.totalContributors} in the flock</span>
          <span
            className="max-w-[7rem] truncate font-mono"
            title={presale.mint}
          >
            {presale.mint.slice(0, 4)}…{presale.mint.slice(-4)}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            href={`/presale/${presale.mint}`}
            className="flex-1 rounded-xl border-2 border-coop-straw/50 py-2.5 text-center text-sm font-semibold text-coop-ink transition hover:border-coop-yolk hover:bg-coop-surface-warm/50 dark:border-coop-600 dark:text-coop-shell dark:hover:border-coop-yolk dark:hover:bg-coop-800"
          >
            View details
          </Link>
          <Link
            href={`/presale/${presale.mint}`}
            className="flex-1 rounded-xl bg-gradient-to-r from-coop-yolk to-coop-orange py-2.5 text-center text-sm font-semibold text-coop-ink shadow-sm transition hover:brightness-105 dark:from-coop-yolk dark:to-amber-600 dark:text-coop-950"
          >
            {presale.listingStatus === "live"
              ? "Join presale"
              : presale.listingStatus === "launching"
                ? "Hatch queue"
                : "Open"}
          </Link>
        </div>
      </div>
    </article>
  );
}
