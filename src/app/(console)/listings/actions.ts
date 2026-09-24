"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { createLotSeal, effectiveEndAt } from "@/lib/seal";
import { localInputToUtc } from "@/lib/datetime";
import { parseManifest, type ManifestRow } from "@/lib/manifest";
import { ALLOWED_SHEET_TYPES, saveUpload, validateUpload } from "@/lib/storage";

function lotNumberFor(countryCode: string, at: Date, serial: number): string {
  return `SKT-${countryCode}-${String(at.getFullYear()).slice(2)}${String(
    at.getMonth() + 1
  ).padStart(2, "0")}-${String(serial).padStart(4, "0")}`;
}

export type ParseState = {
  rows?: ManifestRow[];
  errors?: { row: number; reason: string }[];
  totalUnits?: number;
  sheetName?: string;
  message?: string;
  storageKey?: string;
  fileName?: string;
};

/** Reads the uploaded workbook and hands back a preview - nothing is saved. */
export async function parseManifestAction(
  _prev: ParseState,
  formData: FormData
): Promise<ParseState> {
  const user = await requireUser();
  if (user.role !== "SELLER" && user.role !== "ADMIN") return { message: "権限がありません。" };

  const file = formData.get("manifest");
  if (!(file instanceof File) || file.size === 0) {
    return { message: "Excelファイルを選択してください。" };
  }
  const problem = validateUpload(file, ALLOWED_SHEET_TYPES);
  if (problem) return { message: problem };

  const parsed = await parseManifest(await file.arrayBuffer());
  if (parsed.rows.length === 0) {
    return {
      message:
        parsed.errors[0]?.reason ??
        "取り込める行がありませんでした。テンプレートをご確認ください。",
      errors: parsed.errors,
    };
  }

  // Keep the original workbook so buyers can download exactly what the seller
  // supplied, alongside the parsed version.
  const stored = await saveUpload(file, `manifests/${user.companyId ?? "unknown"}`);

  return {
    rows: parsed.rows,
    errors: parsed.errors,
    totalUnits: parsed.totalUnits,
    sheetName: parsed.sheetName,
    storageKey: stored.storageKey,
    fileName: stored.fileName,
  };
}

export type CreateState = { error?: string };

const createSchema = z.object({
  title: z.string().min(1).max(200),
  titleEn: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  categoryCode: z.string().min(1),
  condition: z.string().min(1),
  storageLocation: z.string().min(1).max(200),
  handoverLocation: z.string().min(1).max(200),
  startAt: z.string().min(10),
  endAt: z.string().min(10),
  minimumBid: z.string(),
  reserve: z.string().optional(),
  auctionType: z.enum(["SEALED", "OPEN"]),
});

