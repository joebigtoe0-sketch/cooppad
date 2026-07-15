import type { CurveTokenJson } from "@/types/curve";

const STYLES: Record<
  CurveTokenJson["flavor"],
  { icon: string; short: string; detail: string; cls: string }
> = {
  standard: {
    icon: "🪙",
    short: "Standard",
    detail: "Standard — clean token, 0% tax",
    cls: "bg-coop-wood/10 text-coop-wood/80 dark:bg-coop-shell/10 dark:text-coop-shell/70",
  },
  lpGrow: {
    icon: "🌱",
    short: "LP-Growing",
    detail: "LP-Growing — pool fees deepen locked liquidity",
    cls: "bg-coop-sky/10 text-coop-sky dark:bg-coop-sky/20",
  },
  superLp: {
    icon: "🔒",
    short: "Super LP",
    detail: "Super LP — 5% buy tax compounds into locked liquidity",
    cls: "bg-coop-orange/10 text-coop-orange dark:bg-coop-orange/20",
  },
};

/** Uniform token-type pill used everywhere a token appears. `detail` switches
 * to the long explanatory label (explorer cards); default is the short chip. */
export function FlavorBadge({
  flavor,
  detail = false,
  className = "",
}: {
  flavor: CurveTokenJson["flavor"];
  detail?: boolean;
  className?: string;
}) {
  const s = STYLES[flavor] ?? STYLES.standard;
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.cls} ${className}`}
    >
      {s.icon} {detail ? s.detail : s.short}
    </span>
  );
}
