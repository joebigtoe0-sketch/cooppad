"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import Link from "next/link";

import { CoinSearch } from "@/components/curve/CoinSearch";
import { ThemeToggle } from "@/components/ThemeToggle";

export function CoopTopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-coop-straw/35 bg-coop-surface/90 px-3 py-3 backdrop-blur-md dark:border-coop-700 dark:bg-coop-900/90 md:px-5">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-lg p-2 text-coop-ink hover:bg-coop-surface-warm dark:text-coop-shell dark:hover:bg-coop-800 md:hidden"
        aria-label="Open menu"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <Link
        href="/"
        className="flex items-center gap-2 font-display text-lg font-extrabold text-coop-wood md:hidden dark:text-coop-yolk-soft"
      >
        <Image src="/logo.png" alt="" width={28} height={28} className="rounded-lg" />
        <span>
          The <span className="text-coop-yolk">Coop</span>
        </span>
      </Link>

      <div className="flex flex-1 justify-center px-2">
        <CoinSearch />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <ConnectButton
          showBalance={false}
          chainStatus="icon"
          accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
        />
      </div>
    </header>
  );
}
