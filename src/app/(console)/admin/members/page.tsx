import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Badge, COMPANY_STATUS_TONE } from "@/components/ui";
import { COMPANY_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/datetime";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "会員管理" };
export const dynamic = "force-dynamic";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const admin = await requireRole("ADMIN");
  const dict = await getDictionary();
  const locale = await getLocale();
  const { status, q } = await searchParams;

  const where: Prisma.CompanyWhereInput = { type: "BUYER" };
  if (status && COMPANY_STATUSES.includes(status as never)) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { nameEn: { contains: q } },
      { contactEmail: { contains: q } },
    ];
  }

  const [companies, counts] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: [{ status: "asc" }, { appliedAt: "asc" }],
      include: {
        country: true,
        _count: { select: { documents: true, bids: true, awards: true } },
      },
      take: 200,
    }),
    prisma.company.groupBy({
      by: ["status"],
      where: { type: "BUYER" },
      _count: true,
    }),
  ]);

  const countFor = (s: string) =>
    counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader
        title={dict.nav.members}
        lead={`${companies.length} / ${counts.reduce((a, c) => a + c._count, 0)}`}
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <label className="label" htmlFor="q">
            {dict.common.search}
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            className="input"
            placeholder="会社名 / メールアドレス"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          {dict.common.search}
        </button>
        {(q || status) && (
          <Link href="/admin/members" className="btn btn-ghost">
            {dict.common.reset}
          </Link>
        )}
      </form>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link
          href="/admin/members"
          className={
            !status
              ? "badge bg-brand text-on-brand"
              : "badge bg-surface-3 text-ink-2 hover:bg-line"
          }
        >
          {dict.common.all}
        </Link>
        {COMPANY_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/members?status=${s}`}
            className={
              status === s
                ? "badge bg-brand text-on-brand"
                : "badge bg-surface-3 text-ink-2 hover:bg-line"
            }
          >
            {dict.companyStatus[s]}
            <span className="tnum opacity-70">{countFor(s)}</span>
          </Link>
        ))}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{dict.common.company}</th>
              <th>{dict.common.country}</th>
              <th>{dict.common.status}</th>
              <th className="text-right">{dict.member.bidLimit}</th>
              <th className="text-right">{dict.member.documents}</th>
              <th className="text-right">{dict.lot.bidCount}</th>
              <th>{dict.member.appliedAt}</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link
                    href={`/admin/members/${c.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {locale === "ja" ? c.name : c.nameEn}
                  </Link>
                  <p className="text-xs text-muted">{c.contactEmail}</p>
                </td>
                <td className="whitespace-nowrap text-ink-2">
                  {locale === "ja" ? c.country.nameJa : c.country.nameEn}
                </td>
                <td>
                  <Badge tone={COMPANY_STATUS_TONE[c.status] ?? "neutral"} dot>
                    {dict.companyStatus[c.status as keyof typeof dict.companyStatus]}
                  </Badge>
                </td>
                <td className="tnum text-right text-ink-2">
                  {c.bidLimitCents != null ? formatMoney(c.bidLimitCents, "USD", locale) : "—"}
                </td>
                <td className="tnum text-right text-ink-2">{c._count.documents}</td>
                <td className="tnum text-right text-ink-2">{c._count.bids}</td>
                <td className="whitespace-nowrap text-xs text-muted">
                  {formatDate(c.appliedAt, admin.timezone, locale)}
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted">
                  {dict.common.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
