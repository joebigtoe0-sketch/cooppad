import { PortfolioClient } from "@/components/curve/PortfolioClient";

export const metadata = {
  title: "Portfolio — The Coop",
};

export default function PortfolioPage() {
  return (
    <div>
      <h1 className="font-display mb-2 text-2xl font-extrabold text-coop-ink dark:text-coop-shell">
        Portfolio
      </h1>
      <p className="mb-6 max-w-2xl text-sm text-coop-wood/85 dark:text-coop-shell/70">
        Your holdings, the tokens you created, and the fees you can claim.
      </p>
      <PortfolioClient />
    </div>
  );
}
