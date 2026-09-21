import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getDictionary } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Card } from "@/components/ui";
import { DangerSubmitButton } from "@/components/SubmitButton";
import { resetDemoAction } from "./actions";

export const metadata: Metadata = { title: "デモ設定" };
export const dynamic = "force-dynamic";

export default async function DemoAdminPage() {
  await requireRole("ADMIN");
  const dict = await getDictionary();

  const [companies, users, lots, items, bids, awards, audits] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    prisma.lot.count(),
    prisma.lotItem.count(),
    prisma.bid.count(),
    prisma.award.count(),
    prisma.auditLog.count(),
  ]);

  const counts = [
    { label: "会社", value: companies },
    { label: "ユーザー", value: users },
    { label: "出品", value: lots },
    { label: "明細", value: items },
    { label: "入札", value: bids },
    { label: "落札", value: awards },
    { label: "監査ログ", value: audits },
  ];

  return (
    <>
      <PageHeader
        title="デモ設定"
        lead="デモ環境の状態確認と初期化"
        actions={
          <Link href="/guide" className="btn btn-ghost">
            {dict.nav.guide}
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-base font-bold text-ink">現在のデータ量</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {counts.map((c) => (
              <div key={c.label}>
                <dt className="text-xs text-muted">{c.label}</dt>
                <dd className="tnum text-xl font-bold text-ink">
                  {c.value.toLocaleString("en-US")}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-bold text-ink">デモデータを初期状態に戻す</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            触っているうちに状態がわからなくなったときは、ここから初期状態に戻せます。
            会員も出品も入札もすべて作り直すため、実行後はログイン画面に戻ります。
            生成される内容は毎回同じです。
          </p>
          <p className="mt-2 rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn">
            この機能はデモ環境専用です。本番構成では、この画面自体が存在しません。
          </p>
          <form action={resetDemoAction} className="mt-4">
            <DangerSubmitButton
              confirm="デモデータをすべて作り直します。現在のログインも解除されます。よろしいですか。"
              pendingLabel="初期化しています"
            >
              初期状態に戻す
            </DangerSubmitButton>
          </form>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="text-base font-bold text-ink">デモアカウント</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { role: dict.home.demoAdmin, loginId: "admin" },
              { role: dict.home.demoSeller, loginId: "seller" },
              { role: dict.home.demoBidder, loginId: "buyer" },
            ].map((a) => (
              <div key={a.loginId} className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-muted">{a.role}</p>
                <p className="select-all font-mono text-sm font-semibold text-ink">
                  {a.loginId}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            パスワードは共通で <span className="select-all font-mono font-semibold">Demo!2026</span> です。
            バイヤー各社のログインIDは buyer1 〜 buyer55、
            出品拠点は seller-jp のように国コードつきで並んでいます。
          </p>
        </Card>
      </div>
    </>
  );
}
