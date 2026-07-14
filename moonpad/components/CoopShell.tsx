"use client";

import { useState } from "react";

import { CoopRightRail } from "@/components/CoopRightRail";
import { CoopSidebar } from "@/components/CoopSidebar";
import { CoopTopBar } from "@/components/CoopTopBar";

export function CoopShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-coop-canvas dark:bg-coop-950">
      <CoopSidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-coop-ink/35 backdrop-blur-[1px] dark:bg-black/50 md:hidden"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <CoopTopBar onMenu={() => setMenuOpen(true)} />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
          <CoopRightRail />
        </div>
      </div>
    </div>
  );
}
