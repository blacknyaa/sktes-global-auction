import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "../Logo";
import { LocaleSwitcher } from "../LocaleSwitcher";
import { ThemeToggle } from "../ThemeToggle";
import { NavLinks, type NavItem } from "./NavLinks";
import { Badge } from "../ui";
import { SubmitButton } from "../SubmitButton";
import { getDictionary, getLocale } from "@/i18n";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/session";
import { zoneLabel } from "@/lib/datetime";
import { usingBundledDemoDb } from "@/lib/runtime";

export async function ConsoleShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  const locale = await getLocale();
  const dict = await getDictionary();

  const pendingMembers =
    user.role === "ADMIN"
      ? await prisma.company.count({
          where: { type: "BUYER", status: { in: ["PENDING", "UNDER_REVIEW"] } },
        })
      : 0;
  const openSignals =
    user.role === "ADMIN"
      ? await prisma.fraudSignal.count({ where: { status: "OPEN" } })
      : 0;

  const items: NavItem[] = [{ href: "/dashboard", label: dict.nav.dashboard, icon: "dashboard" }];

  if (user.role === "BIDDER") {
    items.push(
      { href: "/lots", label: dict.nav.lots, icon: "lots" },
      { href: "/bids", label: dict.nav.myBids, icon: "bid" },
      { href: "/contracts", label: dict.nav.contracts, icon: "contract" },
      { href: "/reports", label: dict.nav.reports, icon: "report" }
    );
  }
  if (user.role === "SELLER") {
    items.push(
      { href: "/listings", label: dict.nav.listings, icon: "listing" },
      { href: "/lots", label: dict.nav.lots, icon: "lots" },
      { href: "/contracts", label: dict.nav.contracts, icon: "contract" },
      { href: "/reports", label: dict.nav.reports, icon: "report" }
    );
  }
  if (user.role === "ADMIN") {
    items.push(
      { href: "/lots", label: dict.nav.lots, icon: "lots" },
      { href: "/contracts", label: dict.nav.contracts, icon: "contract" },
      {
        href: "/admin/members",
        label: dict.nav.members,
        icon: "members",
        badge: pendingMembers || undefined,
      },
      {
        href: "/admin/fraud",
        label: dict.admin.fraudTitle,
        icon: "fraud",
        badge: openSignals || undefined,
      },
      { href: "/admin/notifications", label: dict.nav.notifications, icon: "bell" },
      { href: "/admin/audit", label: dict.nav.audit, icon: "audit" },
      { href: "/reports", label: dict.nav.reports, icon: "report" },
      { href: "/admin/demo", label: dict.nav.demo, icon: "demo" }
    );
  }
  items.push({ href: "/settings/security", label: dict.nav.settings, icon: "settings" });

  const roleTone =
    user.role === "ADMIN" ? "brand" : user.role === "SELLER" ? "info" : "success";

  return (
    <div className="flex min-h-dvh bg-bg">
      {/* sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center border-b border-line px-4">
          <Link href="/dashboard" aria-label="SK TES Global Auction">
            <Logo />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks items={items} />
        </div>

        <div className="border-t border-line p-3">
          <div className="rounded-lg bg-surface-2 p-3">
            <Badge tone={roleTone}>{dict.role[user.role]}</Badge>
            <p className="mt-2 truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">
              {user.company
                ? locale === "ja"
                  ? user.company.name
                  : user.company.nameEn
                : user.email}
            </p>
            <p className="mt-1.5 text-[11px] text-muted">
              {user.timezone} · {zoneLabel(new Date(), user.timezone)}
            </p>
          </div>
          <form action={logoutAction} className="mt-2">
            <SubmitButton className="btn-ghost w-full" pendingLabel={dict.common.processing}>
              {dict.common.logout}
            </SubmitButton>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <Link href="/dashboard" className="lg:hidden" aria-label="SK TES">
              <Logo compact />
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-xs text-muted sm:block">
                {user.email}
              </span>
              <ThemeToggle />
              <LocaleSwitcher current={locale} />
              <form action={logoutAction} className="lg:hidden">
                <SubmitButton className="btn-ghost px-3 py-1.5 text-xs">
                  {dict.common.logout}
                </SubmitButton>
              </form>
            </div>
          </div>

          {/* mobile nav */}
          <div className="overflow-x-auto border-t border-line px-2 pb-2 lg:hidden">
            <div className="flex min-w-max gap-1 pt-2">
              {items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-surface-3"
                >
                  {i.label}
                  {i.badge ? (
                    <span className="ml-1 rounded-full bg-danger-bg px-1.5 text-[10px] font-bold text-danger">
                      {i.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </header>

        {/*
          Without a configured database the app runs from a copy of the
          bundled demo data held per instance, and a serverless host spreads
          consecutive requests across many instances - measured at nine to
          twenty in a single browsing session. Reading is therefore perfect
          and consistent, while a write survives only if the next request
          happens to land on the same instance. Saying so plainly is better
          than letting someone place a bid and wonder why it vanished.
        */}
        {usingBundledDemoDb() && (
          <div className="border-b border-warn/30 bg-warn-bg px-4 py-2.5 sm:px-6">
            <p className="text-xs leading-relaxed text-warn">
              <span className="font-bold">簡易デモモードで動作中です。</span>{" "}
              全画面をご覧いただけますが、入札や承認などの操作結果は保存されない場合があります。
              データベースを接続すると、操作内容がそのまま保持されます。
            </p>
          </div>
        )}

        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>

        <footer className="border-t border-line bg-surface px-4 py-3 sm:px-6">
          <p className="text-xs text-muted">
            {dict.footer.operator} ·{" "}
            <span className="font-semibold text-warn">{dict.footer.demoNotice}</span>
          </p>
        </footer>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  lead,
  actions,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {lead && <p className="mt-1 text-sm text-ink-2">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
