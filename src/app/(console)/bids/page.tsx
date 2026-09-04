import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Badge, BID_STATUS_TONE, EmptyState, Stat } from "@/components/ui";
import { sweepLotLifecycle } from "@/lib/lotQuery";
import { formatDateTime } from "@/lib/datetime";
import { cipherFingerprint } from "@/lib/seal";
import { countryFlag, formatMoney, formatPercent } from "@/lib/format";

export const metadata: Metadata = { title: "入札履歴" };
export const dynamic = "force-dynamic";

export default async function MyBidsPage() {
  const user = await requireRole("BIDDER");
  const dict = await getDictionary();
  const locale = await getLocale();
  await sweepLotLifecycle();

  if (!user.companyId) return <EmptyState title={dict.common.noData} />;

  const [bids, wins, totalWon] = await Promise.all([
    prisma.bid.findMany({
      where: { bidderCompanyId: user.companyId },
      orderBy: { submittedAt: "desc" },
      take: 200,
      include: {
        lot: { include: { country: true, award: true } },
      },
    }),
    prisma.award.count({ where: { winnerCompanyId: user.companyId } }),
    prisma.award.aggregate({
      where: { winnerCompanyId: user.companyId },
      _sum: { amountCents: true },
    }),
  ]);

  const decided = bids.filter((b) =>
    ["CLOSED", "AWARDED", "FAILED"].includes(b.lot.status)
  ).length;
  const winRate = decided > 0 ? wins / decided : 0;

  return (
    <>
      <PageHeader title={dict.nav.myBids} lead={user.company?.name} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={dict.lot.bidCount} value={bids.length} />
        <Stat
          label={dict.bidStatus.SEALED}
          value={bids.filter((b) => b.status === "SEALED").length}
        />
        <Stat label={dict.bid.awarded} value={wins} hint={formatPercent(winRate, locale)} />
        <Stat
          label={dict.contract.amount}
          value={formatMoney(totalWon._sum.amountCents ?? 0, "USD", locale)}
        />
      </div>

      {bids.length === 0 ? (
        <EmptyState title={dict.common.noData} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{dict.lot.lotNumber}</th>
                <th>{dict.lot.title}</th>
                <th>{dict.common.status}</th>
                <th className="text-right">{dict.common.amount}</th>
                <th>{dict.bid.commitment}</th>
                <th>{dict.common.createdAt}</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((b) => {
                const won = b.lot.award?.bidId === b.id;
                return (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">
                      {b.lot.lotNumber}
                    </td>
                    <td>
                      <Link
                        href={`/lots/${b.lotId}`}
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        {countryFlag(b.lot.countryCode)}{" "}
                        {locale === "ja" ? b.lot.title : b.lot.titleEn}
                      </Link>
                      <p className="text-[11px] text-muted">
                        {dict.lotStatus[b.lot.status as keyof typeof dict.lotStatus]}
                        {b.sequence > 1 && ` · #${b.sequence}`}
                      </p>
                    </td>
                    <td>
                      <Badge tone={BID_STATUS_TONE[b.status] ?? "neutral"} dot>
                        {dict.bidStatus[b.status as keyof typeof dict.bidStatus]}
                      </Badge>
                      {won && (
                        <Badge tone="success" className="ml-1.5">
                          {dict.bid.awarded}
                        </Badge>
                      )}
                    </td>
                    <td className="tnum whitespace-nowrap text-right font-semibold text-ink">
                      {b.amountCents !== null ? (
                        formatMoney(b.amountCents, "USD", locale)
                      ) : (
                        <span className="text-seal">{dict.lot.sealed}</span>
                      )}
                    </td>
                    <td className="font-mono text-[11px] text-muted">
                      {cipherFingerprint(b.ciphertext)}
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted">
                      {formatDateTime(b.submittedAt, user.timezone, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
