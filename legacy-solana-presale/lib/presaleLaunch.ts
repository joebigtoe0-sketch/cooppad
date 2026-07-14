import { POST_GOAL_LAUNCH_DELAY_SECS } from "@/lib/presaleConstants";
import type { PresaleDecoded } from "@/types";

/** Earliest on-chain `launch_presale` time after the raise target is hit. */
export function launchUnlockAt(p: PresaleDecoded): Date | null {
  if (!p.goalReachedAt) return null;
  return new Date(
    p.goalReachedAt.getTime() + POST_GOAL_LAUNCH_DELAY_SECS * 1000
  );
}

export function canLaunchPresaleNow(p: PresaleDecoded, now: Date): boolean {
  if (p.launched || p.refundEnabled) return false;
  if (p.totalRaised < p.raiseTarget) return false;
  const at = launchUnlockAt(p);
  if (!at) return false;
  return now.getTime() >= at.getTime();
}
