import { PrismaClient } from "@prisma/client";
import { commitLotOpening } from "../src/lib/lotOpen";
import { createLotSeal, sealBid } from "../src/lib/seal";

/**
 * A second open must not rewrite a successful ceremony as FAILED.
 *
 * The old path revealed bids first, then set openedAt. A concurrent (or
 * retried) call then found zero SEALED rows and wrote status=FAILED over a
 * lot that already had revealed amounts.
 *
 * Run: npm run verify:open-seal
 */

const prisma = new PrismaClient();
let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const stamp = Date.now();
  const lotNumber = `SKT-TS-OPEN-${stamp}`;
  const endAt = new Date(stamp - 60_000);
  const seal = createLotSeal(lotNumber, endAt);

  const seller = await prisma.company.findFirst({
    where: { type: "SELLER" },
    include: { users: { take: 1 } },
  });
  const buyer = await prisma.company.findFirst({
    where: { type: "BUYER", status: { in: ["APPROVED", "PROVISIONAL"] } },
    include: { users: { take: 1 } },
  });
  if (!seller?.users[0] || !buyer?.users[0]) {
    throw new Error("seed data needs a seller and a buyer");
  }

  const lot = await prisma.lot.create({
    data: {
      lotNumber,
      title: "open-seal verify",
      titleEn: "open-seal verify",
      categoryCode: "PC",
      condition: "A",
      sellerCompanyId: seller.id,
      countryCode: seller.countryCode,
      quantity: 1,
      storageLocation: "verify",
      handoverLocation: "verify",
      currency: "USD",
      minimumBidCents: 100,
      auctionType: "SEALED",
      startAt: new Date(stamp - 120_000),
      endAt,
      status: "CLOSED",
      sealPublicKey: seal.sealPublicKey,
      sealedPrivateKey: seal.sealedPrivateKey,
      sealIv: seal.sealIv,
      sealAuthTag: seal.sealAuthTag,
      createdById: seller.users[0].id,
    },
  });

  const sealed = sealBid(seal.sealPublicKey, 12_345, new Date(stamp - 90_000));
  const bid = await prisma.bid.create({
    data: {
      lotId: lot.id,
      bidderCompanyId: buyer.id,
      userId: buyer.users[0].id,
      sequence: 1,
      ciphertext: sealed.ciphertext,
      commitmentHash: sealed.commitmentHash,
      nonce: "",
      status: "SEALED",
    },
  });

  // A bid pulled before the ceremony. The opener's snapshot is taken outside
  // the transaction, so a revelation for a withdrawn bid can still reach
  // commitLotOpening - it must be skipped rather than counted and revealed.
  const withdrawnSealed = sealBid(seal.sealPublicKey, 99_999, new Date(stamp - 90_000));
  const withdrawn = await prisma.bid.create({
    data: {
      lotId: lot.id,
      bidderCompanyId: buyer.id,
      userId: buyer.users[0].id,
      sequence: 2,
      ciphertext: withdrawnSealed.ciphertext,
      commitmentHash: withdrawnSealed.commitmentHash,
      nonce: "",
      status: "WITHDRAWN",
    },
  });

  const revelation = {
    bidId: bid.id,
    amountCents: 12_345,
    nonce: "deadbeef",
    commitmentOk: true,
  };
  const staleRevelation = {
    bidId: withdrawn.id,
    amountCents: 99_999,
    nonce: "stale",
    commitmentOk: true,
  };

  try {
    console.log("\n=== two openers at once ===\n");
    const raced = await Promise.all([
      prisma.$transaction((tx) =>
        commitLotOpening(tx, {
          lotId: lot.id,
          openedById: seller.users[0].id,
          revelations: [revelation, staleRevelation],
        })
      ),
      prisma.$transaction((tx) =>
        commitLotOpening(tx, {
          lotId: lot.id,
          openedById: seller.users[0].id,
          revelations: [revelation, staleRevelation],
        })
      ),
    ]);
    const wins = raced.filter(Boolean);
    check("exactly one opener claims the lot", wins.length === 1, String(wins.length));
    check(
      "the withdrawn bid is not counted as opened",
      wins[0]?.opened === 1 && wins[0]?.verified === 1 && wins[0]?.failed === 0,
      `opened=${wins[0]?.opened} verified=${wins[0]?.verified} failed=${wins[0]?.failed}`
    );

    const after = await prisma.lot.findUnique({ where: { id: lot.id } });
    check("lot status is CLOSED, not FAILED", after?.status === "CLOSED", after?.status);
    check("openedAt is set once", Boolean(after?.openedAt));

    const bids = await prisma.bid.findMany({
      where: { lotId: lot.id },
      orderBy: { sequence: "asc" },
    });
    check(
      "the sealed bid was revealed once",
      bids.length === 2 && bids[0].status === "REVEALED" && bids[0].amountCents === 12_345,
      bids.map((b) => `${b.status}:${b.amountCents}`).join(",")
    );
    check(
      "the withdrawn bid stays withdrawn and sealed",
      bids[1]?.status === "WITHDRAWN" && bids[1]?.amountCents !== 99_999,
      `${bids[1]?.status}:${bids[1]?.amountCents}`
    );

    console.log("\n=== a late retry after bids are already revealed ===\n");
    const retry = await prisma.$transaction((tx) =>
      commitLotOpening(tx, {
        lotId: lot.id,
        openedById: seller.users[0].id,
        revelations: [], // what a second call sees once SEALED rows are gone
      })
    );
    check("empty retry does not claim again", retry === null);

    const final = await prisma.lot.findUnique({ where: { id: lot.id } });
    check(
      "retry leaves CLOSED in place (does not write FAILED)",
      final?.status === "CLOSED",
      final?.status
    );

    console.log("\n=== award status is not overwritten ===\n");
    await prisma.lot.update({
      where: { id: lot.id },
      data: { status: "AWARDED", openedAt: null },
    });
    const afterAward = await prisma.$transaction((tx) =>
      commitLotOpening(tx, {
        lotId: lot.id,
        openedById: seller.users[0].id,
        revelations: [],
      })
    );
    check("claim refuses an AWARDED lot", afterAward === null);
    const awarded = await prisma.lot.findUnique({ where: { id: lot.id } });
    check("AWARDED status stays put", awarded?.status === "AWARDED", awarded?.status);
  } finally {
    await prisma.bid.deleteMany({ where: { lotId: lot.id } });
    await prisma.lot.delete({ where: { id: lot.id } }).catch(() => {});
    await prisma.$disconnect();
  }

  if (failures) {
    console.log(`\n${failures} check(s) failed\n`);
    process.exit(1);
  }
  console.log("\nall open-seal claim checks passed\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
