"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { JP_CONSUMPTION_TAX_RATE, type Locale } from "@/lib/constants";
import { FX_RATES } from "@/lib/format";

function serialFor(date: Date, n: number): string {
  return `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, "0")}-${String(n).padStart(4, "0")}`;
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
  const contractCount = await prisma.contract.count();
  const invoiceCount = await prisma.invoice.count();

  const buyerCountry = winner.bidderCompany.country;
  const isJapanBuyer = buyerCountry.code === "JP";
  const subtotal = winner.amountCents ?? 0;
  const tax = isJapanBuyer ? Math.round(subtotal * JP_CONSUMPTION_TAX_RATE) : 0;
  const qualified = await prisma.systemSetting.findUnique({
    where: { key: "qualified_invoice_number" },
  });

  await prisma.$transaction(async (tx) => {
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
        contractNo: `CT-${serialFor(now, contractCount + 1)}`,
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
        invoiceNo: `INV-${serialFor(now, invoiceCount + 1)}`,
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
  });

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
