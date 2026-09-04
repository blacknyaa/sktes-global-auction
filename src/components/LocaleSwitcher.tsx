"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, type Locale } from "@/lib/constants";

const LABELS: Record<Locale, string> = {
  ja: "日本語",
  en: "EN",
  zh: "中文",
};

export function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: Locale) {
    document.cookie = `sktes_locale=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="inline-flex items-center rounded-lg border border-line bg-surface p-0.5"
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          disabled={pending}
          aria-pressed={current === l}
          className={
            current === l
              ? "rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-on-brand"
              : "rounded-md px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink"
          }
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
