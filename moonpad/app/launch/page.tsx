import { CurveLaunchForm } from "@/components/curve/CurveLaunchForm";

export const metadata = {
  title: "Launch a token — The Coop",
};

export default function LaunchPage() {
  return (
    <div className="pb-8">
      <h1 className="font-display mb-2 text-2xl font-extrabold text-coop-ink dark:text-coop-shell">
        Launch a token
      </h1>
      <p className="mb-8 max-w-2xl text-sm text-coop-wood/85 dark:text-coop-shell/70">
        Your token trades on the bonding curve immediately — no upfront
        liquidity needed. Fill the curve to 3.5 ETH and it graduates into a
        Uniswap pool with the liquidity locked forever.
      </p>
      <CurveLaunchForm />
    </div>
  );
}
