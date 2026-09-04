import type { ReactNode } from "react";

/**
 * Presentational form pieces. Kept free of `next/headers` so that client
 * components can import them without dragging a server-only module in.
 */

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-danger/25 bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger"
    >
      {children}
    </p>
  );
}

export function FormNotice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "warn";
}) {
  const cls =
    tone === "success"
      ? "border-success/25 bg-success-bg text-success"
      : tone === "warn"
        ? "border-warn/25 bg-warn-bg text-warn"
        : "border-info/25 bg-info-bg text-info";
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-sm ${cls}`}>{children}</div>
  );
}
