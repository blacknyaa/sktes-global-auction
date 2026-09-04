import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { LotFilters } from "@/components/LotFilters";
import { LotCard, type LotCardData } from "@/components/LotCard";
import { EmptyState } from "@/components/ui";
import {
  buildLotWhere,
  hasSpecFilter,
  lotOrderBy,
  matchedLineCounts,
  parseFilters,
  sweepLotLifecycle,
} from "@/lib/lotQuery";
import { CATEGORY_CODES, CONDITIONS, LOT_STATUSES } from "@/lib/constants";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "出品一覧" };
export const dynamic = "force-dynamic";

export default async function LotsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const dict = await getDictionary();
  const locale = await getLocale();
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const now = new Date();
  await sweepLotLifecycle(now);

  // Bidders never see drafts or another site's unpublished work.
  const base: Prisma.LotWhereInput =
    user.role === "BIDDER"
      ? { status: { in: ["OPEN", "CLOSED", "AWARDED", "FAILED", "SCHEDULED"] } }
      : {};

  const where = await buildLotWhere(filters, base);

  const [lots, total, countries, categoryCounts] = await Promise.all([
    prisma.lot.findMany({
      where,
      orderBy: lotOrderBy(filters),
      take: 60,
      include: {
        country: true,
        sellerCompany: true,
        _count: { select: { bids: true, items: true } },
      },
    }),
    prisma.lot.count({ where }),
    prisma.country.findMany({
      where: { lots: { some: base } },
      orderBy: { code: "asc" },
    }),
    prisma.lot.groupBy({ by: ["categoryCode"], where: base, _count: true }),
  ]);

  const matched = await matchedLineCounts(
    lots.map((l) => l.id),
    filters
  );

  const cards: LotCardData[] = lots.map((l) => ({
    id: l.id,
    lotNumber: l.lotNumber,
    title: l.title,
    titleEn: l.titleEn,
    status: l.status,
    condition: l.condition,
    categoryCode: l.categoryCode,
    quantity: l.quantity,
    minimumBidCents: l.minimumBidCents,
    currency: l.currency,
    endAt: l.endAt,
    extendedUntil: l.extendedUntil,
    extensionEnabled: l.extensionEnabled,
    auctionType: l.auctionType,
    countryCode: l.countryCode,
    countryNameJa: l.country.nameJa,
    countryNameEn: l.country.nameEn,
    sellerName: locale === "ja" ? l.sellerCompany.name : l.sellerCompany.nameEn,
    bidCount: l._count.bids,
    itemCount: l._count.items,
    matchedUnits: matched.get(l.id),
  }));

  return (
    <>
      <PageHeader
        title={dict.nav.lots}
        lead={`${formatNumber(total, locale)} ${dict.search.results}${
          hasSpecFilter(filters) ? ` · ${dict.search.specTitle}` : ""
        }`}
      />

      <LotFilters
        labels={{
          keyword: dict.search.keyword,
          keywordHint: dict.search.keywordHint,
          specTitle: dict.search.specTitle,
          specLead: dict.search.specLead,
          maker: dict.search.maker,
          model: dict.search.model,
          cpu: dict.search.cpu,
          minRam: dict.search.minRam,
          hasGpu: dict.search.hasGpu,
          category: dict.lot.category,
          condition: dict.lot.condition,
          country: dict.common.country,
          status: dict.common.status,
          all: dict.common.all,
          search: dict.common.search,
          clear: dict.search.clear,
          sort: dict.common.filter,
          sortOptions: [
            { value: "endSoon", label: dict.search.sortEndSoon },
            { value: "newest", label: dict.search.sortNewest },
            { value: "quantity", label: dict.search.sortQuantity },
            { value: "bids", label: dict.search.sortBids },
          ],
        }}
        categories={CATEGORY_CODES.map((c) => ({
          value: c,
          label: dict.category[c],
          count: categoryCounts.find((g) => g.categoryCode === c)?._count,
        }))}
        conditions={CONDITIONS.map((c) => ({ value: c, label: dict.condition[c] }))}
        countries={countries.map((c) => ({
          value: c.code,
          label: locale === "ja" ? c.nameJa : c.nameEn,
        }))}
        statuses={LOT_STATUSES.filter(
          (s) => user.role !== "BIDDER" || !["DRAFT", "CANCELLED"].includes(s)
        ).map((s) => ({ value: s, label: dict.lotStatus[s] }))}
        current={sp}
      />

      {cards.length === 0 ? (
        <EmptyState title={dict.search.noResults} body={dict.search.specLead} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((lot) => (
            <LotCard
              key={lot.id}
              lot={lot}
              locale={locale}
              timezone={user.timezone}
              now={now}
              labels={{
                status: dict.lotStatus,
                condition: dict.condition,
                category: dict.category,
                quantity: dict.lot.quantity,
                bidCount: dict.lot.bidCount,
                remaining: dict.lot.remaining,
                minimumBid: dict.lot.minimumBid,
                manifest: dict.lot.manifest,
                matchedLines: dict.search.matchedLines,
                sealed: dict.lot.sealed,
                extended: dict.lot.extended,
              }}
            />
          ))}
        </ul>
      )}
    </>
  );
}
