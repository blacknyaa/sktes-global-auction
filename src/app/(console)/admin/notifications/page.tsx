import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Badge, Card, EmptyState } from "@/components/ui";
import { NOTIFICATION_CHANNELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "通知アウトボックス" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const user = await requireRole("ADMIN");
  const dict = await getDictionary();
  const locale = await getLocale();
  const { template } = await searchParams;

  const where = template ? { templateKey: template } : {};

  const [rows, total, byTemplate] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 120,
      include: { user: { include: { company: true } } },
    }),
    prisma.notification.count(),
    prisma.notification.groupBy({ by: ["templateKey"], _count: true }),
  ]);

  return (
    <>
      <PageHeader
        title={dict.admin.notificationsTitle}
        lead={`${formatNumber(total, locale)}`}
      />

      <Card className="mb-4 p-4">
        <p className="text-xs leading-relaxed text-muted">
          {dict.admin.notificationsLead}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <a
            href="/admin/notifications"
            className={
              !template
                ? "badge bg-brand text-on-brand"
                : "badge bg-surface-3 text-ink-2 hover:bg-line"
            }
          >
            {dict.common.all}
          </a>
          {byTemplate
            .sort((a, b) => b._count - a._count)
            .map((t) => (
              <a
                key={t.templateKey}
                href={`/admin/notifications?template=${t.templateKey}`}
                className={
                  template === t.templateKey
                    ? "badge bg-brand text-on-brand"
                    : "badge bg-surface-3 text-ink-2 hover:bg-line"
                }
              >
                {t.templateKey}
                <span className="tnum opacity-70">{t._count}</span>
              </a>
            ))}
        </div>

        {/* future channels, shown as designed-for rather than promised */}
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {dict.admin.channel}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {NOTIFICATION_CHANNELS.map((c) => (
              <span
                key={c}
                className={
                  c === "EMAIL"
                    ? "badge bg-success-bg text-success"
                    : "badge bg-surface-3 text-muted"
                }
              >
                {c}
                {c !== "EMAIL" && " (adapter pending)"}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            送信処理は1か所にまとめてあるので、SMS・Teams・LINE・WhatsApp・WeChat
            を足すときはアダプタを1つ書くだけで済みます。
          </p>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title={dict.common.noData} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{dict.admin.sentAt}</th>
                <th>{dict.admin.channel}</th>
                <th>{dict.admin.template}</th>
                <th>{dict.admin.recipient}</th>
                <th>{dict.admin.subject}</th>
                <th>{dict.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id}>
                  <td className="whitespace-nowrap text-xs text-muted">
                    {formatDateTime(n.createdAt, user.timezone, locale)}
                  </td>
                  <td>
                    <Badge tone="neutral">{n.channel}</Badge>
                  </td>
                  <td className="whitespace-nowrap font-mono text-[11px] text-ink-2">
                    {n.templateKey}
                  </td>
                  <td className="text-xs text-ink-2">
                    {n.toAddress}
                    {n.user?.company && (
                      <p className="text-[11px] text-muted">{n.user.company.name}</p>
                    )}
                  </td>
                  <td className="text-sm text-ink">
                    {n.subject}
                    <p className="mt-0.5 max-w-md truncate text-[11px] text-muted">
                      {n.body}
                    </p>
                  </td>
                  <td>
                    <Badge tone={n.status === "SENT" ? "success" : "warn"} dot>
                      {dict.notifyStatus[n.status as keyof typeof dict.notifyStatus] ?? n.status}
                    </Badge>
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
