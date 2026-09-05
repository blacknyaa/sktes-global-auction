import { getDictionary } from "@/i18n";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="logo-mon shrink-0"
    >
      <circle cx="20" cy="20" r="19" fill="#163a6b" />
      <circle cx="20" cy="20" r="16.4" fill="none" stroke="#c9a24a" strokeWidth="1.35" />
      <circle cx="20" cy="20" r="14.2" fill="none" stroke="#fff8e7" strokeWidth="0.6" opacity="0.45" />
      <path
        d="M8.5 24c3.8-7 7.7-7 11.5 0"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M20 24c3.8-7 7.7-7 11.5 0"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13 26.5c2.3-4.2 4.7-4.2 7 0"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx="20" cy="14.2" r="3.1" fill="#d42b2b" />
      <circle cx="20" cy="14.2" r="1.3" fill="#fff8e7" />
    </svg>
  );
}

export async function Logo({
  compact = false,
  inverted = false,
}: {
  compact?: boolean;
  inverted?: boolean;
}) {
  const dict = await getDictionary();

  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={compact ? 28 : 34} />
      <span className="leading-tight">
        <span
          className={
            inverted
              ? "block text-[15px] font-extrabold text-white"
              : "block text-[15px] font-extrabold text-ink"
          }
        >
          SK TES
        </span>
        <span
          className={
            inverted
              ? "block font-serif text-[11px] font-bold tracking-[0.18em] text-white/80"
              : "block font-serif text-[11px] font-bold tracking-[0.18em] text-brand"
          }
        >
          {dict.meta.brandSub}
        </span>
      </span>
    </span>
  );
}
