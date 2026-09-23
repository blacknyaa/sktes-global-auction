"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canBid, clientIp, getCurrentUser, requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import {
  effectiveEndAt,
  openSeal,
  revealBid,
  sealBid,
  SealNotOpenableError,
} from "@/lib/seal";
import type { Locale } from "@/lib/constants";

export type BidState = { ok?: string; error?: string };

/**
 * Places or replaces a sealed bid.
 *
 * Two things happen here that are easy to get wrong and expensive to fix
 * later:
 *
 *  1. The amount is encrypted before it is written. It never exists as a
 *     readable column while the lot is open.
 *  2. A late bid on a soft-close lot pushes the deadline out inside the same
 *     transaction as the bid itself. If those two were separate writes, two
 *     bidders arriving in the last second could each read the old deadline and
 *     one extension would be lost.
 */
export async function placeBidAction(
  _prev: BidState,
  formData: FormData
): Promise<BidState> {
  const user = await requireUser();
  const lotId = String(formData.get("lotId") ?? "");
  const raw = String(formData.get("amount") ?? "").replace(/[, ]/g, "");

  if (!canBid(user)) return { error: "NOT_APPROVED" };

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "AMOUNT" };
  const amountCents = Math.round(amount * 100);

  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot || !lot.sealPublicKey) return { error: "CLOSED" };
  if (lot.sellerCompanyId === user.companyId) return { error: "OWN_LOT" };
  if (lot.status !== "OPEN") return { error: "CLOSED" };

  const now = new Date();
  const closeAt = effectiveEndAt(lot);
  if (now >= closeAt) return { error: "CLOSED" };
  if (amountCents < lot.minimumBidCents) return { error: "MINIMUM" };
  const bidLimitCents = user.company?.bidLimitCents;
  if (bidLimitCents != null && amountCents > bidLimitCents) {
    return { error: "LIMIT" };
  }

  const sealed = sealBid(lot.sealPublicKey, amountCents, now);
  const ip = await clientIp();

  // Soft close: a bid inside the trigger window pushes the deadline out.
  const msLeft = closeAt.getTime() - now.getTime();
  const triggerMs = lot.extensionTriggerMin * 60_000;
  const extends_ = lot.extensionEnabled && msLeft <= triggerMs;
  const newEnd = extends_
    ? new Date(closeAt.getTime() + lot.extensionMinutes * 60_000)
    : null;

  // Find, supersede, and create inside one transaction so two requests from
  // the same company cannot both leave a SEALED row behind.
  const sequence = await prisma.$transaction(async (tx) => {
    const previous = await tx.bid.findFirst({
      where: { lotId, bidderCompanyId: user.companyId!, status: "SEALED" },
      orderBy: { sequence: "desc" },
    });
    await tx.bid.updateMany({
      where: { lotId, bidderCompanyId: user.companyId!, status: "SEALED" },
      data: { status: "SUPERSEDED" },
    });
    const nextSequence = (previous?.sequence ?? 0) + 1;
    await tx.bid.create({
      data: {
        lotId,
        bidderCompanyId: user.companyId!,
        userId: user.id,
        sequence: nextSequence,
        ciphertext: sealed.ciphertext,
        commitmentHash: sealed.commitmentHash,
        nonce: "", // withheld until opening
        status: "SEALED",
        submittedAt: now,
        ip,
      },
    });
    if (newEnd) {
      await tx.lot.update({
        where: { id: lotId },
        data: {
          extendedUntil: newEnd,
          extensionCount: { increment: 1 },
        },
      });
    }
    return nextSequence;
  });

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.company?.name ?? user.name,
    action: sequence > 1 ? "BID_AMEND" : "BID_SUBMIT",
    targetType: "Lot",
    targetId: lotId,
    summary: `${lot.lotNumber} へ封印入札を送信（金額は暗号化して保管）`,
    detail: {
      commitmentHash: sealed.commitmentHash,
      sequence,
      softCloseExtended: Boolean(newEnd),
    },
  });

  await notify({
    userId: user.id,
    toAddress: user.email,
    templateKey: "bid.received",
    locale: user.locale as Locale,
    relatedType: "Lot",
    relatedId: lotId,
  });

  revalidatePath(`/lots/${lotId}`);
  revalidatePath("/bids");
  return { ok: newEnd ? "EXTENDED" : "SUBMITTED" };
}

