import { LaunchForm } from "@/components/LaunchForm";

export default function LaunchPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-white">Launch a presale</h1>
      <p className="mb-8 text-sm text-zinc-500">
        Connect your wallet and confirm the transaction. A new mint is created
        for you automatically. Treasury and program ID in{" "}
        <code className="rounded bg-moon-800 px-1 text-violet-300">.env</code>{" "}
        must match your deployment.
      </p>
      <LaunchForm />
    </div>
  );
}
