"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string; disabled?: boolean };

const items: NavItem[] = [
  { href: "/", label: "The Coop", icon: "◇" },
  { href: "/launch", label: "Launch token", icon: "◎" },
  { href: "/portfolio", label: "Portfolio", icon: "▤" },
  { href: "/docs", label: "Docs", icon: "▧" },
];

export function CoopSidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-coop-straw/35 bg-coop-surface/98 shadow-sm backdrop-blur-md transition-transform dark:border-coop-700 dark:bg-coop-900/98 md:static md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      <div className="border-b border-coop-straw/25 px-4 py-5 dark:border-coop-700">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight text-coop-wood dark:text-coop-yolk-soft"
        >
          <Image
            src="/logo.png"
            alt="The Coop"
            width={36}
            height={36}
            className="rounded-xl"
            priority
          />
          <span>
            The <span className="text-coop-yolk">Coop</span>
          </span>
        </Link>
        <p className="mt-1 text-[11px] leading-snug text-coop-wood/65 dark:text-coop-shell/55">
          Token launchpad on Robinhood Chain
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-4">
        {items.map((item) => {
          const active = !item.disabled && pathname === item.href;
          const cls = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            item.disabled
              ? "cursor-not-allowed text-coop-wood/35 dark:text-coop-shell/25"
              : active
                ? "bg-coop-yolk/20 text-coop-ink dark:bg-coop-yolk/15 dark:text-coop-shell"
                : "text-coop-wood/90 hover:bg-coop-surface-warm/80 dark:text-coop-shell/80 dark:hover:bg-coop-800"
          }`;
          if (item.disabled) {
            return (
              <span key={item.label} className={cls}>
                <span className="w-5 text-center opacity-70">{item.icon}</span>
                {item.label}
                <span className="ml-auto text-[10px] font-normal text-coop-wood/40">
                  soon
                </span>
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cls}
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-coop-straw/25 p-4 dark:border-coop-700">
        <p className="text-[10px] font-medium uppercase tracking-wider text-coop-wood/50 dark:text-coop-shell/45">
          Community
        </p>
        <div className="mt-2 flex gap-3 text-coop-wood/70 dark:text-coop-shell/60">
          <a
            href="https://x.com/thecoopdotfun"
            target="_blank"
            rel="noreferrer"
            aria-label="The Coop on X"
            className="text-sm transition hover:text-coop-orange"
          >
            𝕏
          </a>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-coop-wood/50 dark:text-coop-shell/40">
          <Link href="/docs" onClick={onNavigate} className="hover:text-coop-orange hover:underline">
            Docs
          </Link>
          <span>·</span>
          <Link href="/terms" onClick={onNavigate} className="hover:text-coop-orange hover:underline">
            Terms
          </Link>
          <span>·</span>
          <Link href="/privacy" onClick={onNavigate} className="hover:text-coop-orange hover:underline">
            Privacy
          </Link>
        </div>
      </div>
    </aside>
  );
}
