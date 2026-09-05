import Link from "next/link";
import { Logo } from "./Logo";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { Container } from "./ui";
import { PublicNav } from "./PublicNav";
import { getDictionary, getLocale } from "@/i18n";

export async function PublicHeader() {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md">
      <div className="ichimatsu-band text-[12px] font-bold text-brand">
        <Container wide className="flex h-8 items-center justify-between">
          <p className="font-serif tracking-wider">
            {locale === "zh"
              ? "SK TES 日本　运营　｜　法人限定　｜　封印投标"
              : locale === "en"
                ? "SK TES Japan  ·  Corporate only  ·  Sealed bid"
                : "SK TES 日本　運営　｜　法人限定　｜　封印入札"}
          </p>
          <p className="hidden font-serif tracking-wider sm:block">
            {locale === "zh" ? "世界21据点出品" : locale === "en" ? "Lots from 21 countries" : "世界21拠点から出品"}
          </p>
        </Container>
      </div>
      <Container wide className="relative flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label={dict.meta.siteName} className="fx">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {[
            { href: "/lots", label: dict.nav.lots },
            { href: "/guide", label: dict.nav.guide },
            { href: "/terms", label: dict.nav.terms },
          ].map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-bold text-ink-2 hover:bg-brand-50 hover:text-brand"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher current={locale} />
          <Link href="/login" className="btn btn-primary hidden sm:inline-flex">
            {dict.common.login}
          </Link>
          <PublicNav lots={dict.nav.lots} guide={dict.nav.guide} login={dict.common.login} />
        </div>
      </Container>
    </header>
  );
}
