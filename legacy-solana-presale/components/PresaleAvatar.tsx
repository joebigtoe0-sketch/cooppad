"use client";

import { useMemo, useState } from "react";

function hueFromMint(mint: string): number {
  let h = 0;
  for (let i = 0; i < mint.length; i++) {
    h = (Math.imul(31, h) + mint.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

const sizes = {
  sm: "h-10 w-10 rounded-lg text-xs",
  md: "h-16 w-16 rounded-xl text-sm",
  lg: "h-24 w-24 rounded-2xl text-xl",
} as const;

export function PresaleAvatar({
  mint,
  name,
  size = "md",
}: {
  mint: string;
  name: string;
  size?: keyof typeof sizes;
}) {
  const [broken, setBroken] = useState(false);
  const src = `/api/presale/image/${encodeURIComponent(mint)}`;
  const hue = useMemo(() => hueFromMint(mint), [mint]);
  const initials = (name.trim() || "?").slice(0, 2).toUpperCase();
  const dim = sizes[size];

  if (!broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- same-origin API, avoid image optimizer config
      <img
        src={src}
        alt=""
        className={`${dim} shrink-0 bg-coop-straw/20 object-cover dark:bg-coop-800`}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center font-display font-bold text-white shadow-inner`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 72%, 42%), hsl(${(hue + 48) % 360}, 68%, 32%))`,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
