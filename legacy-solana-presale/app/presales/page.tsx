import Link from "next/link";

import { HomePresaleExplorer } from "@/components/HomePresaleExplorer";

export const metadata = {
  title: "The Coop — Solana presales (legacy)",
};

/**
 * Legacy Solana presale explorer. Hidden from navigation while the Robinhood
 * Chain bonding curve is the primary product; direct links keep working.
 */
export default function PresalesPage() {
  return (
    <div className="space-y-10 pb-8">
      <section className="rounded-2xl border border-coop-straw/40 bg-coop-surface-warm/40 px-5 py-4 text-sm text-coop-wood/85 dark:border-coop-700 dark:bg-coop-800/40 dark:text-coop-shell/70">
        <p>
          <span className="font-bold">Legacy nest:</span> these are the original
          Solana presale eggs. The new bonding-curve coop lives on{" "}
          <Link href="/" className="font-semibold underline hover:text-coop-orange">
            the homepage
          </Link>
          .
        </p>
      </section>

      <HomePresaleExplorer />

      <section className="text-center text-xs text-coop-wood/55 dark:text-coop-shell/45">
        <p>
          Direct link:{" "}
          <code className="rounded bg-coop-surface-warm px-1.5 py-0.5 font-mono text-coop-ink dark:bg-coop-800 dark:text-coop-shell">
            /presale/&lt;mint&gt;
          </code>
        </p>
      </section>
    </div>
  );
}
