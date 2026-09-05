import clsx from "clsx";
import type { ReactNode } from "react";

type Tone =
  | "neutral"
  | "brand"
  | "success"
  | "warn"
  | "danger"
  | "seal"
  | "info";

const TONE_STYLE: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-2",
  brand: "bg-brand-50 text-brand-700",
  info: "bg-info-bg text-info",
  success: "bg-success-bg text-success",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  seal: "bg-seal-bg text-seal",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={clsx("badge", TONE_STYLE[tone], className)}>
      {dot && (
        <span
          className="size-1.5 rounded-full bg-current opacity-80"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export const LOT_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  OPEN: "success",
  CLOSED: "warn",
  AWARDED: "brand",
  CANCELLED: "neutral",
  FAILED: "danger",
};

export const COMPANY_STATUS_TONE: Record<string, Tone> = {
  PENDING: "neutral",
  UNDER_REVIEW: "warn",
  PROVISIONAL: "info",
  APPROVED: "success",
  SUSPENDED: "danger",
  EXPELLED: "danger",
};

export const CONTRACT_STATUS_TONE: Record<string, Tone> = {
  AWARDED: "brand",
  IN_CONTRACT: "info",
  AWAITING_PAYMENT: "warn",
  DELIVERED: "info",
  COMPLETED: "success",
};

export const BID_STATUS_TONE: Record<string, Tone> = {
  SEALED: "seal",
  REVEALED: "success",
  CANCELLED: "neutral",
  SUPERSEDED: "neutral",
};

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return <Tag className={clsx("card", className)}>{children}</Tag>;
}

export function SectionTitle({
  eyebrow,
  title,
  lead,
  className,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  className?: string;
}) {
  return (
    <div className={clsx("max-w-3xl", className)}>
      {eyebrow && (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
          {eyebrow}
        </p>
      )}
      <h2 className="text-balance text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      {lead && <p className="mt-3 text-[15px] text-ink-2">{lead}</p>}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="card fx relative overflow-hidden px-5 py-4">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-400 via-brand-600 to-transparent"
      />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span className="tnum text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Container({
  children,
  className,
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={clsx(
        "mx-auto w-full px-4 sm:px-6",
        wide ? "max-w-[1400px]" : "max-w-6xl",
        className
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.6-3.6" strokeLinecap="round" />
        </svg>
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body && <p className="max-w-md text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}
