import type { ListingStatus, PresaleDecoded } from "@/types";

/** Derive UI bucket for explorer tabs (not an on-chain enum). */
export function computeListingStatus(p: PresaleDecoded, now: Date): ListingStatus {
  if (p.refundEnabled) return "refund";
  if (p.launched) return "filled";
  if (p.raiseTarget > 0n && p.totalRaised >= p.raiseTarget) return "launching";
  if (now.getTime() < p.startTime.getTime()) return "upcoming";
  if (now.getTime() > p.endTime.getTime()) return "ended";
  return "live";
}
