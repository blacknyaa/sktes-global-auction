import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Badge, Card, EmptyState, Stat } from "@/components/ui";
import { BarList, TrendChart } from "@/components/charts";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { countryFlag, formatMoney, formatNumber, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "レポート" };
export const dynamic = "force-dynamic";

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportsPage() {
  const user = await requireUser();
  const dict = await getDictionary();
  const locale = await getLocale();

  const awardWhere: Prisma.AwardWhereInput =
    user.role === "SELLER" && user.companyId
      ? { lot: { sellerCompanyId: user.companyId } }
      : user.role === "BIDDER" && user.companyId
        ? { winnerCompanyId: user.companyId }
        : {};

  const awards = await prisma.award.findMany({
    where: awardWhere,
    orderBy: { selectedAt: "desc" },
    take: 300,
    include: {
      lot: { include: { country: true, sellerCompany: true } },
      winnerCompany: { include: { country: true } },
      contract: { include: { invoices: true, shipments: true } },
    },
  });

  const totalCents = awards.reduce((s, a) => s + a.amountCents, 0);
  const avgCents = awards.length > 0 ? Math.round(totalCents / awards.length) : 0;

  // monthly trend
  const byMonth = new Map<string, number>();
  for (const a of awards) {
    const k = monthKey(a.selectedAt);
    byMonth.set(k, (byMonth.get(k) ?? 0) + a.amountCents);
  }
  const trend = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([label, value]) => ({ label: label.slice(2), value: value / 100 }));

  const isBidder = user.role === "BIDDER";

  // seller view: who is winning, and for how much
  const byBuyer = new Map<string, { name: string; count: number; cents: number }>();
  for (const a of awards) {
    const cur = byBuyer.get(a.winnerCompanyId) ?? {
      name: a.winnerCompany.name,
      count: 0,
      cents: 0,
    };
    cur.count++;
    cur.cents += a.amountCents;
    byBuyer.set(a.winnerCompanyId, cur);
  }
  const topBuyers = [...byBuyer.values()]
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 8)
    .map((b) => ({
      label: b.name,
      value: b.cents / 100,
      hint: `${b.count}`,
    }));

  // bidder view: history counters
  const [bidCount, paidCount, shippedCount, receivedCount] = isBidder
    ? await Promise.all([
        prisma.bid.count({ where: { bidderCompanyId: user.companyId! } }),
        prisma.invoice.count({
          where: {
            status: "PAID",
            contract: { award: { winnerCompanyId: user.companyId! } },
          },
        }),
        prisma.shipment.count({
          where: {
            status: { in: ["SHIPPED", "RECEIVED"] },
            contract: { award: { winnerCompanyId: user.companyId! } },
          },
        }),
        prisma.shipment.count({
          where: {
            status: "RECEIVED",
            contract: { award: { winnerCompanyId: user.companyId! } },
          },
        }),
      ])
    : [0, 0, 0, 0];

  const winRate = isBidder && bidCount > 0 ? awards.length / bidCount : 0;

  return (
    <>
      <PageHeader
        title={dict.admin.reportsTitle}
        lead={isBidder ? dict.admin.bidderReport : dict.admin.sellerReport}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={isBidder ? dict.admin.winHistory : dict.contractStatus.AWARDED}
          value={formatNumber(awards.length, locale)}
        />
        <Stat
          label={dict.admin.revenue}
          value={formatMoney(totalCents, "USD", locale)}
        />
        <Stat
          label={dict.admin.averageAmount}
          value={formatMoney(avgCents, "USD", locale)}
        />
        {isBidder ? (
          <Stat
            label={dict.admin.winRate}
            value={formatPercent(winRate, locale)}
            hint={`${bidCount} ${dict.lot.bidCount}`}
          />
        ) : (
          <Stat
            label={dict.common.company}
            value={formatNumber(byBuyer.size, locale)}
            hint={dict.admin.winnerName}
          />
        )}
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-sm font-bold text-ink">
            {dict.admin.revenue} · {dict.admin.period}
          </h2>
          <p className="mb-4 text-xs text-muted">USD</p>
          <TrendChart
            points={trend}
            ariaLabel={`${dict.admin.revenue} by month`}
            formatValue={(n) => `$${Math.round(n).toLocaleString("en-US")}`}
          />
        </Card>

        {isBidder ? (
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-bold text-ink">
              {dict.admin.bidderReport}
            </h2>
            <BarList
              data={[
                { label: dict.admin.bidHistory, value: bidCount },
                { label: dict.admin.winHistory, value: awards.length },
                { label: dict.admin.paymentHistory, value: paidCount },
                { label: dict.admin.shipmentHistory, value: shippedCount },
                { label: dict.admin.receiptHistory, value: receivedCount },
              ]}
            />
          </Card>
        ) : (
          <Card className="p-6">
            <h2 className="text-sm font-bold text-ink">{dict.admin.winnerName}</h2>
            <p className="mb-4 text-xs text-muted">USD · {dict.admin.winningAmount}</p>
            <BarList
              data={topBuyers}
              formatValue={(n) => `$${Math.round(n).toLocaleString("en-US")}`}
            />
          </Card>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-base font-bold text-ink">
            {isBidder ? dict.admin.winHistory : dict.admin.sellerReport}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{dict.admin.nextSteps}</p>
        </div>

        {awards.length === 0 ? (
          <EmptyState title={dict.common.noData} />
        ) : (
          <div className="table-wrap border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>{dict.lot.lotNumber}</th>
                  <th>{isBidder ? dict.contract.seller : dict.admin.winnerName}</th>
                  <th className="text-right">{dict.admin.winningAmount}</th>
                  <th>{dict.bid.rank}</th>
                  <th>{dict.common.status}</th>
                  <th>{dict.common.createdAt}</th>
                </tr>
              </thead>
              <tbody>
                {awards.slice(0, 100).map((a) => {
                  const invoice = a.contract?.invoices[0];
                  const counterparty = isBidder
                    ? a.lot.sellerCompany
                    : a.winnerCompany;
                  const cc = isBidder ? a.lot.countryCode : a.winnerCompany.countryCode;
                  return (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap">
                        <Link
                          href={`/lots/${a.lotId}`}
                          className="font-mono text-xs text-brand hover:underline"
                        >
                          {a.lot.lotNumber}
                        </Link>
                      </td>
                      <td className="text-sm text-ink-2">
                        {countryFlag(cc)}{" "}
                        {locale === "ja" ? counterparty.name : counterparty.nameEn}
                      </td>
                      <td className="tnum whitespace-nowrap text-right font-semibold text-ink">
                        {formatMoney(a.amountCents, a.currency, locale)}
                      </td>
                      <td>
                        <Badge tone={a.isHighestBid ? "success" : "warn"}>
                          {a.rankAmongBids}
                          {a.isHighestBid ? ` · ${dict.bid.awardHighest}` : ""}
                        </Badge>
                      </td>
                      <td>
                        {a.contract && (
                          <Link
                            href={`/contracts/${a.contract.id}`}
                            className="text-xs text-brand hover:underline"
                          >
                            {
                              dict.contractStatus[
                                a.contract.status as keyof typeof dict.contractStatus
                              ]
                            }
                          </Link>
                        )}
                        {invoice?.status === "PAID" && (
                          <Badge tone="success" className="ml-1.5">
                            {dict.contract.paidAt}
                          </Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted">
                        {formatDate(a.selectedAt, user.timezone, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!isBidder && awards.length > 0 && (
        <Card className="mt-5 p-6">
          <h2 className="text-sm font-bold text-ink">{dict.admin.nextSteps}</h2>
          <ol className="mt-3 space-y-2 text-sm text-ink-2">
            <li>
              1. 落札者へ落札通知と契約内容をメールで送付（送信済みの控えは
              <Link href="/admin/notifications" className="text-brand hover:underline">
                通知アウトボックス
              </Link>
              に残ります）
            </li>
            <li>2. 請求書を発行し、支払期限までの入金を確認</li>
            <li>3. 入金確認後に発送・集荷を依頼し、追跡番号を登録</li>
            <li>4. バイヤーの受領確認をもって取引完了</li>
          </ol>
          <p className="mt-3 text-xs text-muted">
            最終更新: {formatDateTime(new Date(), user.timezone, locale)}
          </p>
        </Card>
      )}
    </>
  );
}
