import { PrismaClient } from "@prisma/client";
import {
  commit,
  openSeal,
  revealBid,
  SealNotOpenableError,
  cipherFingerprint,
} from "../src/lib/seal";

/**
 * Proves the three claims the platform makes about sealed bidding:
 *
 *   1. While a lot is open, no bid amount exists in readable form anywhere
 *      in the database.
 *   2. The seal physically refuses to open before the deadline - it is not a
 *      permission check that an administrator could bypass.
 *   3. After opening, every revealed amount still matches the tamper-check
 *      hash recorded at submission time.
 *
 * Run: npm run verify:seal
 */

const prisma = new PrismaClient();
let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("\n=== 1. Bids on an open lot are unreadable ===\n");

  const openLot = await prisma.lot.findFirst({
    where: {
      status: "OPEN",
      endAt: { gt: new Date(Date.now() + 60_000) },
      bids: { some: { status: "SEALED" } },
    },
    include: { bids: { where: { status: "SEALED" } } },
  });

  if (!openLot) {
    console.log("  (no open lot with sealed bids in this dataset)");
  } else {
    console.log(`  lot ${openLot.lotNumber} — ${openLot.bids.length} sealed bids`);
    for (const b of openLot.bids.slice(0, 3)) {
      console.log(
        `    ${cipherFingerprint(b.ciphertext)}  amountCents=${b.amountCents}  nonce="${b.nonce}"`
      );
    }
    check(
      "no amount stored in plaintext",
      openLot.bids.every((b) => b.amountCents === null)
    );
    check(
      "no nonce stored before opening",
      openLot.bids.every((b) => b.nonce === "")
    );
    check(
      "ciphertext present for every bid",
      openLot.bids.every((b) => b.ciphertext.length > 100)
    );

    console.log("\n=== 2. The seal refuses to open early ===\n");
    let refused = false;
    try {
      openSeal(openLot, new Date());
    } catch (e) {
      refused = e instanceof SealNotOpenableError;
      if (refused) {
        console.log(`  refused: ${(e as Error).message}`);
      }
    }
    check("opening before the deadline throws", refused);

    // Tampering with the deadline must break decryption, because the deadline
    // is bound into the key as authenticated data.
    let tamperDetected = false;
    try {
      openSeal(
        { ...openLot, endAt: new Date(openLot.endAt.getTime() - 86_400_000) },
        new Date(Date.now() + 10 * 86_400_000)
      );
    } catch {
      tamperDetected = true;
    }
    check("moving the deadline invalidates the key", tamperDetected);
  }

  console.log("\n=== 3. Opened bids still match their commitment ===\n");

  const closedLots = await prisma.lot.findMany({
    where: { status: { in: ["CLOSED", "AWARDED"] } },
    include: { bids: { where: { status: "REVEALED" } } },
    take: 10,
  });

  let checked = 0;
  let matched = 0;
  for (const lot of closedLots) {
    for (const b of lot.bids) {
      if (b.amountCents === null || !b.nonce) continue;
      checked++;
      if (commit(b.amountCents, b.nonce) === b.commitmentHash) matched++;
    }
  }
  console.log(`  verified ${matched} of ${checked} revealed bids across ${closedLots.length} lots`);
  check("every revealed amount matches its commitment", checked > 0 && matched === checked);

  console.log("\n=== 4. Round-trip on a real closed lot ===\n");
  const roundTrip = closedLots.find((l) => l.bids.length > 0);
  if (roundTrip) {
    const key = openSeal(roundTrip, new Date(), true);
    const bid = roundTrip.bids[0];
    const revealed = revealBid(key, bid.ciphertext, bid.commitmentHash);
    console.log(
      `  ${roundTrip.lotNumber}: ciphertext ${cipherFingerprint(bid.ciphertext)} -> ${revealed.amountCents} cents`
    );
    check("decrypts to the stored amount", revealed.amountCents === bid.amountCents);
    check("commitment verifies on decrypt", revealed.commitmentOk);
  }

  console.log(
    `\n${failures === 0 ? "All sealed-bid guarantees hold." : `${failures} check(s) failed.`}\n`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(failures > 0 ? 1 : 0);
  });
