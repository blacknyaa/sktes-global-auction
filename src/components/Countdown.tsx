"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

type Props = {
  /** ISO 8601 UTC instant. */
  endAt: string;
  /** Server-rendered first paint, so the markup matches before hydration. */
  initial: string;
  className?: string;
  /** Turns amber under an hour and red under five minutes. */
  urgency?: boolean;
  expiredLabel?: string;
};

function render(diffMs: number, expiredLabel: string): string {
  if (diffMs <= 0) return expiredLabel;
  const s = Math.floor(diffMs / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0
    ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`
    : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function Countdown({
  endAt,
  initial,
  className,
  urgency = true,
  expiredLabel = "終了",
}: Props) {
  const target = new Date(endAt).getTime();
  const [text, setText] = useState(initial);
  const [diff, setDiff] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const d = target - Date.now();
      setDiff(d);
      setText(render(d, expiredLabel));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, expiredLabel]);

  const tone =
    !urgency || diff === null
      ? "text-ink"
      : diff <= 0
        ? "text-muted"
        : diff < 300_000
          ? "text-danger animate-urgent"
          : diff < 3_600_000
            ? "text-warn"
            : "text-ink";

  return (
    <span
      className={clsx("tnum font-semibold", tone, className)}
      suppressHydrationWarning
    >
      {text}
    </span>
  );
}
