"use client";

export function ProgressBar({
  percent,
  label,
}: {
  percent: number;
  label?: string;
}) {
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div className="w-full">
      {label ? (
        <div className="mb-1 flex justify-between text-xs text-coop-wood/85">
          <span>{label}</span>
          <span>{p}%</span>
        </div>
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-coop-straw/35">
        <div
          className="h-full rounded-full bg-gradient-to-r from-coop-yolk to-coop-orange transition-all duration-500"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}
