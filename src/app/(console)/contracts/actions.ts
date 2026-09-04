"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { DEFAULT_CARD_LIMIT_CENTS, type Locale } from "@/lib/constants";

async function loadContract(contractId: string) {
  return prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      award: {
        include: {
          lot: { include: { sellerCompany: true, createdBy: true } },
          winnerCompany: { include: { users: true, country: true } },
        },
      },
      invoices: { include: { receipt: true } },
      shipments: true,
    },
  });
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadContract>>>;

function buyerUser(contract: Loaded) {
  return contract.award.winnerCompany.users[0] ?? null;
}

async function assertAccess(
  contract: Loaded,
  role: string,
  companyId: string | null,
  side: "SELLER" | "BUYER" | "ANY"
): Promise<boolean> {
  if (role === "ADMIN") return true;
  const isSeller = companyId === contract.award.lot.sellerCompanyId;
  const isBuyer = companyId === contract.award.winnerCompanyId;
  if (side === "SELLER") return isSeller;
  if (side === "BUYER") return isBuyer;
  return isSeller || isBuyer;
}

export async function cardLimitCents(): Promise<number> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: "card_payment_limit_cents" },
  });
  const parsed = row ? Number(row.value) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_CARD_LIMIT_CENTS;
}

/**
 * The buyer chooses how to pay.
 *
 * Card and PayPal are refused above a configurable ceiling. A 3-4% processing
 * fee on a six-figure lot is a five-figure loss, and the platform should not
 * quietly let that happen just because a radio button was available.
 */
export async function selectPaymentMethodAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const contractId = String(formData.get("contractId") ?? "");
  const method = String(formData.get("method") ?? "");

  const contract = await loadContract(contractId);
  if (!contract) return;
  if (!(await assertAccess(contract, user.role, user.companyId, "BUYER"))) return;

  const invoice = contract.invoices[0];
  if (!invoice || invoice.status === "PAID") return;

  const limit = await cardLimitCents();
  if (
    (method === "CREDIT_CARD" || method === "PAYPAL") &&
    invoice.totalCents > limit
  ) {
    return; // the UI blocks this too; the server is the one that counts
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { paymentMethod: method },
  });
  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "AWAITING_PAYMENT" },
  });

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.company?.name ?? user.name,
    action: "ADMIN_ACTION",
    targetType: "Contract",
    targetId: contractId,
    summary: `${contract.contractNo} の支払方法を ${method} に設定`,
    detail: { method, totalCents: invoice.totalCents, limitCents: limit },
  });

  revalidatePath(`/contracts/${contractId}`);
}

export async function confirmPaymentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const contractId = String(formData.get("contractId") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();

  const contract = await loadContract(contractId);
  if (!contract) return;
  if (!(await assertAccess(contract, user.role, user.companyId, "SELLER"))) return;

  const invoice = contract.invoices[0];
  if (!invoice || invoice.status === "PAID") return;

  const now = new Date();
  const receiptCount = await prisma.receipt.count();
  const isJapanBuyer = contract.award.winnerCompany.countryCode === "JP";

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", paidAt: now },
    }),
    prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        method: invoice.paymentMethod ?? "BANK_TRANSFER",
        amountCents: invoice.totalCents,
        currency: invoice.currency,
        reference: reference || null,
        paidAt: now,
        confirmedById: user.id,
      },
    }),
    prisma.receipt.create({
      data: {
        invoiceId: invoice.id,
        receiptNo: `RCP-${String(receiptCount + 1).padStart(4, "0")}`,
        // Only a Japanese domestic buyer needs a qualified-invoice receipt.
        isQualified: isJapanBuyer,
        issuedAt: now,
      },
    }),
    prisma.contract.update({
      where: { id: contractId },
      data: { status: "IN_CONTRACT" },
    }),
  ]);

  const buyer = buyerUser(contract);
  if (buyer) {
    await notify({
      userId: buyer.id,
      toAddress: buyer.email,
      templateKey: "payment.confirmed",
      locale: buyer.locale as Locale,
      relatedType: "Contract",
      relatedId: contractId,
    });
  }

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.company?.name ?? user.name,
    action: "PAYMENT_CONFIRM",
    targetType: "Contract",
    targetId: contractId,
    summary: `${contract.contractNo} の入金を確認（${invoice.invoiceNo}）`,
    detail: { amountCents: invoice.totalCents, reference: reference || null },
  });

  revalidatePath(`/contracts/${contractId}`);
}

