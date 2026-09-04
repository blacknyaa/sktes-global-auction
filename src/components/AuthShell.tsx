import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { getDictionary, getLocale } from "@/i18n";

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
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="SK TES Global Auction">
            <Logo />
          </Link>
          <LocaleSwitcher current={locale} />
        </div>
      </header>

      <main
        id="main"
        className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16"
      >
        <div className={wide ? "w-full max-w-3xl" : "w-full max-w-md"}>
          <div className="card p-7 sm:p-8">
            <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
            {lead && <p className="mt-2 text-sm leading-relaxed text-ink-2">{lead}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-sm">{footer}</div>}
        </div>
      </main>

      <footer className="border-t border-line bg-surface py-4">
        <p className="text-center text-xs text-muted">
          {dict.footer.operator} · {dict.footer.demoNotice}
        </p>
      </footer>
    </div>
  );
}

export { FormError, FormNotice } from "./form";
