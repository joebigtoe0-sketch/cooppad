import Image from "next/image";
import Link from "next/link";

import { CurveExplorer } from "@/components/curve/CurveExplorer";

export default function HomePage() {
  return (
    <div className="space-y-8 pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-coop-straw/40 bg-gradient-to-br from-coop-surface via-coop-surface-warm to-orange-100/50 px-6 py-10 shadow-lg shadow-coop-ink/5 dark:border-coop-700 dark:from-coop-900 dark:via-coop-900 dark:to-coop-950 md:px-10 md:py-12">
        <div className="relative z-[1] max-w-xl">
          <p className="font-display text-3xl font-extrabold leading-tight text-coop-ink dark:text-coop-shell md:text-4xl">
            Launch a token.
            <br />
            Trade the curve.
            <br />
            <span className="text-coop-orange dark:text-coop-yolk">
              Graduate to Uniswap.
            </span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-coop-wood/85 dark:text-coop-shell/70">
            Every token trades on a bonding curve from block one. Fill the curve to{" "}
            <span className="font-mono font-semibold text-coop-ink dark:text-coop-yolk-soft">
              3.5 ETH
            </span>{" "}
            and it graduates into a Uniswap pool with the liquidity locked forever —
            live on Robinhood Chain.
          </p>
          <Link
            href="/launch"
            className="mt-6 inline-flex items-center rounded-xl bg-coop-ink px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-coop-orange dark:bg-coop-yolk dark:text-coop-950 dark:hover:bg-white"
          >
            Launch a token — it&apos;s free
          </Link>
        </div>
        <div
          className="pointer-events-none absolute -bottom-10 right-4 hidden select-none sm:block md:right-10"
          aria-hidden
        >
          <Image
            src="/character.png"
            alt=""
            width={200}
            height={200}
            priority
            className="rotate-3 rounded-3xl border border-coop-straw/60 shadow-xl shadow-coop-ink/10 dark:border-coop-700"
          />
        </div>
      </section>

      <CurveExplorer />

      <section className="text-center text-xs text-coop-wood/55 dark:text-coop-shell/45">
        <p>
          Direct link:{" "}
          <code className="rounded bg-coop-surface-warm px-1.5 py-0.5 font-mono text-coop-ink dark:bg-coop-800 dark:text-coop-shell">
            /coin/&lt;address&gt;
          </code>
        </p>
      </section>
    </div>
  );
}
