import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { COUNTRIES, SELLER_COUNTRIES } from "./countries";
import {
  BUYER_COMPANIES,
  CATALOG,
  CATEGORIES,
  CONTACT_NAMES,
  type ModelSpec,
} from "./catalog";
import { createLotSeal, sealBid, commit } from "../../src/lib/seal";
import { placeholderPdf } from "./placeholderPdf";

const prisma = new PrismaClient();

export const DEMO_PASSWORD = "Demo!2026";

// Deterministic RNG so that every reseed produces the same demo, which
// matters when you are walking a client through a screen over the phone.
let seedState = 20260904;
function rnd(): number {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const chance = (p: number) => rnd() < p;

const now = new Date();
const hours = (n: number) => n * 3600_000;
const days = (n: number) => n * 86_400_000;
const shift = (ms: number) => new Date(now.getTime() + ms);
const YEARS7 = 7 * 365.25 * 86_400_000;

async function wipe() {
  // Order matters: children first.
  await prisma.$transaction([
    prisma.defectReport.deleteMany(),
    prisma.shipment.deleteMany(),
    prisma.receipt.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.contract.deleteMany(),
    prisma.award.deleteMany(),
    prisma.answer.deleteMany(),
    prisma.question.deleteMany(),
    prisma.bid.deleteMany(),
    prisma.watch.deleteMany(),
    prisma.lotAttachment.deleteMany(),
    prisma.lotItem.deleteMany(),
    prisma.lot.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.accessLog.deleteMany(),
    prisma.fraudSignal.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.session.deleteMany(),
    prisma.companyDocument.deleteMany(),
    prisma.storedBlob.deleteMany(),
    prisma.user.deleteMany(),
    prisma.company.deleteMany(),
    prisma.category.deleteMany(),
    prisma.country.deleteMany(),
    prisma.systemSetting.deleteMany(),
  ]);
}

type AuditInput = {
  actorUserId?: string | null;
  actorLabel: string;
  action: string;
  targetType?: string;
  targetId?: string;
  summary: string;
  detail?: unknown;
  ip?: string;
  createdAt: Date;
};

const auditRows: AuditInput[] = [];
function audit(row: AuditInput) {
  auditRows.push(row);
}

function randomIp(): string {
  return `${int(3, 220)}.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`;
}

export async function runSeed(): Promise<Record<string, number>> {
  // A reseed must be reproducible, so the RNG restarts from the same point.
  seedState = 20260904;
  auditRows.length = 0;
  return main();
}

async function main() {
  console.log("Clearing existing data...");
  await wipe();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  console.log("Seeding master data...");
  for (const c of COUNTRIES) {
    await prisma.country.create({
      data: {
        code: c.code,
        nameJa: c.nameJa,
        nameEn: c.nameEn,
        nameZh: c.nameZh,
        region: c.region,
        timezone: c.timezone,
        currency: c.currency,
        isSellerSite: c.isSellerSite,
        privacyRegime: c.privacyRegime,
      },
    });
  }
  for (const cat of CATEGORIES) await prisma.category.create({ data: cat });

  await prisma.systemSetting.createMany({
    data: [
      { key: "card_payment_limit_cents", value: "1000000" },
      { key: "platform_currency", value: "USD" },
      { key: "audit_retention_years", value: "7" },
      { key: "auction_phase", value: "1" },
      { key: "soft_close_default_minutes", value: "5" },
      { key: "qualified_invoice_number", value: "T8010401012345" },
    ],
  });

  // --- administrators ------------------------------------------------------
  console.log("Seeding administrators...");
  const admin = await prisma.user.create({
    data: {
      email: "admin@sktes-demo.com",
      loginId: "admin",
      passwordHash,
      name: "管理者 太郎",
      phone: "+81-3-1234-5678",
      role: "ADMIN",
      locale: "ja",
      timezone: "Asia/Tokyo",
      mfaEnabled: false,
      lastLoginAt: shift(-hours(2)),
    },
  });
  const admin2 = await prisma.user.create({
    data: {
      email: "admin2@sktes-demo.com",
      loginId: "admin2",
      passwordHash,
      name: "運用 花子",
      phone: "+81-3-1234-5679",
      role: "ADMIN",
      locale: "ja",
      timezone: "Asia/Tokyo",
      lastLoginAt: shift(-days(1)),
    },
  });

  // --- SK TES selling sites ------------------------------------------------
  console.log("Seeding SK TES sites...");
  const sellerCompanies: { id: string; code: string; tz: string; city: string }[] = [];
  const sellerUsers: Record<string, string> = {};

  for (const c of SELLER_COUNTRIES) {
    const company = await prisma.company.create({
      data: {
        type: "SELLER",
        name: `SK TES ${c.nameJa}`,
        nameEn: `SK TES ${c.nameEn}`,
        countryCode: c.code,
        corporateNumber: c.code === "JP" ? "8010401012345" : null,
        contactName: pick(CONTACT_NAMES),
        contactEmail: `site.${c.code.toLowerCase()}@sktes-demo.com`,
        contactPhone: "+00-0000-0000",
        hqAddress: `${c.city}, ${c.nameEn}`,
        exportDestinations: "[]",
        status: "APPROVED",
        termsAcceptedAt: shift(-days(400)),
        appliedAt: shift(-days(400)),
        approvedAt: shift(-days(398)),
      },
    });
    sellerCompanies.push({ id: company.id, code: c.code, tz: c.timezone, city: c.city });

    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `seller.${c.code.toLowerCase()}@sktes-demo.com`,
        loginId: `seller-${c.code.toLowerCase()}`,
        passwordHash,
        name: pick(CONTACT_NAMES),
        role: "SELLER",
        locale: c.code === "JP" ? "ja" : c.code === "CN" || c.code === "TW" ? "zh" : "en",
        timezone: c.timezone,
        lastLoginAt: shift(-hours(int(1, 200))),
      },
    });
    sellerUsers[c.code] = user.id;
  }

  // A stable, memorable seller login for the demo walkthrough.
  const demoSeller = await prisma.user.create({
    data: {
      companyId: sellerCompanies.find((s) => s.code === "JP")!.id,
      email: "seller@sktes-demo.com",
      loginId: "seller",
      passwordHash,
      name: "出品 次郎",
      phone: "+81-43-000-0000",
      role: "SELLER",
      locale: "ja",
      timezone: "Asia/Tokyo",
      lastLoginAt: shift(-hours(5)),
    },
  });
  sellerUsers["JP"] = demoSeller.id;

  // --- document placeholders ----------------------------------------------
  // One openable PDF per document kind, shared by every seeded member.
  const DOC_TITLES: Record<string, string[]> = {
    REGISTRY: [
      "CERTIFICATE OF INCORPORATION",
      "This is a placeholder document generated for the SK TES Global Auction demo.",
      "No real company registry data is contained in this file.",
      "SK TES Global Auction - demonstration environment",
    ],
    ID_DOCUMENT: [
      "IDENTIFICATION DOCUMENT",
      "This is a placeholder document generated for the SK TES Global Auction demo.",
      "No real personal data is contained in this file.",
      "SK TES Global Auction - demonstration environment",
    ],
    ANTIQUE_LICENSE: [
      "SECOND-HAND DEALER LICENCE",
      "This is a placeholder document generated for the SK TES Global Auction demo.",
      "Required of Japanese domestic buyers under the Antique Dealings Act.",
      "SK TES Global Auction - demonstration environment",
    ],
    IMPORT_LICENSE: [
      "IMPORT LICENCE",
      "This is a placeholder document generated for the SK TES Global Auction demo.",
      "No real licence data is contained in this file.",
      "SK TES Global Auction - demonstration environment",
    ],
  };
  const docBlobSizes: Record<string, number> = {};
  for (const [kind, lines] of Object.entries(DOC_TITLES)) {
    const data = placeholderPdf(lines);
    docBlobSizes[kind] = data.byteLength;
    await prisma.storedBlob.create({
      data: {
        storageKey: `demo/documents/${kind}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: data.byteLength,
        data: new Uint8Array(data),
      },
    });
  }

  // --- buyers --------------------------------------------------------------
  console.log("Seeding buyer companies...");
  const buyers: {
    id: string;
    userId: string;
    country: string;
    name: string;
    status: string;
    limit: number | null;
  }[] = [];

  for (let i = 0; i < BUYER_COMPANIES.length; i++) {
    const b = BUYER_COMPANIES[i];
    const country = COUNTRIES.find((c) => c.code === b.country)!;
    const isJapan = b.country === "JP";

    // Status mix: mostly approved, with a realistic tail of applications.
    let status = "APPROVED";
    let bidLimitCents: number | null = null;
    if (i % 17 === 5) status = "PENDING";
    else if (i % 17 === 9) status = "UNDER_REVIEW";
    else if (i % 17 === 12) {
      status = "PROVISIONAL";
      bidLimitCents = 5_000_00;
    } else if (i % 23 === 21) status = "SUSPENDED";

    const appliedAt = shift(-days(int(20, 500)));
    const company = await prisma.company.create({
      data: {
        type: "BUYER",
        name: b.name,
        nameEn: b.nameEn,
        countryCode: b.country,
        corporateNumber: isJapan ? String(int(1000000000000, 9999999999999)) : null,
        contactName: pick(CONTACT_NAMES),
        contactEmail: `contact${i + 1}@buyer-demo.com`,
        contactPhone: `+${int(1, 99)}-${int(100, 999)}-${int(1000, 9999)}`,
        hqAddress: `${country.city}, ${country.nameEn}`,
        branchAddress: chance(0.35) ? `${country.city} Warehouse No.${int(1, 9)}` : null,
        exportDestinations: JSON.stringify(
          Array.from({ length: int(1, 4) }, () => pick(COUNTRIES).code)
        ),
        hasImportLicense: chance(0.72),
        antiqueLicenseNo: isJapan
          ? `第${int(300000000000, 399999999999)}号`
          : null,
        status,
        bidLimitCents,
        termsAcceptedAt: appliedAt,
        appliedAt,
        reviewedAt: status === "PENDING" ? null : shift(-days(int(10, 19))),
        approvedAt:
          status === "APPROVED" || status === "PROVISIONAL"
            ? shift(-days(int(5, 18)))
            : null,
        reviewNote:
          status === "PROVISIONAL"
            ? "輸入ライセンス未提出のため、上限5,000ドルで仮承認。"
            : status === "SUSPENDED"
              ? "支払遅延が2回発生したため一時停止。"
              : null,
        riskScore: status === "SUSPENDED" ? 78 : int(0, 35),
      },
    });

    // documents
    const docKinds = ["REGISTRY", "ID_DOCUMENT"] as string[];
    if (isJapan) docKinds.push("ANTIQUE_LICENSE");
    if (company.hasImportLicense) docKinds.push("IMPORT_LICENSE");
    for (const kind of docKinds) {
      // Every seeded document points at a real, openable file so the reviewer
      // can click through the審査 step. One blob per kind, shared by all
      // companies, keeps the demo database small.
      const storageKey = `demo/documents/${kind}.pdf`;
      await prisma.companyDocument.create({
        data: {
          companyId: company.id,
          kind,
          fileName: `${kind.toLowerCase()}_${b.country}_${i + 1}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: docBlobSizes[kind] ?? 0,
          storageKey,
          status:
            status === "PENDING"
              ? "PENDING"
              : status === "UNDER_REVIEW"
                ? chance(0.5)
                  ? "APPROVED"
                  : "PENDING"
                : "APPROVED",
          reviewedById: status === "PENDING" ? null : admin.id,
          reviewedAt: status === "PENDING" ? null : shift(-days(int(10, 19))),
          uploadedAt: appliedAt,
        },
      });
    }

    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `buyer${i + 1}@buyer-demo.com`,
        loginId: `buyer${i + 1}`,
        passwordHash,
        name: company.contactName,
        phone: company.contactPhone,
        role: "BIDDER",
        locale: isJapan ? "ja" : ["CN", "TW", "HK"].includes(b.country) ? "zh" : "en",
        timezone: country.timezone,
        status: status === "SUSPENDED" ? "DISABLED" : "ACTIVE",
        lastLoginAt: shift(-hours(int(1, 400))),
      },
    });

    buyers.push({
      id: company.id,
      userId: user.id,
      country: b.country,
      name: b.name,
      status,
      limit: bidLimitCents,
    });
  }

  // Memorable bidder login, attached to the first approved buyer.
  const demoBuyer = buyers.find((b) => b.status === "APPROVED")!;
  const demoBidder = await prisma.user.create({
    data: {
      companyId: demoBuyer.id,
      email: "buyer@sktes-demo.com",
      loginId: "buyer",
      passwordHash,
      name: "Alex Tan",
      phone: "+65-6000-0000",
      role: "BIDDER",
      locale: "en",
      timezone: "Asia/Singapore",
      lastLoginAt: shift(-hours(3)),
    },
  });
  demoBuyer.userId = demoBidder.id;

  const activeBuyers = buyers.filter(
    (b) => b.status === "APPROVED" || b.status === "PROVISIONAL"
  );

  // --- lots ----------------------------------------------------------------
  console.log("Seeding lots, manifests and sealed bids...");

  type LotPlan = { status: string; count: number; unopened?: boolean };
  const plan: LotPlan[] = [
    { status: "OPEN", count: 14 },
    { status: "SCHEDULED", count: 4 },
    // Bidding has closed but nobody has opened the envelopes yet. This is the
    // state a seller actually logs in to find, and the only one from which the
    // opening ceremony can be demonstrated, so the demo must always contain a
    // few of them.
    { status: "CLOSED", count: 5, unopened: true },
    { status: "CLOSED", count: 4 },
    { status: "AWARDED", count: 14 },
    { status: "CANCELLED", count: 2 },
    { status: "FAILED", count: 2 },
    { status: "DRAFT", count: 2 },
  ];

  const conditionsByCategory: Record<string, string[]> = {
    PC: ["NEW_OPENED", "USED_WORKING", "USED_JUNK"],
    SERVER: ["USED_WORKING", "USED_JUNK"],
    MOBILE: ["NEW_SEALED", "NEW_OPENED", "USED_WORKING"],
    TABLET: ["NEW_OPENED", "USED_WORKING"],
    PARTS: ["PARTS_TESTED", "PARTS_UNTESTED"],
  };

  let serial = 0;
  const awardedLots: { lotId: string; buyerId: string; amount: number; endAt: Date }[] = [];

  for (const p of plan) {
    for (let n = 0; n < p.count; n++) {
      serial++;
      const site = pick(sellerCompanies);
      const categoryCode = pick(["PC", "PC", "PC", "SERVER", "MOBILE", "TABLET", "PARTS"]);
      const condition = pick(conditionsByCategory[categoryCode]);
      const models = CATALOG[categoryCode];

      // Build the manifest first; the lot value follows from its contents.
      const lineCount = int(4, 12);
      const lines: { spec: ModelSpec; qty: number; grade: string }[] = [];
      let quantity = 0;
      let valueUsd = 0;
      for (let l = 0; l < lineCount; l++) {
        const spec = pick(models);
        const qty = categoryCode === "PARTS" ? int(20, 120) : int(8, 60);
        const grade = pick(["A", "A", "B", "B", "B", "C"]);
        const gradeFactor = grade === "A" ? 1 : grade === "B" ? 0.86 : 0.62;
        const unit =
          (spec.unitLowUsd + rnd() * (spec.unitHighUsd - spec.unitLowUsd)) *
          gradeFactor *
          (condition === "USED_JUNK" || condition === "PARTS_UNTESTED" ? 0.42 : 1);
        lines.push({ spec, qty, grade });
        quantity += qty;
        valueUsd += unit * qty;
      }
      const valueCents = Math.round(valueUsd * 100);

      // Timing per status
      let startAt: Date;
      let endAt: Date;
      if (p.status === "OPEN") {
        startAt = shift(-days(int(1, 6)));
        // one lot deliberately closes within the hour so the countdown and
        // the soft-close extension can be demonstrated live
        endAt = n === 0 ? shift(hours(0.15)) : shift(days(int(1, 12)) + hours(int(0, 20)));
      } else if (p.status === "SCHEDULED") {
        startAt = shift(days(int(1, 5)));
        endAt = new Date(startAt.getTime() + days(int(5, 12)));
      } else if (p.status === "DRAFT") {
        startAt = shift(days(int(2, 8)));
        endAt = new Date(startAt.getTime() + days(7));
      } else {
        endAt = shift(-days(int(1, 40)));
        startAt = new Date(endAt.getTime() - days(int(6, 14)));
      }

      const country = COUNTRIES.find((c) => c.code === site.code)!;
      const lotNumber = `SKT-${site.code}-${String(now.getFullYear()).slice(2)}${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${String(serial).padStart(4, "0")}`;

      const seal = createLotSeal(lotNumber, endAt);
      const catName = CATEGORIES.find((c) => c.code === categoryCode)!;
      const isPhase2 = p.status === "OPEN" && n === 1; // one open-auction lot

      const lot = await prisma.lot.create({
        data: {
          lotNumber,
          title: `${country.nameJa}拠点 ${catName.nameJa} ロット ${quantity}台`,
          titleEn: `${country.nameEn} site - ${catName.nameEn} lot, ${quantity} units`,
          description: `${country.city}倉庫に保管中の${catName.nameJa}です。明細は添付のロット一覧をご確認ください。引き渡しは倉庫渡し（EXW）を基本とします。`,
          categoryCode,
          condition,
          sellerCompanyId: site.id,
          countryCode: site.code,
          quantity,
          storageLocation: `${country.city} DC-${int(1, 4)}`,
          handoverLocation: `${country.city} ${country.nameEn} (EXW)`,
          currency: "USD",
          reserveCents: Math.round(valueCents * 0.62),
          minimumBidCents: Math.round(valueCents * 0.5),
          auctionType: isPhase2 ? "OPEN" : "SEALED",
          startAt,
          endAt,
          extensionEnabled: isPhase2 || chance(0.3),
          extensionTriggerMin: 5,
          extensionMinutes: 5,
          status: p.status,
          publishedAt: p.status === "DRAFT" ? null : startAt,
          cancelledAt: p.status === "CANCELLED" ? shift(-days(int(2, 20))) : null,
          cancelReason:
            p.status === "CANCELLED"
              ? "拠点側で在庫の再検品が必要となったため取り下げ。"
              : null,
          sealPublicKey: seal.sealPublicKey,
          sealedPrivateKey: seal.sealedPrivateKey,
          sealIv: seal.sealIv,
          sealAuthTag: seal.sealAuthTag,
          openedAt:
            ["CLOSED", "AWARDED", "FAILED"].includes(p.status) && !p.unopened
              ? endAt
              : null,
          openedById:
            ["CLOSED", "AWARDED", "FAILED"].includes(p.status) && !p.unopened
              ? admin.id
              : null,
          createdById: sellerUsers[site.code] ?? demoSeller.id,
          createdAt: new Date(startAt.getTime() - days(2)),
        },
      });

      let lineNo = 0;
      for (const line of lines) {
        lineNo++;
        await prisma.lotItem.create({
          data: {
            lotId: lot.id,
            lineNo,
            maker: line.spec.maker,
            model: line.spec.model,
            cpu: line.spec.cpu ?? null,
            ramGb: line.spec.ramGb ?? null,
            storage: line.spec.storage ?? null,
            gpu: line.spec.gpu ?? null,
            screen: line.spec.screen ?? null,
            grade: line.grade,
            quantity: line.qty,
            note: line.grade === "C" ? "外装傷あり" : null,
          },
        });
      }

      await prisma.lotAttachment.create({
        data: {
          lotId: lot.id,
          kind: "EXCEL",
          fileName: `${lotNumber}_manifest.xlsx`,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sizeBytes: int(24_000, 180_000),
          storageKey: `demo/manifests/${lot.id}.xlsx`,
        },
      });

      audit({
        actorUserId: sellerUsers[site.code] ?? demoSeller.id,
        actorLabel: `SK TES ${country.nameJa}`,
        action: "LOT_CREATE",
        targetType: "Lot",
        targetId: lot.id,
        summary: `${lotNumber} を登録（${quantity}台）`,
        detail: { quantity, categoryCode, condition },
        ip: randomIp(),
        createdAt: new Date(startAt.getTime() - days(2)),
      });

      if (p.status === "DRAFT" || p.status === "CANCELLED" || p.status === "SCHEDULED") {
        continue;
      }

      // --- bids ---
      const bidderCount = p.status === "FAILED" ? int(0, 1) : int(3, 9);
      const chosen = new Set<string>();
      // Bids stay sealed on a lot whose envelopes have not been opened, even
      // though bidding itself has closed.
      const revealed =
        ["CLOSED", "AWARDED", "FAILED"].includes(p.status) && !p.unopened;
      const bidRecords: { id: string; buyerId: string; amount: number }[] = [];

      for (let b = 0; b < bidderCount; b++) {
        const buyer = pick(activeBuyers);
        if (chosen.has(buyer.id)) continue;
        chosen.add(buyer.id);

        let amountCents = Math.round(valueCents * (0.55 + rnd() * 0.5));
        if (buyer.limit && amountCents > buyer.limit) amountCents = buyer.limit;
        const submittedAt = new Date(
          startAt.getTime() + rnd() * (Math.min(endAt.getTime(), now.getTime()) - startAt.getTime())
        );
        const sealed = sealBid(seal.sealPublicKey, amountCents, submittedAt);

        const bid = await prisma.bid.create({
          data: {
            lotId: lot.id,
            bidderCompanyId: buyer.id,
            userId: buyer.userId,
            sequence: 1,
            ciphertext: sealed.ciphertext,
            commitmentHash: sealed.commitmentHash,
            nonce: revealed ? sealed.nonce : "",
            amountCents: revealed ? amountCents : null,
            status: revealed ? "REVEALED" : "SEALED",
            submittedAt,
            revealedAt: revealed ? endAt : null,
            ip: randomIp(),
          },
        });
        bidRecords.push({ id: bid.id, buyerId: buyer.id, amount: amountCents });

        audit({
          actorUserId: buyer.userId,
          actorLabel: buyer.name,
          action: "BID_SUBMIT",
          targetType: "Lot",
          targetId: lot.id,
          summary: `${lotNumber} へ封印入札を送信（金額は暗号化して保管）`,
          detail: { commitmentHash: sealed.commitmentHash },
          ip: randomIp(),
          createdAt: submittedAt,
        });
      }

      // The demo bidder should always have something to look at.
      if (p.status === "OPEN" && n < 6) {
        const amountCents = Math.round(valueCents * (0.72 + rnd() * 0.2));
        const submittedAt = shift(-hours(int(2, 60)));
        const sealed = sealBid(seal.sealPublicKey, amountCents, submittedAt);
        await prisma.bid.create({
          data: {
            lotId: lot.id,
            bidderCompanyId: demoBuyer.id,
            userId: demoBidder.id,
            sequence: 1,
            ciphertext: sealed.ciphertext,
            commitmentHash: sealed.commitmentHash,
            nonce: "",
            status: "SEALED",
            submittedAt,
            ip: "203.0.113.24",
          },
        });
        await prisma.watch.create({
          data: { userId: demoBidder.id, lotId: lot.id },
        });
      }

      // --- questions ---
      if (chance(0.45) && p.status !== "FAILED") {
        const asker = pick(activeBuyers);
        const q = await prisma.question.create({
          data: {
            lotId: lot.id,
            askerCompanyId: asker.id,
            userId: asker.userId,
            body: pick([
              "Could you confirm whether the batteries are included for all units?",
              "バッテリーの充電回数（サイクル数）の平均値はわかりますか。",
              "Is partial pickup possible, or is it all-or-nothing for the lot?",
              "ACアダプターは付属しますか。数量もあわせて教えてください。",
              "Are the units data-wiped and is a wipe certificate provided?",
            ]),
            isPublic: true,
            createdAt: shift(-days(int(1, 8))),
          },
        });
        if (chance(0.75)) {
          await prisma.answer.create({
            data: {
              questionId: q.id,
              userId: sellerUsers[site.code] ?? demoSeller.id,
              body: pick([
                "全数データ消去済みで、消去証明書（NIST 800-88 Purge）をお渡しできます。",
                "ACアダプターは約7割の個体に付属します。明細のnote欄をご確認ください。",
                "ロット単位でのお引き渡しとなります。分割はお受けできません。",
                "Battery health is not individually measured. Please treat it as untested.",
              ]),
              createdAt: shift(-days(int(0, 6))),
            },
          });
        }
      }

      // --- award, contract, invoice, shipment ---
      if (p.status === "AWARDED" && bidRecords.length > 0) {
        const sorted = [...bidRecords].sort((a, b) => b.amount - a.amount);
        // The brief allows the seller to pick any bidder, so about a quarter
        // of the time we pick the runner-up and record why.
        const takeRunnerUp = chance(0.25) && sorted.length > 1;
        const winner = takeRunnerUp ? sorted[1] : sorted[0];
        const rank = takeRunnerUp ? 2 : 1;

        const award = await prisma.award.create({
          data: {
            lotId: lot.id,
            bidId: winner.id,
            winnerCompanyId: winner.buyerId,
            amountCents: winner.amount,
            rankAmongBids: rank,
            isHighestBid: rank === 1,
            reason: takeRunnerUp
              ? pick([
                  "最高額の応札者は輸入ライセンス未提出のため、次点を選定。",
                  "最高額の応札者は前回取引で入金遅延があったため、次点を選定。",
                  "輸出先国の規制により最高額応札者への引き渡しが不可のため、次点を選定。",
                ])
              : "最高額応札のため選定。",
            selectedById: sellerUsers[site.code] ?? demoSeller.id,
            selectedAt: new Date(endAt.getTime() + hours(int(2, 40))),
          },
        });
        await prisma.lot.update({
          where: { id: lot.id },
          data: { status: "AWARDED" },
        });

        const winnerCompany = buyers.find((b) => b.id === winner.buyerId)!;
        const isJapanBuyer = winnerCompany.country === "JP";
        const contractStatus = pick([
          "IN_CONTRACT",
          "AWAITING_PAYMENT",
          "DELIVERED",
          "COMPLETED",
          "COMPLETED",
        ]);

        const contract = await prisma.contract.create({
          data: {
            awardId: award.id,
            contractNo: `CT-${String(now.getFullYear()).slice(2)}${String(
              now.getMonth() + 1
            ).padStart(2, "0")}-${String(serial).padStart(4, "0")}`,
            status: contractStatus,
            amountCents: winner.amount,
            currency: "USD",
            fxRate: isJapanBuyer ? 147.2 : null,
            fxCurrency: isJapanBuyer ? "JPY" : null,
            fxCapturedAt: isJapanBuyer ? award.selectedAt : null,
            createdAt: award.selectedAt,
          },
        });

        const subtotal = winner.amount;
        const tax = isJapanBuyer ? Math.round(subtotal * 0.1) : 0;
        const invoice = await prisma.invoice.create({
          data: {
            contractId: contract.id,
            invoiceNo: `INV-${String(now.getFullYear()).slice(2)}${String(
              now.getMonth() + 1
            ).padStart(2, "0")}-${String(serial).padStart(4, "0")}`,
            taxTreatment: isJapanBuyer ? "DOMESTIC_JP_10" : "EXPORT_EXEMPT",
            subtotalCents: subtotal,
            taxCents: tax,
            totalCents: subtotal + tax,
            currency: "USD",
            qualifiedInvoiceNo: isJapanBuyer ? "T8010401012345" : null,
            paymentMethod:
              subtotal > 1_000_000
                ? pick(["BANK_TRANSFER", "INVOICE_TERMS"])
                : pick(["BANK_TRANSFER", "CREDIT_CARD", "PAYPAL", "INVOICE_TERMS"]),
            status: ["DELIVERED", "COMPLETED", "AWAITING_PAYMENT"].includes(contractStatus)
              ? contractStatus === "AWAITING_PAYMENT"
                ? "ISSUED"
                : "PAID"
              : "ISSUED",
            issuedAt: new Date(award.selectedAt.getTime() + hours(6)),
            dueAt: new Date(award.selectedAt.getTime() + days(7)),
            paidAt: ["DELIVERED", "COMPLETED"].includes(contractStatus)
              ? new Date(award.selectedAt.getTime() + days(int(2, 6)))
              : null,
          },
        });

        if (invoice.paidAt) {
          await prisma.payment.create({
            data: {
              invoiceId: invoice.id,
              method: invoice.paymentMethod ?? "BANK_TRANSFER",
              amountCents: invoice.totalCents,
              currency: "USD",
              reference: `REF${int(100000, 999999)}`,
              paidAt: invoice.paidAt,
              confirmedById: admin.id,
            },
          });
          await prisma.receipt.create({
            data: {
              invoiceId: invoice.id,
              receiptNo: `RCP-${String(serial).padStart(4, "0")}`,
              isQualified: isJapanBuyer,
              issuedAt: new Date(invoice.paidAt.getTime() + hours(2)),
            },
          });
        }

        if (["DELIVERED", "COMPLETED"].includes(contractStatus)) {
          const shipment = await prisma.shipment.create({
            data: {
              contractId: contract.id,
              carrier: pick(["DHL", "FedEx", "Kuehne+Nagel", "Nippon Express", "Yusen Logistics"]),
              trackingNo: `TRK${int(10000000, 99999999)}`,
              incoterms: pick(["EXW", "FOB", "CIF"]),
              status: contractStatus === "COMPLETED" ? "RECEIVED" : "SHIPPED",
              shipRequestedAt: new Date(invoice.paidAt!.getTime() + hours(12)),
              pickupRequestedAt: new Date(invoice.paidAt!.getTime() + days(1)),
              shippedAt: new Date(invoice.paidAt!.getTime() + days(2)),
              receivedAt:
                contractStatus === "COMPLETED"
                  ? new Date(invoice.paidAt!.getTime() + days(int(6, 18)))
                  : null,
            },
          });
          if (chance(0.15)) {
            await prisma.defectReport.create({
              data: {
                shipmentId: shipment.id,
                reportedById: winnerCompany.userId,
                body: "検品の結果、明細と3台の型番相違を確認しました。差額のご相談をお願いします。",
                status: chance(0.5) ? "RESOLVED" : "OPEN",
                createdAt: new Date(shipment.shippedAt!.getTime() + days(4)),
                resolvedAt: null,
              },
            });
          }
        }

        awardedLots.push({
          lotId: lot.id,
          buyerId: winner.buyerId,
          amount: winner.amount,
          endAt,
        });

        audit({
          actorUserId: sellerUsers[site.code] ?? demoSeller.id,
          actorLabel: `SK TES ${country.nameJa}`,
          action: "AWARD_CONFIRM",
          targetType: "Lot",
          targetId: lot.id,
          summary: `${lotNumber} の落札者を確定（順位 ${rank} 位／理由記録あり）`,
          detail: { rank, isHighestBid: rank === 1, amountCents: winner.amount },
          ip: randomIp(),
          createdAt: award.selectedAt,
        });
      }
    }
  }

  // --- notifications -------------------------------------------------------
  console.log("Seeding notifications...");
  const notifTemplates = [
    { key: "member.applied", subject: "【SK TES Auction】会員登録を受け付けました" },
    { key: "bid.received", subject: "【SK TES Auction】入札を受け付けました" },
    { key: "award.won", subject: "【SK TES Auction】落札のお知らせ" },
    { key: "award.lost", subject: "【SK TES Auction】選定結果のお知らせ" },
    { key: "payment.confirmed", subject: "【SK TES Auction】ご入金を確認しました" },
    { key: "shipment.completed", subject: "【SK TES Auction】商品を出荷しました" },
  ];
  for (let i = 0; i < 90; i++) {
    const tpl = pick(notifTemplates);
    const target = pick([...activeBuyers.map((b) => b.userId), demoBidder.id]);
    await prisma.notification.create({
      data: {
        userId: target,
        channel: "EMAIL",
        templateKey: tpl.key,
        toAddress: "notify@buyer-demo.com",
        subject: tpl.subject,
        body: "本メールはデモ環境から送信された通知のサンプルです。",
        status: chance(0.95) ? "SENT" : "QUEUED",
        createdAt: shift(-hours(int(1, 900))),
        sentAt: shift(-hours(int(1, 900))),
      },
    });
  }

  // --- access logs and fraud signals ---------------------------------------
  console.log("Seeding access logs and fraud signals...");
  const paths = ["/lots", "/lots/detail", "/bids", "/login", "/dashboard", "/api/lots"];
  for (let i = 0; i < 400; i++) {
    const u = pick([...activeBuyers.map((b) => b.userId), demoBidder.id, admin.id]);
    await prisma.accessLog.create({
      data: {
        userId: u,
        ip: randomIp(),
        country: pick(COUNTRIES).code,
        method: chance(0.85) ? "GET" : "POST",
        path: pick(paths),
        statusCode: chance(0.94) ? 200 : pick([302, 401, 403, 404, 500]),
        userAgent: "Mozilla/5.0 (demo-traffic)",
        createdAt: shift(-hours(int(1, 720))),
      },
    });
  }

  const s1 = activeBuyers[3];
  const s2 = activeBuyers[11];
  await prisma.fraudSignal.createMany({
    data: [
      {
        kind: "MULTI_ACCOUNT",
        severity: "HIGH",
        companyId: s1.id,
        summary: `${s1.name} と別会員が同一IP・同一銀行口座を共有しています`,
        detail: JSON.stringify({
          sharedIp: "198.51.100.77",
          sharedBankAccount: "****4412",
          matchedCompanies: 2,
        }),
        status: "OPEN",
        createdAt: shift(-days(2)),
      },
      {
        kind: "ABNORMAL_BID",
        severity: "MEDIUM",
        companyId: s2.id,
        summary: `${s2.name} の入札額が同ロット中央値の 4.8 倍です`,
        detail: JSON.stringify({ medianMultiple: 4.8, lotsAffected: 1 }),
        status: "REVIEWING",
        createdAt: shift(-days(5)),
      },
      {
        kind: "ACCESS_ANOMALY",
        severity: "MEDIUM",
        summary: "同一IPから 42 件のログイン失敗（12分間）",
        detail: JSON.stringify({ ip: "203.0.113.199", attempts: 42, windowMinutes: 12 }),
        status: "CONFIRMED",
        createdAt: shift(-days(9)),
      },
      {
        kind: "MULTI_ACCOUNT",
        severity: "LOW",
        summary: "法人番号の下4桁が一致する会員が2社あります",
        detail: JSON.stringify({ matchedDigits: 4, matchedCompanies: 2 }),
        status: "DISMISSED",
        createdAt: shift(-days(21)),
      },
    ],
  });

  // --- audit log -----------------------------------------------------------
  console.log(`Writing ${auditRows.length + 40} audit entries...`);
  for (const u of [admin, admin2, demoSeller, demoBidder]) {
    for (let i = 0; i < 10; i++) {
      audit({
        actorUserId: u.id,
        actorLabel: u.name,
        action: "LOGIN",
        summary: `${u.email} がログインしました`,
        ip: randomIp(),
        createdAt: shift(-hours(int(1, 700))),
      });
    }
  }
  for (const row of auditRows) {
    await prisma.auditLog.create({
      data: {
        actorUserId: row.actorUserId ?? null,
        actorLabel: row.actorLabel,
        action: row.action,
        targetType: row.targetType ?? null,
        targetId: row.targetId ?? null,
        summary: row.summary,
        detail: row.detail ? JSON.stringify(row.detail) : null,
        ip: row.ip ?? null,
        userAgent: "Mozilla/5.0 (demo)",
        createdAt: row.createdAt,
        retentionUntil: new Date(row.createdAt.getTime() + YEARS7),
      },
    });
  }

  const counts = {
    countries: await prisma.country.count(),
    companies: await prisma.company.count(),
    users: await prisma.user.count(),
    lots: await prisma.lot.count(),
    lotItems: await prisma.lotItem.count(),
    bids: await prisma.bid.count(),
    awards: await prisma.award.count(),
    invoices: await prisma.invoice.count(),
    auditLogs: await prisma.auditLog.count(),
    accessLogs: await prisma.accessLog.count(),
  };
  console.log("\nSeed complete:");
  console.table(counts);
  console.log(`\nDemo password for every account: ${DEMO_PASSWORD}`);
  console.log("  admin    (administrator)");
  console.log("  seller   (SK TES Japan)");
  console.log("  buyer    (overseas buyer)\n");
  void commit; // keep the helper imported for downstream stages
  return counts;
}

// Only run automatically when invoked as a script, so the app can import
// runSeed() to offer a "reset the demo" button.
const invokedDirectly = process.argv[1]?.replace(/\\/g, "/").includes("prisma/seed");
if (invokedDirectly) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
