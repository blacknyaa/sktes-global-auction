import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Badge, CONTRACT_STATUS_TONE, EmptyState } from "@/components/ui";
import { CONTRACT_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/datetime";
import { countryFlag, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "成約管理" };
export const dynamic = "force-dynamic";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const dict = await getDictionary();
  const locale = await getLocale();
  const { status } = await searchParams;

  const where: Prisma.ContractWhereInput = {};
  if (user.role === "SELLER" && user.companyId) {
    where.award = { lot: { sellerCompanyId: user.companyId } };
  } else if (user.role === "BIDDER" && user.companyId) {
    where.award = { winnerCompanyId: user.companyId };
  }
  if (status && CONTRACT_STATUSES.includes(status as never)) where.status = status;

  const scopeWhere: Prisma.ContractWhereInput = { ...where };
  delete scopeWhere.status;

  const [contracts, counts] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        award: {
          include: {
            lot: { include: { country: true, sellerCompany: true } },
            winnerCompany: { include: { country: true } },
          },
        },
        invoices: true,
        shipments: true,
      },
    }),
    prisma.contract.groupBy({
      by: ["status"],
      where: scopeWhere,
      _count: true,
    }),
  ]);

  return (
    <>
      <PageHeader
        title={dict.contract.title}
        lead={`${contracts.length} / ${counts.reduce((a, c) => a + c._count, 0)}`}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link
          href="/contracts"
          className={
            !status
              ? "badge bg-brand text-on-brand"
              : "badge bg-surface-3 text-ink-2 hover:bg-line"
          }
        >
          {dict.common.all}
        </Link>
        {CONTRACT_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/contracts?status=${s}`}
            className={
              status === s
                ? "badge bg-brand text-on-brand"
                : "badge bg-surface-3 text-ink-2 hover:bg-line"
            }
          >
            {dict.contractStatus[s]}
            <span className="tnum opacity-70">
              {counts.find((c) => c.status === s)?._count ?? 0}
            </span>
          </Link>
        ))}
      </div>

      {contracts.length === 0 ? (
        <EmptyState title={dict.contract.noContracts} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{dict.contract.contractNo}</th>
                <th>{dict.contract.lot}</th>
                <th>{user.role === "BIDDER" ? dict.contract.seller : dict.contract.buyer}</th>
                <th className="text-right">{dict.contract.amount}</th>
                <th>{dict.common.status}</th>
                <th>{dict.contract.invoice}</th>
                <th>{dict.common.createdAt}</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const invoice = c.invoices[0];
                const counterparty =
                  user.role === "BIDDER"
                    ? c.award.lot.sellerCompany
                    : c.award.winnerCompany;
                const countryCode =
                  user.role === "BIDDER"
                    ? c.award.lot.countryCode
                    : c.award.winnerCompany.countryCode;
                return (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap">
                      <Link
                        href={`/contracts/${c.id}`}
                        className="font-mono text-xs font-semibold text-brand hover:underline"
                      >
                        {c.contractNo}
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/lots/${c.award.lotId}`}
                        className="text-sm font-medium text-ink hover:text-brand"
                      >
                        {locale === "ja" ? c.award.lot.title : c.award.lot.titleEn}
                      </Link>
                      <p className="font-mono text-[11px] text-muted">
                        {c.award.lot.lotNumber}
                      </p>
                    </td>
                    <td className="text-sm text-ink-2">
                      {countryFlag(countryCode)}{" "}
                      {locale === "ja" ? counterparty.name : counterparty.nameEn}
                    </td>
                    <td className="tnum whitespace-nowrap text-right font-semibold text-ink">
                      {formatMoney(c.amountCents, c.currency, locale)}
                    </td>
                    <td>
                      <Badge tone={CONTRACT_STATUS_TONE[c.status] ?? "neutral"} dot>
                        {dict.contractStatus[c.status as keyof typeof dict.contractStatus]}
                      </Badge>
                    </td>
                    <td>
                      {invoice ? (
                        <Badge tone={invoice.status === "PAID" ? "success" : "warn"} dot>
                          {dict.invoiceStatus[invoice.status as keyof typeof dict.invoiceStatus] ?? invoice.status}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted">
                      {formatDate(c.createdAt, user.timezone, locale)}
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
