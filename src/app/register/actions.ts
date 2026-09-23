"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { LOGIN_ID_PATTERN, hashPassword, normalizeLoginId } from "@/lib/auth";
import { getDictionary } from "@/i18n";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { inspectDocument, saveUpload } from "@/lib/storage";
import type { Locale } from "@/lib/constants";

export type RegisterState = { error?: string; field?: string };

const schema = z.object({
  companyName: z.string().min(1).max(160),
  companyNameEn: z.string().min(1).max(160),
  countryCode: z.string().length(2),
  contactName: z.string().min(1).max(120),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(4).max(40),
  corporateNumber: z.string().max(40).optional(),
  hqAddress: z.string().min(1).max(240),
  branchAddress: z.string().max(240).optional(),
  hasImportLicense: z.enum(["yes", "no"]),
  antiqueLicenseNo: z.string().max(60).optional(),
  loginId: z.string().regex(LOGIN_ID_PATTERN),
  password: z.string().min(8),
});

const DOC_SLOTS = [
  { field: "doc_registry", kind: "REGISTRY", required: true },
  { field: "doc_id", kind: "ID_DOCUMENT", required: true },
  { field: "doc_antique", kind: "ANTIQUE_LICENSE", required: false },
  { field: "doc_import", kind: "IMPORT_LICENSE", required: false },
] as const;

