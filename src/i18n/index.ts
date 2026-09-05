import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";
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

/**
 * Resolves the language to render in, most specific first:
 *
 *   1. what this visitor picked with the switcher (cookie),
 *   2. the language stored on their account,
 *   3. Japanese.
 *
 * Step 2 matters on a platform with buyers in forty countries: a member in
 * Singapore whose account says English should not be handed a Japanese screen
 * just because they have never touched the switcher.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const chosen = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const user = await getCurrentUser();
  if (user && isLocale(user.locale)) return user.locale;

  return DEFAULT_LOCALE;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}

export function t(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
