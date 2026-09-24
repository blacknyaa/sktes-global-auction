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
import { commitLotOpening } from "@/lib/lotOpen";
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
 *     transaction as the bid itself, after re-reading the lot. If the new end
 *     were computed from a snapshot taken before the transaction, two bidders
 *     arriving in the last second could each extend from the same closeAt and
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

  const ip = await clientIp();

  // Deadline, soft-close extension, supersede, and create must share one
  // transaction. Computing the new endAt from a pre-tx snapshot lets two late
  // bids each push from the same closeAt and one extension is lost. The clock
  // used for the close gate must be taken at write time too — a request that
  // started before the deadline must not commit after it under load.
  let sequence: number;
  let extended = false;
  let commitmentHash: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const fresh = await tx.lot.findUnique({ where: { id: lotId } });
      if (!fresh || fresh.status !== "OPEN" || !fresh.sealPublicKey) {
        throw new BidClosedError();
      }
      const liveNow = new Date();
      const liveCloseAt = effectiveEndAt(fresh);
      if (liveNow >= liveCloseAt) throw new BidClosedError();

      const msLeft = liveCloseAt.getTime() - liveNow.getTime();
      const triggerMs = fresh.extensionTriggerMin * 60_000;
      const newEnd =
        fresh.extensionEnabled && msLeft <= triggerMs
          ? new Date(liveCloseAt.getTime() + fresh.extensionMinutes * 60_000)
          : null;

      const sealed = sealBid(fresh.sealPublicKey, amountCents, liveNow);
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
          submittedAt: liveNow,
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
      return {
        sequence: nextSequence,
        extended: Boolean(newEnd),
        commitmentHash: sealed.commitmentHash,
      };
    });
    sequence = result.sequence;
    extended = result.extended;
    commitmentHash = result.commitmentHash;
  } catch (err) {
    if (err instanceof BidClosedError) return { error: "CLOSED" };
    throw err;
  }

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.company?.name ?? user.name,
    action: sequence > 1 ? "BID_AMEND" : "BID_SUBMIT",
    targetType: "Lot",
    targetId: lotId,
    summary: `${lot.lotNumber} へ封印入札を送信（金額は暗号化して保管）`,
    detail: {
      commitmentHash,
      sequence,
      softCloseExtended: extended,
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
  return { ok: extended ? "EXTENDED" : "SUBMITTED" };
}

class BidClosedError extends Error {
  constructor() {
    super("CLOSED");
    this.name = "BidClosedError";
  }
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
  if (count === 0) return { error: "NO_BID" };

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
 *
 * Claiming `openedAt` in the same write that records the reveals is what stops
 * a second click from seeing zero SEALED rows and rewriting the lot as FAILED
 * (or stomping an award that already moved the status off OPEN/CLOSED).
 */
export async function openSealAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const lotId = String(formData.get("lotId") ?? "");

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: { bids: { where: { status: "SEALED" } }, sellerCompany: true },
  });
  // CLOSED is normal once the deadline tick has run; only skip if already opened.
  if (!lot || lot.openedAt) return;
  if (lot.status !== "OPEN" && lot.status !== "CLOSED") return;

  const isOwner = user.companyId === lot.sellerCompanyId;
  if (user.role !== "ADMIN" && !(user.role === "SELLER" && isOwner)) return;

  const now = new Date();
  // Re-read so soft-close extensions that landed after the first load are
  // visible to the crypto time-gate (commitLotOpening pins them again).
  const live = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!live || live.openedAt) return;
  if (live.status !== "OPEN" && live.status !== "CLOSED") return;

  let privateKey;
  try {
    privateKey = openSeal(live, now);
  } catch (err) {
    if (err instanceof SealNotOpenableError) {
      await writeAudit({
        actorUserId: user.id,
        actorLabel: user.name,
        // Sellers can hit this path; it is not an admin privilege.
        action: "LOT_OPEN",
        targetType: "Lot",
        targetId: lotId,
        summary: `${lot.lotNumber} の早期開封が拒否されました（締切前）`,
        detail: { refused: true, reason: "before_deadline" },
      });
      return;
    }
    throw err;
  }

  const sealedBids = await prisma.bid.findMany({
    where: { lotId, status: "SEALED" },
  });
  const revelations = sealedBids.map((bid) => {
    const revealed = revealBid(privateKey, bid.ciphertext, bid.commitmentHash);
    return {
      bidId: bid.id,
      amountCents: revealed.amountCents,
      nonce: revealed.nonce,
      commitmentOk: revealed.commitmentOk,
    };
  });

  const opened = await prisma.$transaction((tx) =>
    commitLotOpening(tx, {
      lotId,
      openedById: user.id,
      revelations,
      now,
    })
  );
  if (!opened) return;

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.name,
    action: "LOT_OPEN",
    targetType: "Lot",
    targetId: lotId,
    summary: `${lot.lotNumber} の封印を解除（${revelations.length}件を開封、ハッシュ一致 ${opened.verified} / 不一致 ${opened.failed}）`,
    detail: {
      opened: revelations.length,
      verified: opened.verified,
      failed: opened.failed,
    },
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
  // Q&A is for active bidding; closed or awarded lots keep a frozen record.
  if (lot.status !== "OPEN" && lot.status !== "SCHEDULED") return;
  // Status can lag the clock by the lifecycle sweep. Match the bid panel:
  // once effectiveEndAt has passed, the record freezes even while still OPEN.
  if (new Date() >= effectiveEndAt(lot)) return;
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
  // Same window as askQuestionAction: after close or award the Q&A record freezes.
  if (question.lot.status !== "OPEN" && question.lot.status !== "SCHEDULED") {
    return;
  }
  if (new Date() >= effectiveEndAt(question.lot)) return;

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