export async function createLotAction(
  _prev: CreateState,
  formData: FormData
): Promise<CreateState> {
  const user = await requireUser();
  if (user.role !== "SELLER" && user.role !== "ADMIN") return { error: "権限がありません。" };
  if (!user.companyId) return { error: "出品者の所属会社が設定されていません。" };

  const parsed = createSchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    titleEn: String(formData.get("titleEn") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    categoryCode: String(formData.get("categoryCode") ?? ""),
    condition: String(formData.get("condition") ?? ""),
    storageLocation: String(formData.get("storageLocation") ?? "").trim(),
    handoverLocation: String(formData.get("handoverLocation") ?? "").trim(),
    startAt: String(formData.get("startAt") ?? ""),
    endAt: String(formData.get("endAt") ?? ""),
    minimumBid: String(formData.get("minimumBid") ?? "0"),
    reserve: String(formData.get("reserve") ?? ""),
    auctionType: (String(formData.get("auctionType") ?? "SEALED") as "SEALED" | "OPEN"),
  });
  if (!parsed.success) return { error: "入力内容をご確認ください。" };

  let rows: ManifestRow[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: "ロット明細の取り込みをやり直してください。" };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "ロット明細が空です。Excelを取り込んでください。" };
  }

  // Deadlines are entered in the seller local time and stored as UTC.
  const startAt = localInputToUtc(parsed.data.startAt, user.timezone);
  const endAt = localInputToUtc(parsed.data.endAt, user.timezone);
  if (endAt <= startAt) return { error: "入札終了日時は開始日時より後にしてください。" };

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    include: { country: true },
  });
  if (!company) return { error: "出品者情報が見つかりません。" };

  const quantity = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const minimumBidCents = Math.max(
    0,
    Math.round(Number(parsed.data.minimumBid.replace(/[, ]/g, "")) * 100) || 0
  );
  const reserveCents = parsed.data.reserve
    ? Math.round(Number(parsed.data.reserve.replace(/[, ]/g, "")) * 100)
    : null;

  let serial = (await prisma.lot.count()) + 1;
  const now = new Date();
  const publish = formData.get("publish") === "1";
  const extensionEnabled = formData.get("extensionEnabled") === "on";
  const extensionTriggerMin = Number(formData.get("extensionTriggerMin") ?? 5) || 5;
  const extensionMinutes = Number(formData.get("extensionMinutes") ?? 5) || 5;
  const itemRows = rows.map((r, i) => ({
    lineNo: i + 1,
    maker: String(r.maker).slice(0, 120),
    model: String(r.model).slice(0, 160),
    cpu: r.cpu ? String(r.cpu).slice(0, 120) : null,
    ramGb: r.ramGb ?? null,
    storage: r.storage ? String(r.storage).slice(0, 120) : null,
    gpu: r.gpu ? String(r.gpu).slice(0, 120) : null,
    screen: r.screen ? String(r.screen).slice(0, 60) : null,
    grade: r.grade ? String(r.grade).slice(0, 8) : null,
    quantity: Number(r.quantity) || 1,
    note: r.note ? String(r.note).slice(0, 240) : null,
  }));

  // lotNumber is unique. Two sellers saving at once can both pick the same
  // count()+1; on a clash, bump the serial and rebuild the seal (it binds the
  // number into its authenticated data).
  let lot: Awaited<ReturnType<typeof prisma.lot.create>> | null = null;
  let lotNumber = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    lotNumber = lotNumberFor(company.countryCode, now, serial);
    const seal = createLotSeal(lotNumber, endAt);
    try {
      lot = await prisma.lot.create({
        data: {
          lotNumber,
          title: parsed.data.title,
          titleEn: parsed.data.titleEn,
          description: parsed.data.description || null,
          categoryCode: parsed.data.categoryCode,
          condition: parsed.data.condition,
          sellerCompanyId: company.id,
          countryCode: company.countryCode,
          quantity,
          storageLocation: parsed.data.storageLocation,
          handoverLocation: parsed.data.handoverLocation,
          currency: "USD",
          reserveCents,
          minimumBidCents,
          auctionType: parsed.data.auctionType,
          startAt,
          endAt,
          extensionEnabled,
          extensionTriggerMin,
          extensionMinutes,
          status: publish ? (startAt <= now ? "OPEN" : "SCHEDULED") : "DRAFT",
          publishedAt: publish ? now : null,
          sealPublicKey: seal.sealPublicKey,
          sealedPrivateKey: seal.sealedPrivateKey,
          sealIv: seal.sealIv,
          sealAuthTag: seal.sealAuthTag,
          createdById: user.id,
          items: { create: itemRows },
        },
      });
      break;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        serial += 1;
        continue;
      }
      throw err;
    }
  }
  if (!lot) {
    return { error: "ロット番号を割り当てられませんでした。もう一度お試しください。" };
  }

  const storageKey = String(formData.get("storageKey") ?? "");
  const fileName = String(formData.get("fileName") ?? "");
  const expectedPrefix = `manifests/${user.companyId}/`;
  if (storageKey.startsWith(expectedPrefix)) {
    const blob = await prisma.storedBlob.findUnique({
      where: { storageKey },
      select: { sizeBytes: true, mimeType: true },
    });
    if (blob) {
      await prisma.lotAttachment.create({
        data: {
          lotId: lot.id,
          kind: "EXCEL",
          fileName: fileName || `${lotNumber}.xlsx`,
          mimeType:
            blob.mimeType ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: blob.sizeBytes,
          storageKey,
        },
      });
    }
  }

  await writeAudit({
    actorUserId: user.id,
    actorLabel: company.name,
    action: publish ? "LOT_PUBLISH" : "LOT_CREATE",
    targetType: "Lot",
    targetId: lot.id,
    summary: `${lotNumber} を${publish ? "公開" : "下書き保存"}（${rows.length}明細 / ${quantity}台）`,
    detail: {
      lines: rows.length,
      quantity,
      auctionType: parsed.data.auctionType,
      extensionEnabled,
      endAtUtc: endAt.toISOString(),
      sellerTimezone: user.timezone,
    },
  });

  revalidatePath("/listings");
  redirect(`/lots/${lot.id}`);
}

