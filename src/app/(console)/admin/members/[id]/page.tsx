import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Badge, COMPANY_STATUS_TONE, Card } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/format";
import { humanSize } from "@/lib/storage";
import { reviewDocumentAction, setMemberStatusAction } from "../actions";

export const metadata: Metadata = { title: "会員詳細" };
export const dynamic = "force-dynamic";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const dict = await getDictionary();
  const locale = await getLocale();

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      country: true,
      documents: { orderBy: { uploadedAt: "asc" } },
      users: true,
      _count: { select: { bids: true, awards: true } },
    },
  });
  if (!company) notFound();

  // The company's own trail plus every document review done on it - reviewing
  // a document is logged against the document, so filtering on Company alone
  // would hide exactly the decisions an auditor came here to read.
  const documentIds = company.documents.map((d) => d.id);
  const trail = await prisma.auditLog.findMany({
    where: {
      OR: [
        { targetType: "Company", targetId: id },
        { targetType: "CompanyDocument", targetId: { in: documentIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const exportDestinations: string[] = JSON.parse(
    company.exportDestinations || "[]"
  );
  const destCountries = exportDestinations.length
    ? await prisma.country.findMany({ where: { code: { in: exportDestinations } } })
    : [];

  const isJapan = company.countryCode === "JP";

  const facts: { label: string; value: string }[] = [
    { label: dict.member.companyNameEn, value: company.nameEn },
    {
      label: dict.member.country,
      value: `${locale === "ja" ? company.country.nameJa : company.country.nameEn} (${company.country.code})`,
    },
    { label: dict.member.contactName, value: company.contactName },
    { label: dict.member.contactEmail, value: company.contactEmail },
    { label: dict.member.contactPhone, value: company.contactPhone },
    { label: dict.member.corporateNumber, value: company.corporateNumber || "—" },
    { label: dict.member.hqAddress, value: company.hqAddress },
    { label: dict.member.branchAddress, value: company.branchAddress || "—" },
    {
      label: dict.member.hasImportLicense,
      value: company.hasImportLicense ? dict.member.licenseYes : dict.member.licenseNo,
    },
    {
      label: dict.member.exportDestinations,
      value:
        destCountries
          .map((c) => (locale === "ja" ? c.nameJa : c.nameEn))
          .join(", ") || "—",
    },
    {
      label: "個人情報保護法制",
      value: company.country.privacyRegime,
    },
  ];
  if (isJapan) {
    facts.splice(6, 0, {
      label: dict.member.antiqueLicense,
      value: company.antiqueLicenseNo || "—",
    });
  }

  return (
    <>
      <PageHeader
        title={locale === "ja" ? company.name : company.nameEn}
        lead={company.contactEmail}
        actions={
          <Link href="/admin/members" className="btn btn-ghost">
            {dict.common.back}
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={COMPANY_STATUS_TONE[company.status] ?? "neutral"} dot>
          {dict.companyStatus[company.status as keyof typeof dict.companyStatus]}
        </Badge>
        {company.bidLimitCents != null && (
          <Badge tone="warn">
            {dict.member.bidLimit} {formatMoney(company.bidLimitCents, "USD", locale)}
          </Badge>
        )}
        <Badge tone={company.riskScore >= 70 ? "danger" : company.riskScore >= 40 ? "warn" : "neutral"}>
          {dict.member.riskScore} {company.riskScore}
        </Badge>
        <span className="text-xs text-muted">
          {dict.member.appliedAt}:{" "}
          {formatDateTime(company.appliedAt, admin.timezone, locale)}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          {/* company facts */}
          <Card className="p-6">
            <h2 className="mb-4 text-base font-bold text-ink">
              {dict.member.step1}
            </h2>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-xs font-semibold text-muted">{f.label}</dt>
                  <dd className="mt-0.5 break-words text-sm text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* documents */}
          <Card className="overflow-hidden">
            <div className="border-b border-line px-6 py-4">
              <h2 className="text-base font-bold text-ink">{dict.member.documents}</h2>
              <p className="mt-0.5 text-xs text-muted">
                書類はアプリケーション経由でのみ取得でき、直接URLでは公開されません。
              </p>
            </div>
            <ul className="divide-y divide-line">
              {company.documents.map((d) => (
                <li key={d.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {dict.documentKind[d.kind as keyof typeof dict.documentKind] ?? d.kind}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {d.fileName} · {humanSize(d.sizeBytes)}
                      </p>
                      {d.rejectReason && (
                        <p className="mt-1 text-xs font-medium text-danger">
                          {d.rejectReason}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        tone={
                          d.status === "APPROVED"
                            ? "success"
                            : d.status === "REJECTED"
                              ? "danger"
                              : "neutral"
                        }
                        dot
                      >
                        {dict.docStatus[d.status as keyof typeof dict.docStatus] ?? d.status}
                      </Badge>
                      <a
                        href={`/api/documents/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-subtle px-2.5 py-1 text-xs"
                      >
                        {dict.member.openDoc}
                      </a>
                    </div>
                  </div>

                  {d.status !== "APPROVED" && (
                    <form action={reviewDocumentAction} className="mt-3 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="documentId" value={d.id} />
                      <input
                        name="rejectReason"
                        className="input h-8 max-w-56 flex-1 py-1 text-xs"
                        placeholder={dict.member.rejectReason}
                      />
                      <SubmitButton
                        name="decision"
                        value="APPROVED"
                        className="btn-primary px-2.5 py-1 text-xs"
                        pendingLabel={dict.common.processing}
                      >
                        {dict.member.approveDoc}
                      </SubmitButton>
                      <SubmitButton
                        name="decision"
                        value="REJECTED"
                        className="btn-danger px-2.5 py-1 text-xs"
                        pendingLabel={dict.common.processing}
                      >
                        {dict.member.rejectDoc}
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
              {company.documents.length === 0 && (
                <li className="px-6 py-10 text-center text-sm text-muted">
                  {dict.common.noData}
                </li>
              )}
            </ul>
          </Card>

          {/* audit trail */}
          <Card className="overflow-hidden">
            <div className="border-b border-line px-6 py-4">
              <h2 className="text-base font-bold text-ink">{dict.nav.audit}</h2>
            </div>
            <ul className="divide-y divide-line">
              {trail.map((a) => (
                <li key={a.id} className="px-6 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge bg-surface-3 font-mono text-[10px] text-ink-2">
                      {a.action}
                    </span>
                    <span className="text-sm text-ink-2">{a.summary}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {a.actorLabel} · {formatDateTime(a.createdAt, admin.timezone, locale)} ·{" "}
                    {a.ip ?? "-"}
                  </p>
                </li>
              ))}
              {trail.length === 0 && (
                <li className="px-6 py-8 text-center text-sm text-muted">
                  {dict.common.noData}
                </li>
              )}
            </ul>
          </Card>
        </div>

        {/* review actions */}
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="text-base font-bold text-ink">{dict.member.statusTitle}</h2>

            <form action={setMemberStatusAction} className="mt-4 space-y-3">
              <input type="hidden" name="companyId" value={company.id} />

              <div>
                <label className="label" htmlFor="reviewNote">
                  {dict.member.reviewNote}
                </label>
                <textarea
                  id="reviewNote"
                  name="reviewNote"
                  rows={3}
                  defaultValue={company.reviewNote ?? ""}
                  className="input resize-y"
                  placeholder="審査の判断理由を残してください（監査ログに保存されます）"
                />
              </div>

              <div>
                <label className="label" htmlFor="bidLimit">
                  {dict.member.bidLimit} (USD)
                </label>
                <input
                  id="bidLimit"
                  name="bidLimit"
                  type="number"
                  min={0}
                  step={100}
                  defaultValue={
                    company.bidLimitCents != null ? company.bidLimitCents / 100 : 5000
                  }
                  className="input tnum"
                />
                <p className="mt-1 text-xs text-muted">
                  仮承認のときだけ適用されます。本登録にすると上限は解除されます。
                </p>
              </div>

              <div className="grid gap-2">
                <SubmitButton
                  name="status"
                  value="UNDER_REVIEW"
                  className="btn-ghost w-full"
                  pendingLabel={dict.common.processing}
                >
                  {dict.member.startReview}
                </SubmitButton>
                <SubmitButton
                  name="status"
                  value="PROVISIONAL"
                  className="btn-subtle w-full"
                  pendingLabel={dict.common.processing}
                >
                  {dict.member.approveProvisional}
                </SubmitButton>
                <SubmitButton
                  name="status"
                  value="APPROVED"
                  className="btn-primary w-full"
                  pendingLabel={dict.common.processing}
                >
                  {dict.member.approve}
                </SubmitButton>
                <div className="my-1 h-px bg-line" />
                <SubmitButton
                  name="status"
                  value="SUSPENDED"
                  className="btn-danger w-full"
                  confirm={dict.member.confirmSuspend}
                  pendingLabel={dict.common.processing}
                >
                  {dict.member.suspend}
                </SubmitButton>
                <SubmitButton
                  name="status"
                  value="EXPELLED"
                  className="btn-danger w-full"
                  confirm={dict.member.confirmExpel}
                  pendingLabel={dict.common.processing}
                >
                  {dict.member.expel}
                </SubmitButton>
              </div>
            </form>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-bold text-ink">
              {dict.member.companyUsers}
            </h2>
            <ul className="mt-3 space-y-2">
              {company.users.map((u) => (
                <li key={u.id} className="rounded-lg bg-surface-2 px-3 py-2.5">
                  <p className="text-sm font-medium text-ink">{u.name}</p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge
                      tone={
                        u.status === "ACTIVE"
                          ? "success"
                          : u.status === "LOCKED"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {dict.userStatus[u.status as keyof typeof dict.userStatus] ?? u.status}
                    </Badge>
                    <Badge tone={u.mfaEnabled ? "success" : "neutral"}>
                      MFA {u.mfaEnabled ? dict.auth.mfaOn : dict.auth.mfaOff}
                    </Badge>
                    <span className="text-[11px] uppercase text-muted">{u.locale}</span>
                  </p>
                </li>
              ))}
              {company.users.length === 0 && (
                <li className="text-sm text-muted">{dict.common.noData}</li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
