"use client";

export type ToastKind = "info" | "success" | "error";

export function TransactionToast({
  message,
  kind,
  visible,
}: {
  message: string;
  kind: ToastKind;
  visible: boolean;
}) {
  if (!visible || !message) return null;

  const border =
    kind === "success"
      ? "border-emerald-500/40 bg-emerald-950/40"
      : kind === "error"
        ? "border-red-500/40 bg-red-950/40"
        : "border-violet-500/40 bg-moon-800/80";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-md rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur ${border}`}
      role="status"
    >
      {message}
    </div>
  );
}
