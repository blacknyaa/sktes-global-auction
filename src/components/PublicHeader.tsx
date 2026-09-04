import Link from "next/link";
import { Logo } from "./Logo";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Container } from "./ui";
import { getDictionary, getLocale } from "@/i18n";

export async function PublicHeader() {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
      <Container wide className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="rounded-lg" aria-label="SK TES Global Auction">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/lots"
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-surface-3 hover:text-ink"
          >
            {dict.nav.lots}
          </Link>
          <Link
            href="/guide"
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-surface-3 hover:text-ink"
          >
            {dict.nav.guide}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher current={locale} />
          <Link href="/login" className="btn btn-primary">
            {dict.common.login}
          </Link>
        </div>
      </Container>
    </header>
  );
}
