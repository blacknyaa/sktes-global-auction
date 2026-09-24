import { Prisma } from "@prisma/client";

export type BidRevelation = {
  bidId: string;
  amountCents: number;
  nonce: string;
  commitmentOk: boolean;
};

/**
 * Claims the opening of a lot and writes every revealed bid.
 *
 * The claim is a single conditional update on `openedAt IS NULL` while the lot
 * is still OPEN or CLOSED (the tick that ends bidding flips OPEN → CLOSED
 * without opening the seal). A second opener — double-click, concurrent admin,
 * or a retry after every SEALED row is already gone — must leave the lot
 * alone. Without that guard, the second call sees zero SEALED rows and
 * rewrites a successful open (or an award) as FAILED.
 */
export async function commitLotOpening(
  tx: Prisma.TransactionClient,
  input: {
    lotId: string;
    openedById: string;
    revelations: BidRevelation[];
    now?: Date;
  }
): Promise<{ verified: number; failed: number } | null> {
  const now = input.now ?? new Date();
  const { count } = await tx.lot.updateMany({
    where: {
      id: input.lotId,
      openedAt: null,
      status: { in: ["OPEN", "CLOSED"] },
    },
    data: {
      status: input.revelations.length > 0 ? "CLOSED" : "FAILED",
      openedAt: now,
      openedById: input.openedById,
    },
  });
  if (count === 0) return null;

  let verified = 0;
  let failed = 0;
  for (const r of input.revelations) {
    if (r.commitmentOk) verified++;
    else failed++;
    await tx.bid.updateMany({
      where: { id: r.bidId, status: "SEALED" },
      data: {
        amountCents: r.amountCents,
        nonce: r.nonce,
        status: "REVEALED",
        revealedAt: now,
      },
    });
  }
  return { verified, failed };
}
