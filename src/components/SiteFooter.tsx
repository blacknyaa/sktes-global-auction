import Link from "next/link";
import { Container } from "./ui";
import { LogoMark } from "./Logo";
import { getDictionary, getLocale } from "@/i18n";
import { SELLER_SITES } from "./visual/art";
import { countryFlag } from "@/lib/format";
import { Crane } from "./visual/Ornaments";

export async function SiteFooter() {
  const dict = await getDictionary();
  const locale = await getLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-surface">
      <div className="wave-band" />
      <Container wide className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark size={32} />
            <div>
              <p className="text-[15px] font-extrabold text-ink">SK TES</p>
              <p className="font-serif text-[11px] font-bold tracking-[0.18em] text-brand">
                {dict.meta.brandSub}
              </p>
            </div>
            <Crane size={40} className="ml-auto hidden sm:block" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-2">{dict.meta.description}</p>
        </div>
        <div>
          <p className="font-serif text-xs font-extrabold tracking-[0.2em] text-brand">案内</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/lots" className="text-ink-2 hover:text-brand">
                {dict.nav.lots}
              </Link>
            </li>
            <li>
              <Link href="/guide" className="text-ink-2 hover:text-brand">
                {dict.nav.guide}
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-ink-2 hover:text-brand">
                {dict.nav.terms}
              </Link>
            </li>
            <li>
              <Link href="/register" className="text-ink-2 hover:text-brand">
                {dict.common.register}
              </Link>
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted">{dict.footer.security}</p>
        </div>
        <div>
          <p className="font-serif text-xs font-extrabold tracking-[0.2em] text-brand">
            {dict.home.statsCountries}
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {SELLER_SITES.map((s) => (
              <li
                key={s.code}
                className="fx rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-ink"
              >
                {countryFlag(s.code)} {locale === "ja" ? s.ja : locale === "zh" ? s.zh : s.en}
              </li>
            ))}
          </ul>
        </div>
      </Container>
      <div className="ichimatsu-band border-t border-line">
        <Container wide className="flex flex-col gap-1 py-3 text-xs text-ink-2 sm:flex-row sm:justify-between">
          <p>
            &copy; {year} {dict.footer.operator}
          </p>
          <p className="font-bold text-warn">{dict.footer.demoNotice}</p>
        </Container>
      </div>
    </footer>
  );
}
