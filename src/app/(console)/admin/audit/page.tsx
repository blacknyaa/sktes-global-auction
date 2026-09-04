import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Card, EmptyState } from "@/components/ui";
import { AUDIT_ACTIONS, AUDIT_RETENTION_YEARS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "監査ログ" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; q?: string; page?: string }>;
}) {
  const user = await requireRole("ADMIN");
  const dict = await getDictionary();
  const locale = await getLocale();
  const { action, q, page } = await searchParams;
  const pageNo = Math.max(1, Number(page ?? 1) || 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (action && AUDIT_ACTIONS.includes(action as never)) where.action = action;
  if (q) {
    where.OR = [
      { summary: { contains: q } },
      { actorLabel: { contains: q } },
      { ip: { contains: q } },
    ];
  }

  const [rows, total, byAction] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNo - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["action"], _count: true }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const sp = new URLSearchParams();
    if (action) sp.set("action", action);
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <PageHeader
        title={dict.admin.auditTitle}
        lead={`${formatNumber(total, locale)} · ${dict.admin.retentionUntil} ${AUDIT_RETENTION_YEARS}y`}
      />

      <Card className="mb-4 p-4">
        <form className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="q">
              {dict.common.search}
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q ?? ""}
              className="input"
              placeholder="内容 / 実行者 / IP"
            />
          </div>
          <div>
            <label className="label" htmlFor="action">
              {dict.admin.action}
            </label>
            <select id="action" name="action" defaultValue={action ?? ""} className="input w-52">
              <option value="">{dict.common.all}</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a} ({byAction.find((g) => g.action === a)?._count ?? 0})
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">
            {dict.common.search}
          </button>
          <Link href="/admin/audit" className="btn btn-ghost">
            {dict.common.reset}
          </Link>
        </form>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {dict.admin.auditLead}
        </p>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title={dict.common.noData} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{dict.common.createdAt}</th>
                  <th>{dict.admin.action}</th>
                  <th>{dict.admin.actor}</th>
                  <th>{dict.admin.summary}</th>
                  <th>{dict.admin.ip}</th>
                  <th>{dict.admin.retentionUntil}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs text-muted">
                      {formatDateTime(r.createdAt, user.timezone, locale, {
                        second: "2-digit",
                      })}
                    </td>
                    <td>
                      <span className="badge bg-surface-3 font-mono text-[10px] text-ink-2">
                        {r.action}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-sm text-ink-2">
                      {r.actorLabel}
                    </td>
                    <td className="text-sm text-ink">
                      {r.summary}
                      {r.detail && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] text-muted hover:text-brand">
                            {dict.admin.detail}
                          </summary>
                          <pre className="mt-1 overflow-x-auto rounded bg-surface-2 p-2 text-[11px] text-ink-2">
                            {JSON.stringify(JSON.parse(r.detail), null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td className="tnum whitespace-nowrap text-xs text-muted">
                      {r.ip ?? "—"}
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted">
                      {formatDate(r.retentionUntil, user.timezone, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted">
                {pageNo} / {pages}
              </p>
              <div className="flex gap-2">
                {pageNo > 1 && (
                  <Link href={`/admin/audit${qs(pageNo - 1)}`} className="btn btn-ghost">
                    {dict.common.back}
                  </Link>
                )}
                {pageNo < pages && (
                  <Link href={`/admin/audit${qs(pageNo + 1)}`} className="btn btn-ghost">
                    {dict.common.next}
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
