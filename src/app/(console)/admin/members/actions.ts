"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import type { Locale } from "@/lib/constants";

async function firstUserOf(companyId: string) {
  return prisma.user.findFirst({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * The approval ladder from the brief: 仮登録 → 書類審査 → 本登録.
 * Every transition writes an audit row and an outbound notification, because
 * "who approved this buyer, and when" is the first question anyone asks when
 * a trade goes wrong.
 */
export async function setMemberStatusAction(formData: FormData): Promise<void> {
  const admin = await requireRole("ADMIN");
  const companyId = String(formData.get("companyId") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("reviewNote") ?? "").trim();
  const rawLimit = String(formData.get("bidLimit") ?? "").trim();

  const allowed = [
    "PENDING",
    "UNDER_REVIEW",
    "PROVISIONAL",
    "APPROVED",
    "SUSPENDED",
    "EXPELLED",
  ];
  if (!allowed.includes(status)) return;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { country: true },
  });
  if (!company) return;

  const bidLimitCents =
    status === "PROVISIONAL" && rawLimit
      ? Math.max(0, Math.round(Number(rawLimit) * 100))
      : status === "APPROVED"
        ? null
        : company.bidLimitCents;

  await prisma.company.update({
    where: { id: companyId },
    data: {
      status,
      bidLimitCents,
      reviewNote: note || company.reviewNote,
      reviewedAt: status === "PENDING" ? null : new Date(),
      approvedAt:
        status === "APPROVED" || status === "PROVISIONAL"
          ? new Date()
          : company.approvedAt,
    },
  });

  // A suspended or removed company must not keep an active login.
  if (status === "SUSPENDED" || status === "EXPELLED") {
    await prisma.user.updateMany({
      where: { companyId },
      data: { status: "DISABLED" },
    });
    await prisma.session.deleteMany({ where: { user: { companyId } } });
  } else {
    await prisma.user.updateMany({
      where: { companyId, status: "DISABLED" },
      data: { status: "ACTIVE" },
    });
  }

  const user = await firstUserOf(companyId);
  const templateByStatus = {
    UNDER_REVIEW: "member.under_review",
    APPROVED: "member.approved",
    PROVISIONAL: "member.provisional",
    SUSPENDED: "member.suspended",
    EXPELLED: "member.suspended",
  } as const;
  const template = templateByStatus[status as keyof typeof templateByStatus];

  if (user && template) {
    await notify({
      userId: user.id,
      toAddress: user.email,
      templateKey: template,
      locale: user.locale as Locale,
      relatedType: "Company",
      relatedId: companyId,
      extra: note || undefined,
    });
  }

  const action =
    status === "APPROVED" || status === "PROVISIONAL"
      ? "MEMBER_APPROVE"
      : status === "SUSPENDED" || status === "EXPELLED"
        ? "MEMBER_SUSPEND"
        : "MEMBER_REVIEW";

  await writeAudit({
    actorUserId: admin.id,
    actorLabel: admin.name,
    action,
    targetType: "Company",
    targetId: companyId,
    summary: `${company.name} のステータスを ${status} に変更`,
    detail: { status, bidLimitCents, note: note || null },
  });

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${companyId}`);
}

export async function reviewDocumentAction(formData: FormData): Promise<void> {
  const admin = await requireRole("ADMIN");
  const documentId = String(formData.get("documentId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("rejectReason") ?? "").trim();

  if (decision !== "APPROVED" && decision !== "REJECTED") return;

  const doc = await prisma.companyDocument.update({
    where: { id: documentId },
    data: {
      status: decision,
      reviewedById: admin.id,
      reviewedAt: new Date(),
      rejectReason: decision === "REJECTED" ? reason || "不備あり" : null,
    },
    include: { company: true },
  });

  await writeAudit({
    actorUserId: admin.id,
    actorLabel: admin.name,
    action: "MEMBER_REVIEW",
    targetType: "CompanyDocument",
    targetId: documentId,
    summary: `${doc.company.name} の ${doc.kind} を ${decision === "APPROVED" ? "承認" : "差し戻し"}`,
    detail: { kind: doc.kind, decision, reason: reason || null },
  });

  revalidatePath(`/admin/members/${doc.companyId}`);
}