export async function requestShipmentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const contractId = String(formData.get("contractId") ?? "");
  const carrier = String(formData.get("carrier") ?? "").trim();
  const incoterms = String(formData.get("incoterms") ?? "EXW").trim();

  const contract = await loadContract(contractId);
  if (!contract) return;
  if (!(await assertAccess(contract, user.role, user.companyId, "SELLER"))) return;
  if (contract.shipments.length > 0) return;

  const now = new Date();
  await prisma.shipment.create({
    data: {
      contractId,
      carrier: carrier || null,
      incoterms: incoterms || "EXW",
      status: "REQUESTED",
      shipRequestedAt: now,
      pickupRequestedAt: now,
    },
  });
  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "AWAITING_PAYMENT" === contract.status ? contract.status : "IN_CONTRACT" },
  });

  const buyer = buyerUser(contract);
  if (buyer) {
    await notify({
      userId: buyer.id,
      toAddress: buyer.email,
      templateKey: "shipment.requested",
      locale: buyer.locale as Locale,
      relatedType: "Contract",
      relatedId: contractId,
    });
  }

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.company?.name ?? user.name,
    action: "SHIPMENT_UPDATE",
    targetType: "Contract",
    targetId: contractId,
    summary: `${contract.contractNo} の発送・集荷を依頼`,
    detail: { carrier: carrier || null, incoterms },
  });

  revalidatePath(`/contracts/${contractId}`);
}

export async function markShippedAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const contractId = String(formData.get("contractId") ?? "");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const trackingNo = String(formData.get("trackingNo") ?? "").trim();
  const carrier = String(formData.get("carrier") ?? "").trim();

  const contract = await loadContract(contractId);
  if (!contract) return;
  if (!(await assertAccess(contract, user.role, user.companyId, "SELLER"))) return;

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      status: "SHIPPED",
      shippedAt: new Date(),
      trackingNo: trackingNo || null,
      carrier: carrier || undefined,
    },
  });
  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "DELIVERED" },
  });

  const buyer = buyerUser(contract);
  if (buyer) {
    await notify({
      userId: buyer.id,
      toAddress: buyer.email,
      templateKey: "shipment.completed",
      locale: buyer.locale as Locale,
      extra: trackingNo ? `Tracking: ${trackingNo}` : undefined,
      relatedType: "Contract",
      relatedId: contractId,
    });
  }

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.company?.name ?? user.name,
    action: "SHIPMENT_UPDATE",
    targetType: "Contract",
    targetId: contractId,
    summary: `${contract.contractNo} の出荷完了を報告`,
    detail: { trackingNo: trackingNo || null },
  });

  revalidatePath(`/contracts/${contractId}`);
}

export async function confirmReceiptAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const contractId = String(formData.get("contractId") ?? "");
  const shipmentId = String(formData.get("shipmentId") ?? "");

  const contract = await loadContract(contractId);
  if (!contract) return;
  if (!(await assertAccess(contract, user.role, user.companyId, "BUYER"))) return;

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { status: "RECEIVED", receivedAt: new Date() },
  });
  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "COMPLETED" },
  });

  await notify({
    userId: contract.award.lot.createdById,
    toAddress: contract.award.lot.createdBy.email,
    templateKey: "goods.received",
    locale: contract.award.lot.createdBy.locale as Locale,
    relatedType: "Contract",
    relatedId: contractId,
  });

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.company?.name ?? user.name,
    action: "SHIPMENT_UPDATE",
    targetType: "Contract",
    targetId: contractId,
    summary: `${contract.contractNo} の商品受領を確認`,
  });

  revalidatePath(`/contracts/${contractId}`);
}

export async function reportDefectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const contractId = String(formData.get("contractId") ?? "");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const contract = await loadContract(contractId);
  if (!contract) return;
  if (!(await assertAccess(contract, user.role, user.companyId, "BUYER"))) return;

  await prisma.defectReport.create({
    data: {
      shipmentId,
      reportedById: user.id,
      body: body.slice(0, 2000),
      status: "OPEN",
    },
  });

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.company?.name ?? user.name,
    action: "SHIPMENT_UPDATE",
    targetType: "Contract",
    targetId: contractId,
    summary: `${contract.contractNo} に不具合が申告されました`,
    detail: { body: body.slice(0, 200) },
  });

  revalidatePath(`/contracts/${contractId}`);
}
