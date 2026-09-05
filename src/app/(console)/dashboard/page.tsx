import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Badge, Card, Stat } from "@/components/ui";
import { BarList, ProportionBar, TrendChart } from "@/components/charts";
import { Countdown } from "@/components/Countdown";
import { countryFlag, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { LOT_STATUSES } from "@/lib/constants";
import { countdown, formatDateTime } from "@/lib/datetime";
import { sweepLotLifecycle } from "@/lib/lotQuery";

export const metadata: Metadata = { title: "ダッシュボード" };
export const dynamic = "force-dynamic";

function initialCd(target: Date, now: Date) {
  const c = countdown(target, now);
  const p = (n: number) => String(n).padStart(2, "0");
  return c.days > 0
    ? `${c.days}d ${p(c.hours)}:${p(c.minutes)}:${p(c.seconds)}`
    : `${p(c.hours)}:${p(c.minutes)}:${p(c.seconds)}`;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const dict = await getDictionary();
  const locale = await getLocale();
  const now = new Date();
  await sweepLotLifecycle(now);

  const scope: Prisma.LotWhereInput =
    user.role === "SELLER" && user.companyId
      ? { sellerCompanyId: user.companyId }
      : {};

  const awardWhere: Prisma.AwardWhereInput =
    user.role === "SELLER" && user.companyId
      ? { lot: { sellerCompanyId: user.companyId } }
      : user.role === "BIDDER" && user.companyId
        ? { winnerCompanyId: user.companyId }
        : {};

  const bidWhere: Prisma.BidWhereInput =
    user.role === "BIDDER" && user.companyId
      ? { bidderCompanyId: user.companyId }
      : user.role === "SELLER" && user.companyId
        ? { lot: { sellerCompanyId: user.companyId } }
        : {};

  const [openLots, closingSoon, awardCount, awardSum, bidCount, closedCount] =
    await Promise.all([
      prisma.lot.count({ where: { ...scope, status: "OPEN" } }),
      prisma.lot.findMany({
        where: { ...scope, status: "OPEN" },
        orderBy: { endAt: "asc" },
        take: 5,
        include: { country: true, _count: { select: { bids: true } } },
      }),
      prisma.award.count({ where: awardWhere }),
      prisma.award.aggregate({
        _sum: { amountCents: true },
        where: awardWhere,
      }),
      prisma.bid.count({ where: bidWhere }),
      prisma.lot.count({
        where: { ...scope, status: { in: ["AWARDED", "FAILED", "CLOSED"] } },
      }),
    ]);

  const winRate = closedCount > 0 ? awardCount / closedCount : 0;

  const pendingMembers =
    user.role === "ADMIN"
      ? await prisma.company.findMany({
          where: { type: "BUYER", status: { in: ["PENDING", "UNDER_REVIEW"] } },
          orderBy: { appliedAt: "asc" },
          take: 5,
          include: { country: true, _count: { select: { documents: true } } },
        })
      : [];

  const signals =
    user.role === "ADMIN"
      ? await prisma.fraudSignal.findMany({
          where: { status: { in: ["OPEN", "REVIEWING"] } },
          orderBy: { createdAt: "desc" },
          take: 4,
        })
      : [];

  const myBids =
    user.role === "BIDDER" && user.companyId
      ? await prisma.bid.findMany({
          where: { bidderCompanyId: user.companyId, status: "SEALED" },
          orderBy: { submittedAt: "desc" },
          take: 5,
          include: { lot: { include: { country: true } } },
        })
      : [];

  const recentAudit =
    user.role === "ADMIN"
      ? await prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [];

  // --- admin analytics -----------------------------------------------------
  const [byCountry, byStatus, awardRows, countryNames] =
    user.role === "ADMIN"
      ? await Promise.all([
          prisma.lot.groupBy({ by: ["countryCode"], _count: true, _sum: { quantity: true } }),
          prisma.lot.groupBy({ by: ["status"], _count: true }),
          prisma.award.findMany({
            select: { selectedAt: true, amountCents: true },
            orderBy: { selectedAt: "asc" },
          }),
          prisma.country.findMany({ select: { code: true, nameJa: true, nameEn: true } }),
        ])
      : [[], [], [], []];

  const nameOf = new Map(
    countryNames.map((c) => [c.code, locale === "ja" ? c.nameJa : c.nameEn])
  );

  const countryBars = byCountry
    .map((g) => ({
      label: `${countryFlag(g.countryCode)} ${nameOf.get(g.countryCode) ?? g.countryCode}`,
      value: g._count,
      hint: `${formatNumber(g._sum.quantity ?? 0, locale)}`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const statusSegments = LOT_STATUSES.filter((s) =>
    byStatus.some((g) => g.status === s)
  ).map((s) => ({
    label: dict.lotStatus[s],
    value: byStatus.find((g) => g.status === s)?._count ?? 0,
  }));

  // Weekly rather than monthly: a lot runs for one to two weeks, so months
  // collapse the whole trend into two or three points and the line says
  // nothing. Twelve weeks is enough to see a direction.
  const weekStartOf = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // back to Monday
    return x;
  };
  const weekly = new Map<string, number>();
  for (const a of awardRows) {
    const w = weekStartOf(a.selectedAt);
    const k = `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, "0")}-${String(
      w.getDate()
    ).padStart(2, "0")}`;
    weekly.set(k, (weekly.get(k) ?? 0) + a.amountCents);
  }
  const revenueTrend = [...weekly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([label, cents]) => ({
      label: label.slice(5).replace("-", "/"),
      value: cents / 100,
    }));

  return (
    <>
      <PageHeader
        title={dict.nav.dashboard}
        lead={
          user.company
            ? locale === "ja"
              ? user.company.name
              : user.company.nameEn
            : dict.role[user.role]
        }
      />

      {user.role === "BIDDER" && user.company?.status === "PROVISIONAL" && (
        <div className="mb-5 rounded-xl border border-warn/30 bg-warn-bg px-4 py-3">
          <p className="text-sm font-semibold text-warn">
            {dict.companyStatus.PROVISIONAL}
          </p>
          <p className="mt-0.5 text-xs text-warn">
            {dict.member.bidLimit}:{" "}
            {formatMoney(user.company.bidLimitCents ?? 0, "USD", locale)}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={dict.lotStatus.OPEN} value={formatNumber(openLots, locale)} unit="lots" />
        <Stat label={dict.lot.bidCount} value={formatNumber(bidCount, locale)} unit="bids" />
        <Stat
          label={user.role === "BIDDER" ? dict.contractStatus.AWARDED : dict.admin.winRate}
          value={
            user.role === "BIDDER"
              ? formatNumber(awardCount, locale)
              : formatPercent(winRate, locale)
          }
        />
        <Stat
          label={dict.admin.revenue}
          value={formatMoney(awardSum._sum.amountCents ?? 0, "USD", locale)}
        />
      </div>

      {user.role === "ADMIN" && (
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-sm font-bold text-ink">
              {dict.admin.revenue} · {dict.admin.period}
            </h2>
            <p className="mb-4 text-xs text-muted">USD · {dict.admin.weekly}</p>
            <TrendChart
              points={revenueTrend}
              ariaLabel={dict.admin.revenue}
              formatValue={(n) => `$${Math.round(n).toLocaleString()}`}
            />
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-bold text-ink">{dict.admin.byStatus}</h2>
            <p className="mb-4 text-xs text-muted">{dict.admin.listedCount}</p>
            <ProportionBar segments={statusSegments} />
          </Card>

          <Card className="p-6 lg:col-span-3">
            <h2 className="text-sm font-bold text-ink">{dict.admin.byCountry}</h2>
            <p className="mb-4 text-xs text-muted">
              {dict.admin.listedCount} · {dict.common.total}{dict.lot.quantity}
            </p>
            <BarList data={countryBars} />
          </Card>
        </div>
      )}

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        {/* closing soon */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-bold text-ink">まもなく締切</h2>
            <Link href="/lots" className="text-xs font-semibold text-brand hover:underline">
              {dict.nav.lots}
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {closingSoon.map((lot) => (
              <li key={lot.id}>
                <Link
                  href={`/lots/${lot.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] text-muted">{lot.lotNumber}</p>
                    <p className="truncate text-sm font-medium text-ink">
                      {locale === "ja" ? lot.title : lot.titleEn}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Countdown
                      endAt={lot.endAt.toISOString()}
                      initial={initialCd(lot.endAt, now)}
                      className="text-sm"
                    />
                    <p className="text-[11px] text-muted">
                      {lot._count.bids} {dict.lot.bidCount}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
            {closingSoon.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted">
                {dict.common.noData}
              </li>
            )}
          </ul>
        </Card>

        {/* role-specific panel */}
        {user.role === "ADMIN" ? (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-bold text-ink">{dict.member.reviewQueue}</h2>
              <Link
                href="/admin/members"
                className="text-xs font-semibold text-brand hover:underline"
              >
                {dict.nav.members}
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {pendingMembers.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/members/${c.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                      <p className="text-[11px] text-muted">
                        {locale === "ja" ? c.country.nameJa : c.country.nameEn} ·{" "}
                        {c._count.documents} docs
                      </p>
                    </div>
                    <Badge tone={c.status === "PENDING" ? "neutral" : "warn"}>
                      {dict.companyStatus[c.status as keyof typeof dict.companyStatus]}
                    </Badge>
                  </Link>
                </li>
              ))}
              {pendingMembers.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-muted">
                  {dict.member.noPending}
                </li>
              )}
            </ul>
          </Card>
        ) : user.role === "BIDDER" ? (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-bold text-ink">{dict.nav.myBids}</h2>
              <Link href="/bids" className="text-xs font-semibold text-brand hover:underline">
                {dict.common.detail}
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {myBids.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] text-muted">{b.lot.lotNumber}</p>
                    <p className="truncate text-sm font-medium text-ink">
                      {locale === "ja" ? b.lot.title : b.lot.titleEn}
                    </p>
                  </div>
                  <Badge tone="seal" dot>
                    {dict.bidStatus.SEALED}
                  </Badge>
                </li>
              ))}
              {myBids.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-muted">
                  {dict.common.noData}
                </li>
              )}
            </ul>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-bold text-ink">{dict.nav.listings}</h2>
              <Link href="/listings" className="text-xs font-semibold text-brand hover:underline">
                {dict.common.detail}
              </Link>
            </div>
            <div className="px-5 py-6">
              <p className="text-sm text-ink-2">
                {dict.nav.listings} · {formatNumber(openLots, locale)} {dict.lotStatus.OPEN}
              </p>
            </div>
          </Card>
        )}
      </div>

      {user.role === "ADMIN" && (
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-bold text-ink">{dict.admin.fraudTitle}</h2>
              <Link href="/admin/fraud" className="text-xs font-semibold text-brand hover:underline">
                {dict.common.detail}
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {signals.map((s) => (
                <li key={s.id} className="flex items-start gap-3 px-5 py-3">
                  <Badge
                    tone={s.severity === "HIGH" ? "danger" : s.severity === "MEDIUM" ? "warn" : "neutral"}
                  >
                    {s.severity}
                  </Badge>
                  <p className="min-w-0 flex-1 text-sm text-ink-2">{s.summary}</p>
                </li>
              ))}
              {signals.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-muted">
                  {dict.common.noData}
                </li>
              )}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-bold text-ink">{dict.nav.audit}</h2>
              <Link href="/admin/audit" className="text-xs font-semibold text-brand hover:underline">
                {dict.common.detail}
              </Link>
            </div>
            <ul className="divide-y divide-line">
              {recentAudit.map((a) => (
                <li key={a.id} className="px-5 py-2.5">
                  <p className="flex items-center gap-2">
                    <span className="badge bg-surface-3 font-mono text-[10px] text-ink-2">
                      {a.action}
                    </span>
                    <span className="truncate text-xs text-ink-2">{a.summary}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {formatDateTime(a.createdAt, user.timezone, locale)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
