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

  const styles =
    kind === "success"
      ? "border-coop-grass/40 bg-coop-grass-soft text-coop-grass"
      : kind === "error"
        ? "border-red-300 bg-red-50 text-red-900"
        : "border-coop-sky/35 bg-coop-sky-soft text-coop-ink";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-md rounded-lg border px-4 py-3 text-sm shadow-lg ${styles}`}
      role="status"
    >
      {message}
    </div>
  );
}
