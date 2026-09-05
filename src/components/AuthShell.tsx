import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { getDictionary, getLocale } from "@/i18n";
import { CornerMarks } from "./visual/Ornaments";
import { Hanko } from "./visual/Hanko";

export async function AuthShell({
  title,
  lead,
  children,
  footer,
  wide = false,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-2">
      <aside className="relative hidden min-h-dvh overflow-hidden lg:block">
        <CornerMarks />
        <Image
          src="/images/hero-bright.png"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="50vw"
        />
        <span className="hashira-banner">
          {locale === "zh" ? "封印投标" : locale === "en" ? "Sealed Bid" : "封印入札"}
        </span>
        <Hanko className="stamp-in absolute right-8 top-8 z-10" size={96} />
        <div className="absolute inset-x-0 bottom-0 bg-surface/94 p-8 backdrop-blur-sm">
          <Logo />
          <p className="font-serif mt-3 text-lg font-bold text-ink">{dict.meta.tagline}</p>
          <ul className="mt-4 space-y-2 text-sm text-ink-2">
            <li>・ {dict.home.features.sealTitle}</li>
            <li>・ {dict.home.features.mfaTitle}</li>
            <li>・ {dict.home.features.timezoneTitle}</li>
          </ul>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col bg-surface">
        <header className="border-b border-line">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="lg:hidden" aria-label="SK TES Global Auction">
              <Logo />
            </Link>
            <span className="font-serif hidden text-sm font-bold tracking-wider text-ink-2 lg:inline">
              {title}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <LocaleSwitcher current={locale} />
            </div>
          </div>
        </header>

        <main id="main" className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
          <div className={wide ? "washi-scroll relative w-full max-w-3xl p-6 sm:p-8" : "washi-scroll relative w-full max-w-md p-6 sm:p-8"}>
            <CornerMarks />
            <h1 className="font-serif text-2xl font-bold tracking-wide text-ink">{title}</h1>
            {lead && <p className="mt-2 text-sm leading-relaxed text-ink-2">{lead}</p>}
            <span className="mizuhiki" />
            <div className="mt-6">{children}</div>
            {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
          </div>
        </main>

        <footer className="ichimatsu-band border-t border-line py-4">
          <p className="text-center text-xs text-muted">
            {dict.footer.operator} · {dict.footer.demoNotice}
          </p>
        </footer>
      </div>
    </div>
  );
}

export { FormError, FormNotice } from "./form";
