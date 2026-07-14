import Link from "next/link";

import { Callout, DocShell, Section } from "@/components/DocShell";

export const metadata = {
  title: "Docs — The Coop",
};

export default function DocsPage() {
  return (
    <DocShell title="How The Coop works">
      <Callout>
        The Coop is a bonding-curve token launchpad on{" "}
        <strong>Robinhood Chain</strong> (an Ethereum L2, gas paid in ETH).
        Anyone can launch a token for free; it trades instantly on an automated
        curve, and when the curve fills it graduates into a Uniswap v3 pool with
        the liquidity locked forever.
      </Callout>

      <Section heading="Launching a token">
        <p>
          Pick a name, ticker, and image, choose a token type, and confirm one
          transaction. Launching is free — you only pay network gas. There is no
          upfront liquidity requirement: the bonding curve is the market from
          block one.
        </p>
        <p>
          You can optionally make a <strong>dev buy</strong> in the same
          transaction: your ETH buys the very first tokens atomically, before
          any sniper bot can front-run the launch.
        </p>
        <p>
          Every token has a fixed supply of <strong>1,000,000,000</strong>. No
          more can ever be minted, and the launchpad holds the entire supply at
          creation — there are no team allocations unless the creator buys on
          the curve like everyone else.
        </p>
      </Section>

      <Section heading="The bonding curve">
        <p>
          Tokens trade on a constant-product curve (the same math as Uniswap,
          with virtual reserves). Buys push the price up, sells push it down,
          and the contract is always the counterparty — there is no order book
          and no liquidity provider.
        </p>
        <p>
          About <strong>790.6M tokens</strong> (~79% of supply) are sold on the
          curve. The curve completes when it has raised{" "}
          <strong>3.5 ETH</strong>. Buys that would overshoot the target are
          partially filled with the excess refunded automatically.
        </p>
        <p>
          Until graduation, tokens can only move between your wallet and the
          launchpad — wallet-to-wallet transfers unlock after graduation. This
          prevents anyone from setting up a fake pool mid-curve.
        </p>
      </Section>

      <Section heading="Graduation">
        <p>When the curve raises 3.5 ETH, the token graduates automatically:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            The raised ETH (minus a flat 0.1 ETH graduation fee) is paired with
            the remaining token supply into a full-range{" "}
            <strong>Uniswap v3 pool at the 1% fee tier</strong>, opened at the
            exact final curve price — no price gap.
          </li>
          <li>
            The position is held by the locker contract, which has{" "}
            <strong>
              no function to withdraw liquidity — locked forever by construction
            </strong>
            . Nobody can pull it, ever.
          </li>
          <li>Leftover unpaired tokens are burned, reducing supply.</li>
          <li>
            The bonding curve closes for good; all further trading happens on
            Uniswap. The locked position keeps earning the pool&apos;s swap
            fees, which anyone can trigger for distribution.
          </li>
        </ul>
      </Section>

      <Section heading="Token types">
        <p>
          Every Coop token is a fully clean, immutable ERC20 — no owner, no
          minting, no transfer taxes, no blacklist, and the address always ends
          in <code className="font-mono">…c00</code>. Fees live in the Uniswap
          pool, never in the token, so wallets and scanners see a plain token.
          The two types differ only in where the locked position&apos;s fee
          stream goes:
        </p>
        <p>
          <strong>Standard</strong> — collected pool fees are split 50/50
          between the creator and the platform.
        </p>
        <p>
          <strong>LP-Growing</strong> — 70% of collected pool fees are
          reinvested into the locked position (liquidity gets permanently
          deeper with volume); the remaining 30% is split 50/50 between creator
          and platform.
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
                <td className="py-2 pr-4">Curve buys &amp; sells</td>
                <td className="py-2 pr-4 font-mono">1%</td>
                <td className="py-2">0.5% platform, 0.5% creator</td>
              </tr>
              <tr className="border-b border-coop-straw/20 dark:border-coop-800">
                <td className="py-2 pr-4">Graduation</td>
                <td className="py-2 pr-4 font-mono">0.1 ETH</td>
                <td className="py-2">platform</td>
              </tr>
              <tr className="border-b border-coop-straw/20 dark:border-coop-800">
                <td className="py-2 pr-4">Uniswap swaps (after graduation)</td>
                <td className="py-2 pr-4 font-mono">1%</td>
                <td className="py-2">pool fee tier — accrues to the locked position</td>
              </tr>
              <tr className="border-b border-coop-straw/20 dark:border-coop-800">
                <td className="py-2 pr-4">Collected pool fees (Standard)</td>
                <td className="py-2 pr-4 font-mono">—</td>
                <td className="py-2">50% creator, 50% platform</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Collected pool fees (LP-Growing)</td>
                <td className="py-2 pr-4 font-mono">—</td>
                <td className="py-2">70% reinvested into locked liquidity, rest 50/50</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Creator earnings accrue on-chain and are claimable any time from your{" "}
          <Link href="/portfolio" className="underline hover:text-coop-orange">
            portfolio
          </Link>
          .
        </p>
      </Section>

      <Section heading="Trading tips">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Quotes come straight from the contract and include the 1% curve fee.
          </li>
          <li>
            Slippage protection is adjustable in the trade panel (default 2%).
          </li>
          <li>
            Prices can be shown in USD or ETH — toggle in the top bar. USD
            values use a live ETH price and are estimates.
          </li>
          <li>
            A buy that completes the curve pays only what is needed; the rest is
            refunded in the same transaction.
          </li>
          <li>
            Anti-snipe: for the first 2 minutes after a launch, each wallet can
            buy at most 2% of supply (the creator&apos;s dev buy is exempt).
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
