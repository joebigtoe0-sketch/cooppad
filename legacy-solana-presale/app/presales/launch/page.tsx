import { LaunchForm } from "@/components/LaunchForm";

export const metadata = {
  title: "Lay a Solana presale egg (legacy) — The Coop",
};

/** Legacy Solana presale launch, kept reachable but out of navigation. */
export default function LegacyLaunchPage() {
  return (
    <div>
      <h1 className="font-display mb-2 text-2xl font-extrabold text-coop-ink">
        Lay a Solana presale egg (legacy)
      </h1>
      <p className="mb-8 text-sm text-coop-wood/85">
        Connect your wallet and confirm the transaction. A new mint is created
        for you automatically. Treasury and program ID in{" "}
        <code className="rounded border border-coop-straw/35 bg-coop-surface-warm px-1.5 py-0.5 text-coop-ink">
          .env
        </code>{" "}
        must match your deployment.
      </p>
      <LaunchForm />
    </div>
  );
}
