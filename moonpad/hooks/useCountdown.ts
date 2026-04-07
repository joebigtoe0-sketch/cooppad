"use client";

import { useEffect, useState } from "react";

export function useCountdown(targetDate: Date | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetDate) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!targetDate) {
    return { label: "—", ended: false, secondsLeft: 0 };
  }

  const end = targetDate.getTime();
  const secondsLeft = Math.max(0, Math.floor((end - now) / 1000));
  const ended = secondsLeft <= 0;

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const label = ended
    ? "Ended"
    : `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

  return { label, ended, secondsLeft };
}
