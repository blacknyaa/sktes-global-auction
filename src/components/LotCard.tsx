import Link from "next/link";
import Image from "next/image";
import { Badge, LOT_STATUS_TONE } from "./ui";
import { Countdown } from "./Countdown";
import { countryFlag, formatMoney, formatNumber } from "@/lib/format";
import { countdown, formatDateTime, zoneLabel } from "@/lib/datetime";
import { categoryArt } from "./visual/art";
import { CornerMarks, Fuda } from "./visual/Ornaments";
import type { Locale } from "@/lib/constants";

export type LotCardData = {
  id: string;
  lotNumber: string;
  title: string;
  titleEn: string;
  status: string;
  condition: string;
  categoryCode: string;
  quantity: number;
  minimumBidCents: number;
  currency: string;
  endAt: Date;
  extendedUntil: Date | null;
  extensionEnabled: boolean;
  auctionType: string;
  countryCode: string;
  countryNameJa: string;
  countryNameEn: string;
  sellerName: string;
  bidCount: number;
  itemCount: number;
  matchedUnits?: number;
};

export function LotCard({
  lot,
  locale,
  timezone,
  labels,
  now,
}: {
  lot: LotCardData;
  locale: Locale;
  timezone: string;
  now: Date;
  labels: {
    status: Record<string, string>;
    condition: Record<string, string>;
    category: Record<string, string>;
    quantity: string;
    bidCount: string;
    remaining: string;
    minimumBid: string;
    manifest: string;
    matchedLines: string;
    sealed: string;
    extended: string;
  };
}) {
  const effectiveEnd =
    lot.extendedUntil && lot.extendedUntil > lot.endAt ? lot.extendedUntil : lot.endAt;
  const c = countdown(effectiveEnd, now);
  const p = (n: number) => String(n).padStart(2, "0");
  const initial =
    c.days > 0
      ? `${c.days}d ${p(c.hours)}:${p(c.minutes)}:${p(c.seconds)}`
      : `${p(c.hours)}:${p(c.minutes)}:${p(c.seconds)}`;

  return (
    <li className="card card-hover tilt group flex flex-col overflow-hidden">
      <Link href={`/lots/${lot.id}`} className="flex flex-1 flex-col">
        <div className="relative h-64 overflow-hidden sm:h-72">
          <CornerMarks />
          <Image
            src={categoryArt(lot.categoryCode)}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
          <Fuda className="absolute bottom-3 left-3 z-10">
            {labels.category[lot.categoryCode] ?? lot.categoryCode}
          </Fuda>
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <span className="font-mono text-[11px] text-brand-700">{lot.lotNumber}</span>
          <Badge tone={LOT_STATUS_TONE[lot.status] ?? "neutral"} dot>
            {labels.status[lot.status] ?? lot.status}
          </Badge>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="text-[15px] font-bold leading-snug text-ink transition-colors group-hover:text-brand">
            {locale === "ja" ? lot.title : lot.titleEn}
          </h3>

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span>
              {countryFlag(lot.countryCode)}{" "}
              {locale === "ja" ? lot.countryNameJa : lot.countryNameEn}
            </span>
            <span aria-hidden="true">·</span>
            <span>{labels.category[lot.categoryCode] ?? lot.categoryCode}</span>
            <span aria-hidden="true">·</span>
            <span>{labels.condition[lot.condition] ?? lot.condition}</span>
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {labels.quantity}
              </p>
              <p className="tnum mt-0.5 text-sm font-bold text-ink">
                {formatNumber(lot.quantity, locale)}
              </p>
            </div>
            <div className="border-x border-line">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {labels.manifest}
              </p>
              <p className="tnum mt-0.5 text-sm font-bold text-ink">{lot.itemCount}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {labels.bidCount}
              </p>
              <p className="tnum mt-0.5 text-sm font-bold text-ink">{lot.bidCount}</p>
            </div>
          </div>

          {lot.matchedUnits !== undefined && (
            <p className="mt-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-800">
              {labels.matchedLines}: {formatNumber(lot.matchedUnits, locale)}
            </p>
          )}

          <div className="mt-auto pt-4">
            <p className="text-xs text-muted">
              {labels.minimumBid}{" "}
              <span className="tnum font-semibold text-ink-2">
                {formatMoney(lot.minimumBidCents, lot.currency, locale)}
              </span>
            </p>
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-2 px-5 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            {labels.remaining}
          </p>
          <p className="truncate text-[11px] text-muted">
            {formatDateTime(effectiveEnd, timezone, locale)}{" "}
            {zoneLabel(effectiveEnd, timezone)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Countdown
            endAt={effectiveEnd.toISOString()}
            initial={initial}
            className="text-sm"
          />
          <p className="flex justify-end gap-1">
            {lot.auctionType === "SEALED" ? (
              <span className="badge bg-seal-bg px-1.5 py-0 text-[10px] text-seal">
                {labels.sealed}
              </span>
            ) : (
              <span className="badge bg-info-bg px-1.5 py-0 text-[10px] text-info">
                AUCTION
              </span>
            )}
            {lot.extendedUntil && (
              <span className="badge bg-warn-bg px-1.5 py-0 text-[10px] text-warn">
                {labels.extended}
              </span>
            )}
          </p>
        </div>
      </div>
    </li>
  );
}
