import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/constants";
import { ja, type Dictionary } from "./ja";
import { en } from "./en";
import { zh } from "./zh";

export const dictionaries: Record<Locale, Dictionary> = { ja, en, zh };

export const LOCALE_COOKIE = "sktes_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
  zh: "中文",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Reads the viewer locale from the cookie. Server components only. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}

export function t(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
