import Link from "next/link";

import { Callout, DocShell, Section } from "@/components/DocShell";

export const metadata = {
  title: "Docs — The Coop",
};

export default function DocsPage() {
  return (
    <DocShell title="How The Coop works">
      <Callout>
        The Coop is a token launchpad on <strong>Robinhood Chain</strong> (an
        Ethereum L2, gas paid in ETH). Anyone can launch a token for free — and
        every token trades on a <strong>real Uniswap v3 pool from its very
        first block</strong>, with 100% of the liquidity locked forever. No
        presale, no team allocation, no liquidity pull. Ever.
      </Callout>

      <Section heading="Launching a token">
        <p>
          Pick a name, ticker, and image, choose a token type, and confirm one
          transaction. Launching is free — you only pay network gas. That single
          transaction deploys the token, creates its Uniswap v3 pool, deposits
          the <strong>entire 1,000,000,000 supply</strong> as liquidity, and
          locks the position permanently. The pool is the market from second
          one — visible on DEX Screener, GMGN, and every other terminal that
          indexes Uniswap.
        </p>
        <p>
          You can optionally make a <strong>dev buy</strong> in the same
          transaction: your ETH buys the very first tokens atomically, before
          any sniper bot can front-run the launch.
        </p>
        <p>
          The supply is fixed — no minting, no owner, no blacklist — and the
          token address always ends in <code className="font-mono">…c00</code>.
        </p>
      </Section>

      <Section heading="The curve is the pool">
        <p>
          The launch deposits all tokens single-sided into the pool across a
          price range starting at the launch price. Nobody can sell below that
          floor (the pool holds no ETH yet), and every buy pushes the price up
          the range — exactly like a classic bonding curve, except it&apos;s a
          genuine Uniswap pool the whole time. ETH from buys accumulates
          <em> inside the locked position</em>.
        </p>
        <p>
          When the locked position has accumulated <strong>3.5 ETH</strong>,
          the token earns its <strong>graduated</strong> badge. Nothing changes
          on-chain — trading simply continues on the same pool — but the badge
          marks a token whose market found real demand.
        </p>
      </Section>

      <Section heading="Locked liquidity">
        <p>
          The Uniswap position is held by the locker contract, which has{" "}
          <strong>
            no function to withdraw liquidity — locked forever by construction
          </strong>
          . Nobody can pull it: not the creator, not the platform. What the
          locker can do is collect the pool&apos;s 1% swap fees — anyone can
          trigger a collection at any time — and route them per the token type.
        </p>
      </Section>

      <Section heading="Token types">
        <p>
          <strong>Standard</strong> — a fully clean ERC20, no transfer tax.
          Collected pool fees are split 50/50 between the creator and the
          platform.
        </p>
        <p>
          <strong>🌱 LP-Growing</strong> — also tax-free. 70% of collected pool
          fees are reinvested into the locked position (liquidity gets
          permanently deeper with volume); the remaining 30% splits 50/50
          between creator and platform.
        </p>
        <p>
          <strong>⚡ Super LP</strong> — carries a permanent{" "}
          <strong>5% tax on buys</strong> (sells are never taxed). The tax
          auto-compounds: it accumulates on the locker, and each collection
          sells half for ETH, pairs it with the other half, and mints the
          result into the locked position. 100% of the tax becomes permanently
          locked liquidity — the price floor deepens with every buy. Pool fees
          still split 50/50 like Standard.
        </p>
      </Section>

      <Section heading="Fees">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-coop-straw/40 text-xs uppercase tracking-wide text-coop-wood/60 dark:border-coop-700 dark:text-coop-shell/50">
                <th className="py-2 pr-4 font-semibold">Action</th>
                <th className="py-2 pr-4 font-semibold">Fee</th>
                <th className="py-2 font-semibold">Goes to</th>
              </tr>
            </thead>
            <tbody className="text-coop-wood/90 dark:text-coop-shell/75">
              <tr className="border-b border-coop-straw/20 dark:border-coop-800">
                <td className="py-2 pr-4">Launching a token</td>
                <td className="py-2 pr-4 font-mono">free</td>
                <td className="py-2">— (gas only)</td>
              </tr>
              <tr className="border-b border-coop-straw/20 dark:border-coop-800">
                <td className="py-2 pr-4">Every swap (Uniswap 1% pool tier)</td>
                <td className="py-2 pr-4 font-mono">1%</td>
                <td className="py-2">accrues to the locked position</td>
              </tr>
              <tr className="border-b border-coop-straw/20 dark:border-coop-800">
                <td className="py-2 pr-4">Collected pool fees (Standard, Super LP)</td>
                <td className="py-2 pr-4 font-mono">—</td>
                <td className="py-2">50% creator, 50% platform</td>
              </tr>
              <tr className="border-b border-coop-straw/20 dark:border-coop-800">
                <td className="py-2 pr-4">Collected pool fees (LP-Growing)</td>
                <td className="py-2 pr-4 font-mono">—</td>
                <td className="py-2">70% reinvested into locked liquidity, rest 50/50</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Buys of Super LP tokens</td>
                <td className="py-2 pr-4 font-mono">5%</td>
                <td className="py-2">100% auto-compounds into locked liquidity</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Creator earnings are paid <strong>straight to the creator&apos;s
          wallet</strong> every time the pool&apos;s fees are collected — no
          claiming step. Trigger a collection any time from your{" "}
          <Link href="/portfolio" className="underline hover:text-coop-orange">
            portfolio
          </Link>{" "}
          or the token page.
        </p>
      </Section>

      <Section heading="Trading tips">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Quotes are exact — they simulate the real swap, including the 1%
            pool fee and (for Super LP) the 5% buy tax.
          </li>
          <li>
            Slippage protection is adjustable in the trade panel (default 2%).
          </li>
          <li>
            Anti-snipe: buys in the launch block are blocked (except the
            creator&apos;s dev buy), and for the first 2 minutes each wallet can
            buy at most 2% of supply. Sells are never restricted.
          </li>
          <li>
            Because every token is a normal Uniswap v3 pair, you can also trade
            it on any terminal or aggregator that supports Robinhood Chain.
          </li>
        </ul>
      </Section>

      <Section heading="Risk, plainly">
        <p>
          Tokens launched here are speculative and most will lose value. Smart
          contracts can contain bugs; the platform&apos;s contracts have not
          undergone a formal third-party audit. Blockchain transactions are
          irreversible. Never trade more than you can afford to lose — see the{" "}
          <Link href="/terms" className="underline hover:text-coop-orange">
            Terms of Service
          </Link>{" "}
          for the full risk disclosure.
        </p>
      </Section>
    </DocShell>
  );
}
