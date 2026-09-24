import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Badge, EmptyState, LOT_STATUS_TONE } from "@/components/ui";
import { PromptSubmitButton, SubmitButton } from "@/components/SubmitButton";
import { LOT_STATUSES } from "@/lib/constants";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney, formatNumber } from "@/lib/format";
import { effectiveEndAt } from "@/lib/seal";
import { cancelLotAction, publishLotAction } from "./actions";

export const metadata: Metadata = { title: "出品管理" };
export const dynamic = "force-dynamic";

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireRole("SELLER", "ADMIN");
  const dict = await getDictionary();
  const locale = await getLocale();
  const { status } = await searchParams;

  const where: Prisma.LotWhereInput = {};
  if (user.role === "SELLER" && user.companyId) {
    where.sellerCompanyId = user.companyId;
  }
  if (status && LOT_STATUSES.includes(status as never)) where.status = status;

  const [lots, counts] = await Promise.all([
    prisma.lot.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        country: true,
        _count: { select: { bids: true, items: true } },
        award: true,
      },
    }),
    prisma.lot.groupBy({
      by: ["status"],
      where: user.role === "SELLER" && user.companyId
        ? { sellerCompanyId: user.companyId }
        : {},
      _count: true,
    }),
  ]);
  const now = new Date();

  return (
    <>
      <PageHeader
        title={dict.listing.title}
        lead={`${lots.length} / ${counts.reduce((a, c) => a + c._count, 0)}`}
        actions={
          <Link href="/listings/new" className="btn btn-primary">
            {dict.listing.newLot}
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link
          href="/listings"
          className={
            !status ? "badge bg-brand text-on-brand" : "badge bg-surface-3 text-ink-2 hover:bg-line"
          }
        >
          {dict.common.all}
        </Link>
        {LOT_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/listings?status=${s}`}
            className={
              status === s
                ? "badge bg-brand text-on-brand"
                : "badge bg-surface-3 text-ink-2 hover:bg-line"
            }
          >
            {dict.lotStatus[s]}
            <span className="tnum opacity-70">
              {counts.find((c) => c.status === s)?._count ?? 0}
            </span>
          </Link>
        ))}
      </div>

      {lots.length === 0 ? (
        <EmptyState
          title={dict.common.noData}
          action={
            <Link href="/listings/new" className="btn btn-primary mt-2">
              {dict.listing.newLot}
            </Link>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{dict.lot.lotNumber}</th>
                <th>{dict.lot.title}</th>
                <th>{dict.common.status}</th>
                <th className="text-right">{dict.lot.quantity}</th>
                <th className="text-right">{dict.lot.bidCount}</th>
                <th>{dict.lot.endAt}</th>
                <th className="text-right">{dict.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id}>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">
                    {lot.lotNumber}
                  </td>
                  <td>
                    <Link
                      href={`/lots/${lot.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {locale === "ja" ? lot.title : lot.titleEn}
                    </Link>
                    <p className="text-xs text-muted">
                      {locale === "ja" ? lot.country.nameJa : lot.country.nameEn} ·{" "}
                      {lot._count.items} lines ·{" "}
                      {formatMoney(lot.minimumBidCents, lot.currency, locale)}
                    </p>
                  </td>
                  <td>
                    <Badge tone={LOT_STATUS_TONE[lot.status] ?? "neutral"} dot>
                      {dict.lotStatus[lot.status as keyof typeof dict.lotStatus]}
                    </Badge>
                  </td>
                  <td className="tnum text-right text-ink-2">
                    {formatNumber(lot.quantity, locale)}
                  </td>
                  <td className="tnum text-right text-ink-2">{lot._count.bids}</td>
                  <td className="whitespace-nowrap text-xs text-muted">
                    {formatDateTime(lot.endAt, user.timezone, locale)}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      {["DRAFT", "SCHEDULED", "CANCELLED"].includes(lot.status) &&
                        !lot.openedAt && (
                        <form action={publishLotAction}>
                          <input type="hidden" name="lotId" value={lot.id} />
                          <SubmitButton
                            className="btn-subtle whitespace-nowrap px-2.5 py-1 text-xs"
                            confirm={dict.listing.confirmPublish}
                            pendingLabel={dict.common.processing}
                          >
                            {lot.status === "CANCELLED"
                              ? dict.listing.republish
                              : dict.listing.publish}
                          </SubmitButton>
                        </form>
                      )}
                      {!["AWARDED", "CANCELLED", "CLOSED", "FAILED"].includes(lot.status) &&
                        !lot.openedAt &&
                        !(lot.status === "OPEN" && effectiveEndAt(lot) <= now) && (
                        <form action={cancelLotAction}>
                          <input type="hidden" name="lotId" value={lot.id} />
                          <input type="hidden" name="cancelReason" defaultValue="" />
                          <PromptSubmitButton
                            className="btn-danger whitespace-nowrap px-2.5 py-1 text-xs"
                            promptMessage={dict.listing.cancelReason}
                            fieldName="cancelReason"
                            pendingLabel={dict.common.processing}
                          >
                            {dict.common.cancel}
                          </PromptSubmitButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
