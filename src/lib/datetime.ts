import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { Locale } from "./constants";
import { intlLocale } from "./format";

/**
 * Timezone policy for this platform:
 *   - every instant is stored in UTC,
 *   - every instant is rendered in the timezone of the person looking at it,
 *   - every instant shown to a user carries its zone label.
 *
 * A seller in Copenhagen setting a deadline of 17:00 and a buyer in Manila
 * reading it must be looking at the same moment. Getting this wrong is the
 * single most common source of disputes in cross-border auctions, so the
 * conversion lives in exactly one file.
 */

export function localInputToUtc(localValue: string, timezone: string): Date {
  // localValue is an <input type="datetime-local"> string: 2026-09-30T17:00
  return fromZonedTime(localValue, timezone);
}

export function utcToLocalInput(date: Date, timezone: string): string {
  const z = toZonedTime(date, timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}T${pad(
    z.getHours()
  )}:${pad(z.getMinutes())}`;
}

export function formatDateTime(
  date: Date,
  timezone: string,
  locale: Locale = "ja",
  opts: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
    ...opts,
  }).format(date);
}

export function formatDate(
  date: Date,
  timezone: string,
  locale: Locale = "ja"
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(date);
}

/** Short zone label, e.g. GMT+9 / JST, as the browser knows it. */
export function zoneLabel(
  date: Date,
  timezone: string,
  locale: Locale = "en"
): string {
  const parts = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timezone;
}

export function utcOffsetMinutes(date: Date, timezone: string): number {
  const asUtc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const asZoned = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  return Math.round((asZoned.getTime() - asUtc.getTime()) / 60000);
}

export type Countdown = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

export function countdown(target: Date, now: Date = new Date()): Countdown {
  const totalMs = target.getTime() - now.getTime();
  const clamped = Math.max(0, totalMs);
  return {
    totalMs,
    days: Math.floor(clamped / 86_400_000),
    hours: Math.floor((clamped % 86_400_000) / 3_600_000),
    minutes: Math.floor((clamped % 3_600_000) / 60_000),
    seconds: Math.floor((clamped % 60_000) / 1000),
    expired: totalMs <= 0,
  };
}

export function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
