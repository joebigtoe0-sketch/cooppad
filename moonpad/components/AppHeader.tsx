"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export function AppHeader() {
  return (
    <header className="border-b border-zinc-800/80 bg-moon-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Moon<span className="text-violet-400">Pad</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/launch"
            className="text-sm text-zinc-400 transition hover:text-white"
          >
            Launch
          </Link>
          <WalletMultiButton />
        </nav>
      </div>
    </header>
  );
}