export async function registerAction(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const raw = {
    companyName: String(formData.get("companyName") ?? "").trim(),
    companyNameEn: String(formData.get("companyNameEn") ?? "").trim(),
    countryCode: String(formData.get("countryCode") ?? "").trim(),
    contactName: String(formData.get("contactName") ?? "").trim(),
    contactEmail: String(formData.get("contactEmail") ?? "").trim().toLowerCase(),
    contactPhone: String(formData.get("contactPhone") ?? "").trim(),
    corporateNumber: String(formData.get("corporateNumber") ?? "").trim(),
    hqAddress: String(formData.get("hqAddress") ?? "").trim(),
    branchAddress: String(formData.get("branchAddress") ?? "").trim(),
    hasImportLicense: String(formData.get("hasImportLicense") ?? "no"),
    antiqueLicenseNo: String(formData.get("antiqueLicenseNo") ?? "").trim(),
    loginId: normalizeLoginId(String(formData.get("loginId") ?? "")),
    password: String(formData.get("password") ?? ""),
  };

  const dict = await getDictionary();
  if (!LOGIN_ID_PATTERN.test(raw.loginId)) {
    return { error: dict.member.loginIdInvalid, field: "loginId" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "入力内容に不備があります。必須項目をご確認ください。",
      field: parsed.error.issues[0]?.path.join("."),
    };
  }
  if (formData.get("agree") !== "on") {
    return { error: "利用規約への同意が必要です。" };
  }
  if (
    !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(parsed.data.password)
  ) {
    return { error: "パスワードは8文字以上で、英字と数字を含めてください。" };
  }

  const exists = await prisma.user.findUnique({
    where: { email: parsed.data.contactEmail },
  });
  if (exists) {
    return { error: "このメールアドレスはすでに登録されています。" };
  }
  const idTaken = await prisma.user.findUnique({
    where: { loginId: parsed.data.loginId },
  });
  if (idTaken) {
    return { error: dict.member.loginIdTaken, field: "loginId" };
  }

  const country = await prisma.country.findUnique({
    where: { code: parsed.data.countryCode },
  });
  if (!country) return { error: "所在国を選択してください。" };

  const isJapan = parsed.data.countryCode === "JP";
  if (isJapan && !parsed.data.antiqueLicenseNo) {
    return {
      error: "日本国内のバイヤーは古物商許可番号が必須です。",
      field: "antiqueLicenseNo",
    };
  }

  // Collect and validate the uploads before writing anything to the database.
  const uploads: { kind: string; file: File; mimeType: string }[] = [];
  for (const slot of DOC_SLOTS) {
    const file = formData.get(slot.field);
    if (!(file instanceof File) || file.size === 0) {
      if (slot.required) {
        return { error: "会社登記簿謄本と身分証明書は必須です。", field: slot.field };
      }
      if (slot.kind === "ANTIQUE_LICENSE" && isJapan) {
        return { error: "日本国内のバイヤーは古物商許可証の添付が必要です。", field: slot.field };
      }
      continue;
    }
    const inspected = await inspectDocument(file);
    if ("problem" in inspected) return { error: inspected.problem, field: slot.field };
    uploads.push({ kind: slot.kind, file, mimeType: inspected.mimeType });
  }

  const exportDestinations = formData
    .getAll("exportDestinations")
    .map(String)
    .filter(Boolean);

  const passwordHash = await hashPassword(parsed.data.password);

  // The company, its documents and its user stand or fall together. The
  // duplicate checks above ran before any of this, so two people registering
  // the same ID at once both pass them; without a transaction the loser's
  // company and uploaded documents would stay behind, belonging to no one.
  let company, user;
  try {
    ({ company, user } = await prisma.$transaction(
      async (tx) => {
        const company = await tx.company.create({
          data: {
            type: "BUYER",
            name: parsed.data.companyName,
            nameEn: parsed.data.companyNameEn,
            countryCode: parsed.data.countryCode,
            corporateNumber: parsed.data.corporateNumber || null,
            contactName: parsed.data.contactName,
            contactEmail: parsed.data.contactEmail,
            contactPhone: parsed.data.contactPhone,
            hqAddress: parsed.data.hqAddress,
            branchAddress: parsed.data.branchAddress || null,
            exportDestinations: JSON.stringify(exportDestinations),
            hasImportLicense: parsed.data.hasImportLicense === "yes",
            antiqueLicenseNo: isJapan ? parsed.data.antiqueLicenseNo : null,
            status: "PENDING",
            termsAcceptedAt: new Date(),
            appliedAt: new Date(),
          },
        });

        for (const up of uploads) {
          const stored = await saveUpload(
            up.file,
            `documents/${company.id}`,
            up.mimeType,
            tx
          );
          await tx.companyDocument.create({
            data: {
              companyId: company.id,
              kind: up.kind,
              fileName: stored.fileName,
              mimeType: stored.mimeType,
              sizeBytes: stored.sizeBytes,
              storageKey: stored.storageKey,
              status: "PENDING",
            },
          });
        }

        const user = await tx.user.create({
          data: {
            companyId: company.id,
            email: parsed.data.contactEmail,
            loginId: parsed.data.loginId,
            passwordHash,
            name: parsed.data.contactName,
            phone: parsed.data.contactPhone,
            role: "BIDDER",
            locale: isJapan
              ? "ja"
              : ["CN", "TW", "HK"].includes(parsed.data.countryCode)
                ? "zh"
                : "en",
            timezone: country.timezone,
            status: "ACTIVE",
          },
        });
        return { company, user };
      },
      // Up to four 10 MB documents go in with the rows.
      { timeout: 30_000 }
    ));
  } catch (e) {
    const err = e as { code?: string; meta?: { target?: unknown } };
    if (err.code === "P2002") {
      return String(err.meta?.target ?? "").includes("loginId")
        ? { error: dict.member.loginIdTaken, field: "loginId" }
        : { error: "このメールアドレスはすでに登録されています。" };
    }
    throw e;
  }

  await notify({
    userId: user.id,
    toAddress: user.email,
    templateKey: "member.applied",
    locale: user.locale as Locale,
    relatedType: "Company",
    relatedId: company.id,
  });

  await writeAudit({
    actorUserId: user.id,
    actorLabel: company.name,
    action: "MEMBER_APPLY",
    targetType: "Company",
    targetId: company.id,
    summary: `${company.name}（${country.nameJa}）が仮登録を申請しました`,
    detail: {
      documents: uploads.map((u) => u.kind),
      hasImportLicense: parsed.data.hasImportLicense === "yes",
    },
  });

  redirect("/register/done");
}
