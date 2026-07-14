"use client";

import { useEffect, useState } from "react";

const KEY = "coop-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Dark is the default; "light" is the explicit opt-out.
    const stored = localStorage.getItem(KEY);
    const prefers = stored !== "light";
    setDark(prefers);
    document.documentElement.classList.toggle("dark", prefers);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(KEY, next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={() => toggle()}
      className="rounded-lg border border-coop-straw/40 bg-coop-surface-warm/80 p-2 text-coop-ink transition hover:border-coop-yolk/60 dark:border-coop-700 dark:bg-coop-800 dark:text-coop-shell"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? (
        <svg
          className="h-[18px] w-[18px]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4.25" />
          <path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4" />
        </svg>
      ) : (
        <svg
          className="h-[18px] w-[18px]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20.5 14.3A8.2 8.2 0 0 1 9.7 3.5a8.2 8.2 0 1 0 10.8 10.8Z" />
        </svg>
      )}
    </button>
  );
}
