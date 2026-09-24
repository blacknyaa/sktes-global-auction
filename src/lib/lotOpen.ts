import { Prisma } from "@prisma/client";
import { effectiveEndAt } from "./seal";

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
 *
 * Soft-close extensions are pinned in the same claim: a late bid that moves
 * `extendedUntil` after the opener's snapshot must make the update miss, so
 * the auction stays sealed for the rest of the window.
 *
 * The returned counts describe rows this call actually wrote. A bid withdrawn
 * between the caller's snapshot and this transaction no longer matches
 * `status: SEALED`, so it is left out rather than reported as opened - the
 * audit entry built from these numbers has to match what is in the table.
 */
export async function commitLotOpening(
  tx: Prisma.TransactionClient,
  input: {
    lotId: string;
    openedById: string;
    revelations: BidRevelation[];
    now?: Date;
  }
): Promise<{ opened: number; verified: number; failed: number } | null> {
  const now = input.now ?? new Date();
  const fresh = await tx.lot.findUnique({ where: { id: input.lotId } });
  if (!fresh || fresh.openedAt) return null;
  if (fresh.status !== "OPEN" && fresh.status !== "CLOSED") return null;
  if (effectiveEndAt(fresh) > now) return null;

  const { count } = await tx.lot.updateMany({
    where: {
      id: input.lotId,
      openedAt: null,
      status: { in: ["OPEN", "CLOSED"] },
      endAt: fresh.endAt,
      extendedUntil: fresh.extendedUntil,
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
    const written = await tx.bid.updateMany({
      where: { id: r.bidId, status: "SEALED" },
      data: {
        amountCents: r.amountCents,
        nonce: r.nonce,
        status: "REVEALED",
        revealedAt: now,
      },
    });
    if (written.count === 0) continue;
    if (r.commitmentOk) verified++;
    else failed++;
  }
  return { opened: verified + failed, verified, failed };
}
