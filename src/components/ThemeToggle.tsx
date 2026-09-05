"use client";

import { useEffect, useState } from "react";

type Mode = "light" | "dark" | "system";

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    const stored = (localStorage.getItem("sktes_theme") as Mode | null) ?? "light";
    setMode(stored);
    apply(stored);
  }, []);

  function apply(next: Mode) {
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("sktes_theme", next);
    } catch {
      /* private browsing */
    }
  }

  function cycle() {
    const next: Mode = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next);
    apply(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${mode}`}
      aria-label={`Theme: ${mode}`}
      className="inline-flex size-8 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:bg-surface-3 hover:text-ink"
    >
      {mode === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      ) : mode === "light" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
