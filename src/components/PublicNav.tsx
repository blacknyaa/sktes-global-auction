"use client";

import { useState } from "react";
import Link from "next/link";

export function PublicNav({
  lots,
  guide,
  login,
}: {
  lots: string;
  guide: string;
  login: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-2 hover:bg-surface-3"
        aria-expanded={open}
        aria-controls="public-mobile-nav"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">Menu</span>
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && (
        <div
          id="public-mobile-nav"
          className="absolute inset-x-0 top-full border-b border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur-md"
        >
          <nav className="flex flex-col gap-1">
            <Link href="/lots" className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink" onClick={() => setOpen(false)}>
              {lots}
            </Link>
            <Link href="/guide" className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink" onClick={() => setOpen(false)}>
              {guide}
            </Link>
            <Link href="/login" className="btn btn-primary mt-2" onClick={() => setOpen(false)}>
              {login}
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
