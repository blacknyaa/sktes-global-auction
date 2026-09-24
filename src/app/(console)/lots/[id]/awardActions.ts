"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { JP_CONSUMPTION_TAX_RATE, type Locale } from "@/lib/constants";
import { FX_RATES } from "@/lib/format";

function serialFor(date: Date, n: number): string {
  return `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, "0")}-${String(n).padStart(4, "0")}`;
}

function uniqueTargets(err: Prisma.PrismaClientKnownRequestError): string[] {
  const t = err.meta?.target;
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === "string") return [t];
  return [];
}

/**
 * Confirms the winner.
 *
 * The brief allows the seller to pick any bidder, not necessarily the highest.
 * That is a legitimate commercial decision, but it is also the thing a losing
 * bidder will question, so the reason is mandatory whenever the highest bid is
 * passed over, and it lands in the audit log next to the rank that was chosen.
 */
export async function awardLotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const lotId = String(formData.get("lotId") ?? "");
  const bidId = String(formData.get("bidId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      bids: {
        where: { status: "REVEALED" },
        orderBy: { amountCents: "desc" },
        include: { bidderCompany: { include: { country: true } }, user: true },
      },
      sellerCompany: true,
      award: true,
    },
  });
  if (!lot || lot.award) return;
  // Only a closed, opened lot can be awarded. A cancelled-after-open lot must
  // not still accept a winner pick.
  if (lot.status !== "CLOSED" || !lot.openedAt) return;

  const isOwner = user.companyId === lot.sellerCompanyId;
  if (user.role !== "ADMIN" && !(user.role === "SELLER" && isOwner)) return;

  const ranked = lot.bids;
  const index = ranked.findIndex((b) => b.id === bidId);
  if (index === -1) return;

  const winner = ranked[index];
  const rank = index + 1;
  const isHighest = rank === 1;
  if (!isHighest && !reason) return; // reason is mandatory for a non-top pick

  const now = new Date();
  let contractSerial = (await prisma.contract.count()) + 1;
  let invoiceSerial = (await prisma.invoice.count()) + 1;

  const buyerCountry = winner.bidderCompany.country;
  const isJapanBuyer = buyerCountry.code === "JP";
  const subtotal = winner.amountCents ?? 0;
  const tax = isJapanBuyer ? Math.round(subtotal * JP_CONSUMPTION_TAX_RATE) : 0;
  const qualified = await prisma.systemSetting.findUnique({
    where: { key: "qualified_invoice_number" },
  });

  // contractNo / invoiceNo are unique. Two awards at once can both pick the
  // same count()+1; on a clash, bump the colliding serial and retry.
  let committed = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      committed = await prisma.$transaction(async (tx) => {
        const already = await tx.award.findUnique({ where: { lotId } });
        if (already) return false;

        const award = await tx.award.create({
          data: {
            lotId,
            bidId,
            winnerCompanyId: winner.bidderCompanyId,
            amountCents: subtotal,
            currency: lot.currency,
            rankAmongBids: rank,
            isHighestBid: isHighest,
            reason: reason || "最高額応札のため選定。",
            selectedById: user.id,
            selectedAt: now,
          },
        });

        const contract = await tx.contract.create({
          data: {
            awardId: award.id,
            contractNo: `CT-${serialFor(now, contractSerial)}`,
            status: "AWARDED",
            amountCents: subtotal,
            currency: lot.currency,
            // The rate is captured at award time, not at invoicing time, so that a
            // week of FX movement does not change what the buyer owes.
            fxRate: isJapanBuyer ? FX_RATES.JPY : null,
            fxCurrency: isJapanBuyer ? "JPY" : null,
            fxCapturedAt: isJapanBuyer ? now : null,
          },
        });

        await tx.invoice.create({
          data: {
            contractId: contract.id,
            invoiceNo: `INV-${serialFor(now, invoiceSerial)}`,
            taxTreatment: isJapanBuyer ? "DOMESTIC_JP_10" : "EXPORT_EXEMPT",
            subtotalCents: subtotal,
            taxCents: tax,
            totalCents: subtotal + tax,
            currency: lot.currency,
            qualifiedInvoiceNo: isJapanBuyer ? (qualified?.value ?? null) : null,
            status: "ISSUED",
            issuedAt: now,
            dueAt: new Date(now.getTime() + 7 * 86_400_000),
          },
        });

        await tx.lot.update({ where: { id: lotId }, data: { status: "AWARDED" } });
        return true;
      });
      break;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const targets = uniqueTargets(err).join(" ");
        if (targets.includes("lotId")) return; // another award won the lot
        if (targets.includes("contractNo")) contractSerial += 1;
        else if (targets.includes("invoiceNo")) invoiceSerial += 1;
        else {
          contractSerial += 1;
          invoiceSerial += 1;
        }
        continue;
      }
      throw err;
    }
  }
  if (!committed) return;

  // Winner and losers both get told. Silence after a sealed auction is the
  // fastest way to lose bidders.
  await notify({
    userId: winner.userId,
    toAddress: winner.user.email,
    templateKey: "award.won",
    locale: winner.user.locale as Locale,
    relatedType: "Lot",
    relatedId: lotId,
  });
  for (const other of ranked.filter((b) => b.id !== bidId)) {
    await notify({
      userId: other.userId,
      toAddress: other.user.email,
      templateKey: "award.lost",
      locale: other.user.locale as Locale,
      relatedType: "Lot",
      relatedId: lotId,
    });
  }

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.company?.name ?? user.name,
    action: "AWARD_CONFIRM",
    targetType: "Lot",
    targetId: lotId,
    summary: `${lot.lotNumber} の落札者を確定（順位 ${rank} 位${isHighest ? "・最高額" : "・最高額ではない"}）`,
    detail: {
      rank,
      isHighestBid: isHighest,
      amountCents: subtotal,
      reason: reason || null,
      winner: winner.bidderCompany.name,
      taxTreatment: isJapanBuyer ? "DOMESTIC_JP_10" : "EXPORT_EXEMPT",
    },
  });

  revalidatePath(`/lots/${lotId}`);
  revalidatePath("/contracts");
}
