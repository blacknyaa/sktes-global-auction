import Link from "next/link";
import { Container } from "./ui";
import { LogoMark } from "./Logo";
import { getDictionary } from "@/i18n";

export async function SiteFooter() {
  const dict = await getDictionary();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <Container wide className="flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="text-sm font-bold text-ink">SK TES Global Auction</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {dict.meta.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
              Platform
            </p>
            <ul className="space-y-1.5">
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
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
              Security
            </p>
            <p className="text-xs leading-relaxed text-muted">
              {dict.footer.security}
            </p>
          </div>
        </div>
      </Container>

      <div className="border-t border-line">
        <Container
          wide
          className="flex flex-col gap-1 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            &copy; {year} {dict.footer.operator}
          </p>
          <p className="font-semibold text-warn">{dict.footer.demoNotice}</p>
        </Container>
      </div>
    </footer>
  );
}