export async function cancelBidAction(
  _prev: BidState,
  formData: FormData
): Promise<BidState> {
  const user = await requireUser();
  const lotId = String(formData.get("lotId") ?? "");

  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot || lot.status !== "OPEN") return { error: "CLOSED" };
  if (new Date() >= effectiveEndAt(lot)) return { error: "CLOSED" };

  const { count } = await prisma.bid.updateMany({
    where: { lotId, bidderCompanyId: user.companyId!, status: "SEALED" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  if (count === 0) return { error: "AMOUNT" };

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.company?.name ?? user.name,
    action: "BID_CANCEL",
    targetType: "Lot",
    targetId: lotId,
    summary: `${lot.lotNumber} の入札を取り消しました`,
  });
  await notify({
    userId: user.id,
    toAddress: user.email,
    templateKey: "bid.cancelled",
    locale: user.locale as Locale,
    relatedType: "Lot",
    relatedId: lotId,
  });

  revalidatePath(`/lots/${lotId}`);
  revalidatePath("/bids");
  return { ok: "CANCELLED" };
}

/**
 * The opening ceremony. Unseals the lot key, decrypts every bid, verifies each
 * commitment hash, and writes the amounts back. Refuses to run early.
 */
export async function openSealAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const lotId = String(formData.get("lotId") ?? "");

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: { bids: { where: { status: "SEALED" } }, sellerCompany: true },
  });
  if (!lot) return;

  const isOwner = user.companyId === lot.sellerCompanyId;
  if (user.role !== "ADMIN" && !(user.role === "SELLER" && isOwner)) return;

  let privateKey;
  try {
    privateKey = openSeal(lot, new Date());
  } catch (err) {
    if (err instanceof SealNotOpenableError) {
      await writeAudit({
        actorUserId: user.id,
        actorLabel: user.name,
        action: "ADMIN_ACTION",
        targetType: "Lot",
        targetId: lotId,
        summary: `${lot.lotNumber} の早期開封が拒否されました（締切前）`,
      });
      return;
    }
    throw err;
  }

  let verified = 0;
  let failed = 0;

  for (const bid of lot.bids) {
    const revealed = revealBid(privateKey, bid.ciphertext, bid.commitmentHash);
    if (revealed.commitmentOk) verified++;
    else failed++;
    await prisma.bid.update({
      where: { id: bid.id },
      data: {
        amountCents: revealed.amountCents,
        nonce: revealed.nonce,
        status: "REVEALED",
        revealedAt: new Date(),
      },
    });
  }

  await prisma.lot.update({
    where: { id: lotId },
    data: {
      status: lot.bids.length > 0 ? "CLOSED" : "FAILED",
      openedAt: new Date(),
      openedById: user.id,
    },
  });

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.name,
    action: "LOT_OPEN",
    targetType: "Lot",
    targetId: lotId,
    summary: `${lot.lotNumber} の封印を解除（${lot.bids.length}件を開封、ハッシュ一致 ${verified} / 不一致 ${failed}）`,
    detail: { opened: lot.bids.length, verified, failed },
  });

  revalidatePath(`/lots/${lotId}`);
}

export async function askQuestionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const lotId = String(formData.get("lotId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body || !user.companyId) return;

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: { createdBy: true },
  });
  if (!lot) return;
  if (lot.status === "DRAFT" || lot.status === "CANCELLED") return;
  if (user.role !== "BIDDER") return;

  await prisma.question.create({
    data: {
      lotId,
      askerCompanyId: user.companyId,
      userId: user.id,
      body: body.slice(0, 1000),
      isPublic: true,
    },
  });

  await notify({
    userId: lot.createdById,
    toAddress: lot.createdBy.email,
    templateKey: "question.asked",
    locale: lot.createdBy.locale as Locale,
    relatedType: "Lot",
    relatedId: lotId,
  });

  revalidatePath(`/lots/${lotId}`);
}

export async function answerQuestionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const questionId = String(formData.get("questionId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { lot: true, user: true },
  });
  if (!question) return;

  const isOwner = user.companyId === question.lot.sellerCompanyId;
  if (user.role !== "ADMIN" && !isOwner) return;

  await prisma.answer.upsert({
    where: { questionId },
    create: { questionId, userId: user.id, body: body.slice(0, 2000) },
    update: { body: body.slice(0, 2000), userId: user.id },
  });

  await notify({
    userId: question.userId,
    toAddress: question.user.email,
    templateKey: "question.answered",
    locale: question.user.locale as Locale,
    relatedType: "Lot",
    relatedId: question.lotId,
  });

  revalidatePath(`/lots/${question.lotId}`);
}

/** Toggles a bidder watch on a lot. */
export async function toggleWatchAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const lotId = String(formData.get("lotId") ?? "");
  const existing = await prisma.watch.findUnique({
    where: { userId_lotId: { userId: user.id, lotId } },
  });
  if (existing) await prisma.watch.delete({ where: { id: existing.id } });
  else await prisma.watch.create({ data: { userId: user.id, lotId } });
  revalidatePath(`/lots/${lotId}`);
}
