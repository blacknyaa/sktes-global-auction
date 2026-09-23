import type { Metadata } from "next";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { otpauthUrl } from "@/lib/totp";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Badge, Card } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDateTime } from "@/lib/datetime";
import { beginMfaAction, revokeOtherSessionsAction } from "./actions";
import { ChangePasswordForm, DisableMfaForm, EnableMfaForm } from "./forms";

export const metadata: Metadata = { title: "セキュリティ設定" };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await requireUser();
  const dict = await getDictionary();
  const locale = await getLocale();

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  const sessions = await prisma.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const secret = row?.mfaSecret ?? null;
  const qrDataUrl =
    secret && !row?.mfaEnabled
      ? await QRCode.toDataURL(otpauthUrl(secret, user.email), {
          margin: 1,
          width: 208,
          color: { dark: "#0d1f45", light: "#ffffff" },
        })
      : null;

  return (
    <>
      <PageHeader title={dict.auth.securityTitle} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---- MFA ---- */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink">
                {dict.auth.mfaSetupTitle}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-ink-2">
                {dict.auth.mfaSetupLead}
              </p>
            </div>
            <Badge tone={row?.mfaEnabled ? "success" : "neutral"} dot>
              {row?.mfaEnabled ? dict.auth.mfaOn : dict.auth.mfaOff}
            </Badge>
          </div>

          {row?.mfaEnabled ? (
            <DisableMfaForm
              labels={{
                current: dict.auth.currentPassword,
                code: dict.auth.code,
                disable: dict.auth.mfaDisable,
                confirm: dict.auth.confirmDisableMfa,
                lead: dict.auth.mfaDisableLead,
                wrongPassword: dict.auth.invalidCredentials,
                invalid: dict.auth.mfaInvalid,
              }}
            />
          ) : secret ? (
            <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start">
              {qrDataUrl && (
                <div className="shrink-0 rounded-xl border border-line bg-surface p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="MFA QR code"
                    width={208}
                    height={208}
                    className="block"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted">
                    {dict.auth.mfaManual}
                  </p>
                  <p
                    data-testid="mfa-secret"
                    className="mt-1 select-all break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm font-semibold text-ink"
                  >
                    {secret.replace(/(.{4})/g, "$1 ").trim()}
                  </p>
                </div>
                <EnableMfaForm
                  labels={{
                    code: dict.auth.code,
                    enable: dict.auth.mfaEnable,
                    invalid: dict.auth.mfaInvalid,
                    enrolled: dict.auth.mfaEnrolled,
                  }}
                />
                <p className="text-xs leading-relaxed text-muted">
                  このQRコードは実際に動作します。Google Authenticator
                  などで読み取り、表示された6桁を入力してください。時刻ずれは前後30秒まで許容します。
                </p>
              </div>
            </div>
          ) : (
            <form action={beginMfaAction} className="mt-5">
              <SubmitButton
                data-testid="begin-mfa"
                pendingLabel={dict.common.processing}
              >
                {dict.auth.mfaEnable}
              </SubmitButton>
            </form>
          )}
        </Card>

        {/* ---- password ---- */}
        <Card className="p-6">
          <h2 className="text-base font-bold text-ink">
            {dict.auth.changePassword}
          </h2>
          <div className="mt-4">
            <ChangePasswordForm
              labels={{
                current: dict.auth.currentPassword,
                next: dict.auth.newPassword,
                confirm: dict.auth.confirmPassword,
                submit: dict.auth.changePassword,
                mismatch: dict.auth.passwordMismatch,
                policy: dict.auth.passwordPolicy,
                wrongCurrent: dict.auth.invalidCredentials,
                changed: dict.auth.resetDone,
              }}
            />
          </div>
        </Card>

        {/* ---- sessions ---- */}
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink">
              {dict.auth.sessionsTitle}
            </h2>
            <form action={revokeOtherSessionsAction}>
              <SubmitButton className="btn-ghost px-3 py-1.5 text-xs" confirm={dict.auth.confirmRevokeSessions} pendingLabel={dict.common.processing}>
                {dict.auth.revokeOthers}
              </SubmitButton>
            </form>
          </div>

          <ul className="mt-4 space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-line bg-surface-2 px-3 py-2.5"
              >
                <p className="tnum text-xs font-semibold text-ink">
                  {s.ip ?? "-"}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted">
                  {s.userAgent ?? "-"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {formatDateTime(s.createdAt, user.timezone, locale)}
                </p>
              </li>
            ))}
            {sessions.length === 0 && (
              <li className="text-sm text-muted">{dict.common.noData}</li>
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}
