export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="sktes-logo" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="var(--brand-500)" />
          <stop offset="100%" stopColor="var(--brand-900)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#sktes-logo)" />
      {/* stacked lots */}
      <rect x="10" y="24.5" width="20" height="3.2" rx="1.6" fill="#fff" opacity="0.95" />
      <rect x="12.5" y="19.6" width="15" height="3.2" rx="1.6" fill="#fff" opacity="0.6" />
      {/* seal / padlock shackle */}
      <path
        d="M15.5 17.5v-3.2a4.5 4.5 0 0 1 9 0v3.2"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={compact ? 28 : 34} />
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-ink">
          SK TES
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          Global Auction
        </span>
      </span>
    </span>
  );
}
