import type { Locale } from "./constants";

/**
 * Money is held as integer cents so that no rounding error can ever creep
 * into a bid or an invoice. Nothing in this codebase does arithmetic on a
 * floating-point currency value.
 */

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "IDR"]);

export function minorUnits(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
}

export function formatMoney(
  cents: number,
  currency = "USD",
  locale: Locale = "ja"
): string {
  const value = cents / 100;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(currency === "JPY" ? Math.round(value) : value);
}

export function formatNumber(n: number, locale: Locale = "ja"): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(n);
}

export function formatPercent(
  ratio: number,
  locale: Locale = "ja",
  digits = 1
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
}

export function intlLocale(locale: Locale): string {
  return locale === "ja" ? "ja-JP" : locale === "zh" ? "zh-CN" : "en-US";
}

/** Converts USD cents into another currency using a captured rate. */
export function convertCents(
  cents: number,
  rate: number,
  targetCurrency: string
): number {
  const raw = (cents / 100) * rate;
  return ZERO_DECIMAL_CURRENCIES.has(targetCurrency)
    ? Math.round(raw) * 100
    : Math.round(raw * 100);
}

/** Indicative rates, captured at award time in the real system. */
export const FX_RATES: Record<string, number> = {
  USD: 1,
  JPY: 147.2,
  EUR: 0.92,
  GBP: 0.78,
  SGD: 1.34,
  AUD: 1.51,
  NZD: 1.64,
  KRW: 1362,
  HKD: 7.81,
  TWD: 31.8,
  CNY: 7.13,
  THB: 34.2,
  MYR: 4.42,
  IDR: 15850,
  VND: 25400,
  PHP: 56.4,
  DKK: 6.86,
  INR: 83.4,
  AED: 3.67,
  BRL: 5.42,
  MXN: 18.1,
  ZAR: 18.3,
  PLN: 3.94,
  TRY: 33.1,
  CAD: 1.36,
  SAR: 3.75,
  EGP: 48.2,
  NGN: 1580,
  PKR: 278,
  BDT: 118,
  CLP: 935,
  PEN: 3.75,
};

/** ISO 3166-1 alpha-2 to the regional-indicator flag emoji. */
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}
