import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Lot search.
 *
 * The part that matters commercially is the spec filter: because every line of
 * every seller manifest is a row in LotItem, a buyer can ask for "lots that
 * contain 16GB-or-more Core i7 machines" and get an answer. Without it a buyer
 * has to open forty spreadsheets, and in practice they simply do not bid.
 */

export type LotFilters = {
  q?: string;
  category?: string;
  condition?: string;
  country?: string;
  status?: string;
  maker?: string;
  model?: string;
  cpu?: string;
  minRam?: number;
  gpuOnly?: boolean;
  sort?: "endSoon" | "newest" | "quantity" | "bids";
};

export function parseFilters(sp: Record<string, string | undefined>): LotFilters {
  const minRam = sp.minRam ? Number(sp.minRam) : undefined;
  return {
    q: sp.q?.trim() || undefined,
    category: sp.category || undefined,
    condition: sp.condition || undefined,
    country: sp.country || undefined,
    status: sp.status || undefined,
    maker: sp.maker?.trim() || undefined,
    model: sp.model?.trim() || undefined,
    cpu: sp.cpu?.trim() || undefined,
    minRam: Number.isFinite(minRam) && minRam! > 0 ? minRam : undefined,
    gpuOnly: sp.gpuOnly === "1",
    sort: (sp.sort as LotFilters["sort"]) || "endSoon",
  };
}

export function hasSpecFilter(f: LotFilters): boolean {
  return Boolean(f.maker || f.model || f.cpu || f.minRam || f.gpuOnly);
}

export function itemWhere(f: LotFilters): Prisma.LotItemWhereInput {
  const where: Prisma.LotItemWhereInput = {};
  if (f.maker) where.maker = { contains: f.maker };
  if (f.model) where.model = { contains: f.model };
  if (f.cpu) where.cpu = { contains: f.cpu };
  if (f.minRam) where.ramGb = { gte: f.minRam };
  if (f.gpuOnly) where.gpu = { not: null };
  return where;
}

export async function buildLotWhere(
  f: LotFilters,
  base: Prisma.LotWhereInput = {}
): Promise<Prisma.LotWhereInput> {
  const where: Prisma.LotWhereInput = { ...base };

  if (f.q) {
    where.OR = [
      { title: { contains: f.q } },
      { titleEn: { contains: f.q } },
      { lotNumber: { contains: f.q } },
      { description: { contains: f.q } },
    ];
  }
  if (f.category) where.categoryCode = f.category;
  if (f.condition) where.condition = f.condition;
  if (f.country) where.countryCode = f.country;
  if (f.status) where.status = f.status;

  if (hasSpecFilter(f)) {
    where.items = { some: itemWhere(f) };
  }

  return where;
}

export function lotOrderBy(
  f: LotFilters
): Prisma.LotOrderByWithRelationInput | Prisma.LotOrderByWithRelationInput[] {
  switch (f.sort) {
    case "newest":
      return { createdAt: "desc" };
    case "quantity":
      return { quantity: "desc" };
    case "bids":
      return { bids: { _count: "desc" } };
    default:
      return [{ endAt: "asc" }];
  }
}

/** For each lot, how many manifest lines matched the spec filter. */
export async function matchedLineCounts(
  lotIds: string[],
  f: LotFilters
): Promise<Map<string, number>> {
  if (!hasSpecFilter(f) || lotIds.length === 0) return new Map();
  const grouped = await prisma.lotItem.groupBy({
    by: ["lotId"],
    where: { lotId: { in: lotIds }, ...itemWhere(f) },
    _sum: { quantity: true },
  });
  return new Map(grouped.map((g) => [g.lotId, g._sum.quantity ?? 0]));
}

export function filtersToQuery(f: LotFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("category", f.category);
  if (f.condition) p.set("condition", f.condition);
  if (f.country) p.set("country", f.country);
  if (f.status) p.set("status", f.status);
  if (f.maker) p.set("maker", f.maker);
  if (f.model) p.set("model", f.model);
  if (f.cpu) p.set("cpu", f.cpu);
  if (f.minRam) p.set("minRam", String(f.minRam));
  if (f.gpuOnly) p.set("gpuOnly", "1");
  if (f.sort && f.sort !== "endSoon") p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * Lot lifecycle sweep.
 *
 * A scheduled lot whose start time has arrived becomes OPEN; an open lot past
 * its (possibly extended) deadline becomes CLOSED. Bids stay sealed either
 * way - closing bidding and opening the envelopes are deliberately two
 * separate acts, so nobody can see an amount just because a clock ticked.
 *
 * In production this is a timer job. Here it runs on page load, which keeps
 * the demo self-correcting no matter how long it has been left alone.
 */
export async function sweepLotLifecycle(now: Date = new Date()): Promise<void> {
  await prisma.lot.updateMany({
    where: { status: "SCHEDULED", startAt: { lte: now } },
    data: { status: "OPEN" },
  });

  // SQLite cannot compare two columns in a WHERE clause, so the extended
  // deadline is evaluated in application code.
  const open = await prisma.lot.findMany({
    where: { status: "OPEN" },
    select: { id: true, endAt: true, extendedUntil: true },
  });
  const expired = open
    .filter((l) => {
      const end = l.extendedUntil && l.extendedUntil > l.endAt ? l.extendedUntil : l.endAt;
      return end <= now;
    })
    .map((l) => l.id);

  if (expired.length > 0) {
    await prisma.lot.updateMany({
      where: { id: { in: expired } },
      data: { status: "CLOSED" },
    });
  }
}
