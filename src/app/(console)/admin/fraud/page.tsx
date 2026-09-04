import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Badge, Card, EmptyState } from "@/components/ui";
import {
  detectAbnormalBids,
  detectAccessAnomalies,
  detectMultiAccounts,
} from "@/lib/fraud";
import { formatDateTime } from "@/lib/datetime";
import { countryFlag, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "不正監視" };
export const dynamic = "force-dynamic";

export default async function FraudPage() {
  const user = await requireRole("ADMIN");
  const dict = await getDictionary();
  const locale = await getLocale();

  const [signals, multi, abnormal, access] = await Promise.all([
    prisma.fraudSignal.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { company: true },
      take: 50,
    }),
    detectMultiAccounts(),
    detectAbnormalBids(),
    detectAccessAnomalies(),
  ]);

  const severityTone = (s: string) =>
    s === "HIGH" ? "danger" : s === "MEDIUM" ? "warn" : "neutral";

  return (
    <>
      <PageHeader title={dict.admin.fraudTitle} lead={dict.admin.fraudLead} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {dict.admin.MULTI_ACCOUNT}
          </p>
          <p className="tnum mt-1 text-3xl font-bold text-ink">{multi.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {dict.admin.ABNORMAL_BID}
          </p>
          <p className="tnum mt-1 text-3xl font-bold text-ink">{abnormal.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {dict.admin.ACCESS_ANOMALY}
          </p>
          <p className="tnum mt-1 text-3xl font-bold text-ink">{access.length}</p>
        </Card>
      </div>

      <div className="space-y-5">
        {/* --- live: duplicate accounts --- */}
        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-base font-bold text-ink">
              {dict.admin.MULTI_ACCOUNT}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              同じ法人番号での重複登録と、異なる会員が同一IPから入札しているケースを検出します。
            </p>
          </div>
          <ul className="divide-y divide-line">
            {multi.map((f, i) => (
              <li key={`${f.reason}-${f.key}-${i}`} className="px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={f.reason === "SHARED_CORPORATE_NUMBER" ? "danger" : "warn"}>
                    {f.reason === "SHARED_CORPORATE_NUMBER" ? "法人番号一致" : "同一IP"}
                  </Badge>
                  <span className="font-mono text-xs text-ink-2">{f.key}</span>
                </div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {f.companies.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/admin/members/${c.id}`}
                        className="badge bg-surface-3 text-ink-2 hover:bg-line"
                      >
                        {countryFlag(c.countryCode)} {c.name}
                        <span className="opacity-60">{c.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {multi.length === 0 && (
              <li className="px-6 py-8 text-center text-sm text-muted">
                {dict.common.noData}
              </li>
            )}
          </ul>
        </Card>

        {/* --- live: abnormal bids --- */}
        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-base font-bold text-ink">{dict.admin.ABNORMAL_BID}</h2>
            <p className="mt-0.5 text-xs text-muted">
              同一ロット内の中央値と比べて突出した入札を抽出します。桁の打ち間違いは、落札を確定する前に気づきたいところです。
            </p>
          </div>
          {abnormal.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted">
              {dict.common.noData}
            </p>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>{dict.lot.lotNumber}</th>
                    <th>{dict.common.company}</th>
                    <th className="text-right">{dict.common.amount}</th>
                    <th className="text-right">中央値</th>
                    <th className="text-right">倍率</th>
                  </tr>
                </thead>
                <tbody>
                  {abnormal.slice(0, 20).map((a, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap">
                        <Link
                          href={`/lots/${a.lotId}`}
                          className="font-mono text-xs text-brand hover:underline"
                        >
                          {a.lotNumber}
                        </Link>
                      </td>
                      <td className="text-sm text-ink-2">{a.companyName}</td>
                      <td className="tnum text-right font-semibold text-ink">
                        {formatMoney(a.amountCents, "USD", locale)}
                      </td>
                      <td className="tnum text-right text-muted">
                        {formatMoney(a.medianCents, "USD", locale)}
                      </td>
                      <td className="tnum text-right">
                        <Badge tone={a.multiple >= 4 ? "danger" : "warn"}>
                          ×{a.multiple}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* --- live: access anomalies --- */}
        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-base font-bold text-ink">
              {dict.admin.ACCESS_ANOMALY}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              監査ログのログイン失敗を集計します。同一IPから複数アカウントへの失敗が続く場合は総当たりの可能性があります。
            </p>
          </div>
          {access.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted">
              {dict.common.noData}
            </p>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>{dict.admin.ip}</th>
                    <th className="text-right">失敗回数</th>
                    <th className="text-right">対象アカウント数</th>
                    <th>{dict.common.updatedAt}</th>
                  </tr>
                </thead>
                <tbody>
                  {access.slice(0, 20).map((a) => (
                    <tr key={a.ip}>
                      <td className="tnum font-mono text-xs text-ink">{a.ip}</td>
                      <td className="tnum text-right font-semibold text-ink">
                        {a.failedLogins}
                      </td>
                      <td className="tnum text-right text-ink-2">
                        {a.distinctActors}
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted">
                        {formatDateTime(a.lastAt, user.timezone, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* --- recorded signals --- */}
        <Card className="overflow-hidden">
          <div className="border-b border-line px-6 py-4">
            <h2 className="text-base font-bold text-ink">記録済みシグナル</h2>
          </div>
          {signals.length === 0 ? (
            <EmptyState title={dict.common.noData} />
          ) : (
            <ul className="divide-y divide-line">
              {signals.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start gap-3 px-6 py-4">
                  <Badge tone={severityTone(s.severity)}>{s.severity}</Badge>
                  <Badge tone="neutral">
                    {dict.admin[s.kind as keyof typeof dict.admin] ?? s.kind}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{s.summary}</p>
                    {s.detail && (
                      <pre className="mt-1 overflow-x-auto rounded bg-surface-2 p-2 text-[11px] text-muted">
                        {JSON.stringify(JSON.parse(s.detail), null, 2)}
                      </pre>
                    )}
                    <p className="mt-1 text-[11px] text-muted">
                      {formatDateTime(s.createdAt, user.timezone, locale)}
                    </p>
                  </div>
                  <Badge
                    tone={
                      s.status === "OPEN"
                        ? "danger"
                        : s.status === "REVIEWING"
                          ? "warn"
                          : s.status === "CONFIRMED"
                            ? "danger"
                            : "neutral"
                    }
                  >
                    {s.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
