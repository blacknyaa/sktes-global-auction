"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  lots: (
    <>
      <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
      <path d="m3 12 9 4.5L21 12M3 16.5 12 21l9-4.5" />
    </>
  ),
  listing: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" />
    </>
  ),
  bid: (
    <>
      <path d="M14 4 20 10M11 7l6 6" />
      <path d="m5 19 6-6M3 21h8" strokeLinecap="round" />
    </>
  ),
  contract: (
    <>
      <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v6h6M9 14l2 2 4-4" strokeLinecap="round" />
    </>
  ),
  members: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16.5 6.2a3.2 3.2 0 0 1 0 6M18 20a6 6 0 0 0-2-4.5" />
    </>
  ),
  fraud: (
    <>
      <path d="M12 3 4 6.5v5c0 4.5 3.2 7.9 8 9.5 4.8-1.6 8-5 8-9.5v-5L12 3Z" />
      <path d="M12 9v4M12 16.2v.1" strokeLinecap="round" />
    </>
  ),
  audit: (
    <>
      <path d="M5 4h14v16l-4-2.5L12 20l-3-2.5L5 20V4Z" />
      <path d="M9 9h6M9 13h4" strokeLinecap="round" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" strokeLinecap="round" />
    </>
  ),
  report: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 16v-4M12 16V8M16 16v-6" strokeLinecap="round" />
    </>
  ),
  demo: (
    <>
      <path d="M9 3h6M10 3v6.2L5.4 18a2 2 0 0 0 1.7 3h9.8a2 2 0 0 0 1.7-3L14 9.2V3" />
      <path d="M7.5 15h9" strokeLinecap="round" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" strokeLinecap="round" />
    </>
  ),
};

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")) ||
          (item.href !== "/dashboard" && pathname === item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand text-on-brand"
                : "text-ink-2 hover:bg-surface-3 hover:text-ink"
            )}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
              className="shrink-0"
              aria-hidden="true"
            >
              {ICONS[item.icon] ?? ICONS.dashboard}
            </svg>
            <span className="truncate">{item.label}</span>
            {item.badge ? (
              <span
                className={clsx(
                  "tnum ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                  active ? "bg-white/20 text-white" : "bg-danger-bg text-danger"
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