export async function publishLotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const lotId = String(formData.get("lotId") ?? "");
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) return;
  if (user.role !== "ADMIN" && user.companyId !== lot.sellerCompanyId) return;
  if (!["DRAFT", "SCHEDULED", "CANCELLED"].includes(lot.status)) return;
  // Once the seal has been opened, bids are REVEALED. Republishing would put
  // an already-readable lot back into OPEN without clearing openedAt.
  if (lot.openedAt) return;

  const now = new Date();
  // A cancelled or draft lot whose deadline has already passed must not be
  // flipped to OPEN — placeBid would then accept bids after the sealed window.
  if (effectiveEndAt(lot) <= now) return;
  if (!lot.sealPublicKey) return;

  await prisma.lot.update({
    where: { id: lotId },
    data: {
      status: lot.startAt <= now ? "OPEN" : "SCHEDULED",
      publishedAt: lot.publishedAt ?? now,
      cancelledAt: null,
      cancelReason: null,
    },
  });
  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.company?.name ?? user.name,
    action: "LOT_PUBLISH",
    targetType: "Lot",
    targetId: lotId,
    summary: `${lot.lotNumber} を公開しました`,
  });
  revalidatePath("/listings");
  revalidatePath(`/lots/${lotId}`);
}

export async function cancelLotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const lotId = String(formData.get("lotId") ?? "");
  const reason = String(formData.get("cancelReason") ?? "").trim();
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) return;
  if (user.role !== "ADMIN" && user.companyId !== lot.sellerCompanyId) return;
  if (["AWARDED", "COMPLETED"].includes(lot.status)) return;
  // After openSeal, amounts are revealed and the lot stays CLOSED. Cancelling
  // then would still leave awardLotAction able to pick a winner on a cancelled lot.
  if (lot.openedAt) return;
  // Past the deadline the sealed bids belong to winner selection. Cancelling
  // then would void them without opening or awarding.
  if (lot.status === "CLOSED" || lot.status === "FAILED") return;
  if (lot.status === "OPEN" && effectiveEndAt(lot) <= new Date()) return;

  const now = new Date();
  // Withdrawing the lot must void live sealed bids in the same write. Leaving
  // them SEALED lets a later republish reopen the auction with those amounts.
  await prisma.$transaction([
    prisma.lot.update({
      where: { id: lotId },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelReason: reason || "出品者都合による取り下げ",
      },
    }),
    prisma.bid.updateMany({
      where: { lotId, status: "SEALED" },
      data: { status: "CANCELLED", cancelledAt: now },
    }),
  ]);
  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.company?.name ?? user.name,
    action: "LOT_CANCEL",
    targetType: "Lot",
    targetId: lotId,
    summary: `${lot.lotNumber} をキャンセルしました`,
    detail: { reason: reason || null },
  });
  revalidatePath("/listings");
  revalidatePath(`/lots/${lotId}`);
}
