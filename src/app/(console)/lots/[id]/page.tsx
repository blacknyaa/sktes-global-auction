import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { canBid, requireUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Badge, Card, LOT_STATUS_TONE } from "@/components/ui";
import { Countdown } from "@/components/Countdown";
import { ManifestTable } from "./ManifestTable";
import { BidPanel } from "./BidPanel";
import { answerQuestionAction, askQuestionAction, openSealAction } from "./actions";
import { awardLotAction } from "./awardActions";
import { cipherFingerprint, commit, effectiveEndAt } from "@/lib/seal";
import { sweepLotLifecycle } from "@/lib/lotQuery";
import { countryFlag, formatMoney, formatNumber } from "@/lib/format";
import { countdown, formatDateTime, zoneLabel } from "@/lib/datetime";

export const metadata: Metadata = { title: "出品詳細" };
export const dynamic = "force-dynamic";

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const dict = await getDictionary();
  const locale = await getLocale();
  const now = new Date();
  await sweepLotLifecycle(now);

  const lot = await prisma.lot.findUnique({
    where: { id },
    include: {
      country: true,
      category: true,
      sellerCompany: { include: { country: true } },
      items: { orderBy: { lineNo: "asc" } },
      attachments: true,
      createdBy: true,
      award: {
        include: {
          winnerCompany: true,
          selectedBy: true,
          contract: { include: { invoices: true } },
        },
      },
      questions: {
        orderBy: { createdAt: "desc" },
        include: { askerCompany: true, answer: { include: { user: true } } },
      },
      bids: {
        where: { status: { in: ["SEALED", "REVEALED"] } },
        orderBy: [{ amountCents: "desc" }, { submittedAt: "asc" }],
        include: { bidderCompany: { include: { country: true } } },
      },
    },
  });
  if (!lot) notFound();

  const isOwner = user.companyId === lot.sellerCompanyId;
  const isSellerSide = user.role === "ADMIN" || (user.role === "SELLER" && isOwner);
  const closeAt = effectiveEndAt(lot);
  const isClosed = now >= closeAt;
  const opened = Boolean(lot.openedAt);

  const myBid =
    user.role === "BIDDER" && user.companyId
      ? lot.bids.find(
          (b) => b.bidderCompanyId === user.companyId && b.status === "SEALED"
        )
      : undefined;

  const c = countdown(closeAt, now);
  const p = (n: number) => String(n).padStart(2, "0");
  const initial =
    c.days > 0
      ? `${c.days}d ${p(c.hours)}:${p(c.minutes)}:${p(c.seconds)}`
      : `${p(c.hours)}:${p(c.minutes)}:${p(c.seconds)}`;

  const facts = [
    { label: dict.lot.seller, value: locale === "ja" ? lot.sellerCompany.name : lot.sellerCompany.nameEn },
    {
      label: dict.common.country,
      value: `${countryFlag(lot.countryCode)} ${locale === "ja" ? lot.country.nameJa : lot.country.nameEn}`,
    },
    { label: dict.lot.category, value: dict.category[lot.categoryCode as keyof typeof dict.category] },
    { label: dict.lot.condition, value: dict.condition[lot.condition as keyof typeof dict.condition] },
    { label: dict.lot.quantity, value: `${formatNumber(lot.quantity, locale)} units` },
    { label: dict.lot.storage, value: lot.storageLocation },
    { label: dict.lot.handover, value: lot.handoverLocation },
    { label: dict.lot.minimumBid, value: formatMoney(lot.minimumBidCents, lot.currency, locale) },
  ];

  const revealedBids = lot.bids.filter((b) => b.status === "REVEALED");
  const sealedBids = lot.bids.filter((b) => b.status === "SEALED");

  return (
    <>
      <PageHeader
        title={locale === "ja" ? lot.title : lot.titleEn}
        lead={lot.lotNumber}
        actions={
          <>
            <a
              href={`/api/lots/${lot.id}/manifest`}
              className="btn btn-ghost"
              download
            >
              {dict.listing.downloadManifest}
            </a>
            <Link href="/lots" className="btn btn-ghost">
              {dict.common.back}
            </Link>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={LOT_STATUS_TONE[lot.status] ?? "neutral"} dot>
          {dict.lotStatus[lot.status as keyof typeof dict.lotStatus]}
        </Badge>
        <Badge tone={lot.auctionType === "SEALED" ? "seal" : "info"}>
          {lot.auctionType === "SEALED" ? dict.listing.sealed : dict.listing.openAuction}
        </Badge>
        {lot.extensionEnabled && (
          <Badge tone="warn">
            {dict.bid.softClose} {lot.extensionTriggerMin}/{lot.extensionMinutes}min
          </Badge>
        )}
        {lot.extensionCount > 0 && (
          <Badge tone="warn" dot>
            {dict.lot.extended} ×{lot.extensionCount}
          </Badge>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {/* facts */}
          <Card className="p-6">
            {lot.description && (
              <p className="mb-5 text-sm leading-relaxed text-ink-2">
                {lot.description}
              </p>
            )}
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-xs font-semibold text-muted">{f.label}</dt>
                  <dd className="mt-0.5 text-sm text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>

            {/* the same instant, in two time zones */}
            <div className="mt-5 grid gap-3 rounded-lg border border-line bg-surface-2 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-muted">
                  {dict.lot.endAt} — {dict.common.timezone}: {user.timezone}
                </p>
                <p className="tnum mt-0.5 text-sm font-bold text-ink">
                  {formatDateTime(closeAt, user.timezone, locale)}{" "}
                  <span className="font-normal text-muted">
                    {zoneLabel(closeAt, user.timezone)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted">
                  {dict.lot.seller} — {lot.country.timezone}
                </p>
                <p className="tnum mt-0.5 text-sm font-bold text-ink">
                  {formatDateTime(closeAt, lot.country.timezone, locale)}{" "}
                  <span className="font-normal text-muted">
                    {zoneLabel(closeAt, lot.country.timezone)}
                  </span>
                </p>
              </div>
              <p className="text-xs text-muted sm:col-span-2">
                同じ瞬間を、それぞれの現地時間で表示しています。内部では協定世界時で1本に保持しています。
              </p>
            </div>
          </Card>

          {/* manifest */}
          <Card className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-ink">{dict.lot.manifest}</h2>
              <span className="text-xs text-muted">
                {lot.items.length} lines · {formatNumber(lot.quantity, locale)} units
              </span>
            </div>
            <ManifestTable
              lines={lot.items.map((i) => ({
                lineNo: i.lineNo,
                maker: i.maker,
                model: i.model,
                cpu: i.cpu,
                ramGb: i.ramGb,
                storage: i.storage,
                gpu: i.gpu,
                screen: i.screen,
                grade: i.grade,
                quantity: i.quantity,
                note: i.note,
              }))}
              labels={{
                filter: dict.common.search,
                maker: dict.search.maker,
                model: dict.search.model,
                cpu: dict.search.cpu,
                ram: "RAM",
                storage: "Storage",
                gpu: "GPU",
                screen: "Screen",
                grade: "Grade",
                quantity: dict.common.quantity,
                note: "Note",
                total: dict.common.total,
                noData: dict.common.noData,
                lines: "lines",
              }}
            />
          </Card>

          {/* bids */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-4">
              <h2 className="text-base font-bold text-ink">
                {opened ? dict.bid.bidsRevealed : dict.bid.bidsSealed}
              </h2>
              <span className="tnum text-xs text-muted">{lot.bids.length}</span>
            </div>

            {!opened ? (
              <>
                <ul className="divide-y divide-line">
                  {sealedBids.map((b) => (
                    <li key={b.id} className="flex items-center gap-3 px-6 py-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-seal" aria-hidden="true">
                        <rect x="4" y="10" width="16" height="11" rx="2" />
                        <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                      </svg>
                      <span className="font-mono text-xs tracking-wider text-seal">
                        {cipherFingerprint(b.ciphertext)}
                      </span>
                      <span className="ml-auto text-xs text-muted">
                        {isSellerSide
                          ? formatDateTime(b.submittedAt, user.timezone, locale)
                          : dict.bid.hidden}
                      </span>
                      <span className="animate-seal badge bg-seal-bg text-seal">
                        {dict.bidStatus.SEALED}
                      </span>
                    </li>
                  ))}
                  {sealedBids.length === 0 && (
                    <li className="px-6 py-10 text-center text-sm text-muted">
                      {dict.common.noData}
                    </li>
                  )}
                </ul>

                {isSellerSide && (
                  <div className="border-t border-line bg-surface-2 px-6 py-4">
                    {isClosed ? (
                      <form action={openSealAction}>
                        <input type="hidden" name="lotId" value={lot.id} />
                        <button type="submit" className="btn btn-primary">
                          {dict.bid.openSeal}
                        </button>
                        <p className="mt-2 text-xs text-muted">
                          {dict.bid.openSealHint}
                        </p>
                      </form>
                    ) : (
                      <p className="text-xs leading-relaxed text-muted">
                        {dict.bid.openSealBefore}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="table-wrap border-0">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="w-12">{dict.bid.rank}</th>
                        <th>{dict.common.company}</th>
                        <th className="text-right">{dict.common.amount}</th>
                        <th>{dict.bid.verify}</th>
                        <th>{dict.common.createdAt}</th>
                        {isSellerSide && !lot.award && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {revealedBids.map((b, i) => {
                        const ok =
                          b.amountCents !== null &&
                          b.nonce &&
                          commit(b.amountCents, b.nonce) === b.commitmentHash;
                        const isWinner = lot.award?.bidId === b.id;
                        return (
                          <tr key={b.id} className={isWinner ? "bg-success-bg/40" : undefined}>
                            <td className="tnum font-bold text-ink">{i + 1}</td>
                            <td>
                              <span className="font-medium text-ink">
                                {countryFlag(b.bidderCompany.countryCode)}{" "}
                                {locale === "ja"
                                  ? b.bidderCompany.name
                                  : b.bidderCompany.nameEn}
                              </span>
                              {isWinner && (
                                <Badge tone="success" className="ml-2">
                                  {dict.bid.awarded}
                                </Badge>
                              )}
                            </td>
                            <td className="tnum text-right font-bold text-ink">
                              {b.amountCents !== null
                                ? formatMoney(b.amountCents, lot.currency, locale)
                                : "—"}
                            </td>
                            <td>
                              <Badge tone={ok ? "success" : "danger"}>
                                {ok ? dict.bid.verifyOk : dict.bid.verifyNg}
                              </Badge>
                            </td>
                            <td className="whitespace-nowrap text-xs text-muted">
                              {formatDateTime(b.submittedAt, user.timezone, locale)}
                            </td>
                            {isSellerSide && !lot.award && (
                              <td>
                                <form action={awardLotAction} className="flex gap-1.5">
                                  <input type="hidden" name="lotId" value={lot.id} />
                                  <input type="hidden" name="bidId" value={b.id} />
                                  <input
                                    name="reason"
                                    className="input h-8 w-44 py-1 text-xs"
                                    placeholder={
                                      i === 0
                                        ? dict.bid.awardReason
                                        : dict.bid.awardReasonRequired
                                    }
                                    required={i > 0}
                                  />
                                  <button
                                    type="submit"
                                    className="btn btn-primary whitespace-nowrap px-2.5 py-1 text-xs"
                                  >
                                    {dict.bid.awardSelect}
                                  </button>
                                </form>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-line bg-surface-2 px-6 py-3">
                  <p className="text-xs leading-relaxed text-muted">
                    {dict.bid.verifyHint} · {dict.bid.openedAt}:{" "}
                    {lot.openedAt
                      ? formatDateTime(lot.openedAt, user.timezone, locale)
                      : "—"}
                  </p>
                </div>
              </>
            )}
          </Card>

          {/* award record */}
          {lot.award && (
            <Card className="p-6">
              <h2 className="mb-3 text-base font-bold text-ink">{dict.bid.awardTitle}</h2>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-muted">{dict.common.company}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-ink">
                    {locale === "ja"
                      ? lot.award.winnerCompany.name
                      : lot.award.winnerCompany.nameEn}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">{dict.common.amount}</dt>
                  <dd className="tnum mt-0.5 text-sm font-bold text-ink">
                    {formatMoney(lot.award.amountCents, lot.award.currency, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">{dict.bid.rank}</dt>
                  <dd className="mt-0.5 text-sm text-ink">
                    {lot.award.rankAmongBids}
                    {lot.award.isHighestBid && (
                      <Badge tone="success" className="ml-2">
                        {dict.bid.awardHighest}
                      </Badge>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">{dict.common.createdAt}</dt>
                  <dd className="mt-0.5 text-sm text-ink">
                    {formatDateTime(lot.award.selectedAt, user.timezone, locale)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold text-muted">
                    {dict.bid.awardReason}
                  </dt>
                  <dd className="mt-0.5 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">
                    {lot.award.reason}
                  </dd>
                </div>
                {lot.award.contract && (
                  <div className="sm:col-span-2">
                    <Link
                      href={`/contracts/${lot.award.contract.id}`}
                      className="btn btn-ghost"
                    >
                      {dict.nav.contracts} · {lot.award.contract.contractNo}
                    </Link>
                  </div>
                )}
              </dl>
            </Card>
          )}

          {/* Q&A */}
          <Card className="overflow-hidden">
            <div className="border-b border-line px-6 py-4">
              <h2 className="text-base font-bold text-ink">{dict.bid.questionTitle}</h2>
              <p className="mt-0.5 text-xs text-muted">
                {dict.bid.questionPublicNotice}
              </p>
            </div>

            <ul className="divide-y divide-line">
              {lot.questions.map((q) => (
                <li key={q.id} className="px-6 py-4">
                  <p className="text-sm text-ink">{q.body}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {locale === "ja" ? q.askerCompany.name : q.askerCompany.nameEn} ·{" "}
                    {formatDateTime(q.createdAt, user.timezone, locale)}
                  </p>

                  {q.answer ? (
                    <div className="mt-3 rounded-lg border-l-2 border-brand bg-surface-2 px-3.5 py-2.5">
                      <p className="text-sm text-ink-2">{q.answer.body}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {locale === "ja" ? lot.sellerCompany.name : lot.sellerCompany.nameEn} ·{" "}
                        {formatDateTime(q.answer.createdAt, user.timezone, locale)}
                      </p>
                    </div>
                  ) : isSellerSide ? (
                    <form
                      action={answerQuestionAction}
                      className="mt-3 flex flex-wrap gap-2"
                    >
                      <input type="hidden" name="questionId" value={q.id} />
                      <input
                        name="body"
                        required
                        className="input h-9 min-w-52 flex-1 py-1.5 text-sm"
                        placeholder={dict.bid.answerPlaceholder}
                      />
                      <button type="submit" className="btn btn-primary px-3 py-1.5 text-xs">
                        {dict.bid.answerSubmit}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
              {lot.questions.length === 0 && (
                <li className="px-6 py-8 text-center text-sm text-muted">
                  {dict.bid.noQuestions}
                </li>
              )}
            </ul>

            {user.role === "BIDDER" && (
              <form action={askQuestionAction} className="border-t border-line p-6">
                <input type="hidden" name="lotId" value={lot.id} />
                <textarea
                  name="body"
                  rows={3}
                  required
                  className="input resize-y"
                  placeholder={dict.bid.questionPlaceholder}
                />
                <button type="submit" className="btn btn-primary mt-2">
                  {dict.bid.questionSubmit}
                </button>
              </form>
            )}
          </Card>
        </div>

        {/* --- right rail --- */}
        <div className="space-y-5">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {dict.lot.remaining}
            </p>
            <Countdown
              endAt={closeAt.toISOString()}
              initial={initial}
              className="mt-1 block text-3xl"
              expiredLabel={dict.lotStatus.CLOSED}
            />
            <p className="mt-1 text-xs text-muted">
              {formatDateTime(closeAt, user.timezone, locale)}{" "}
              {zoneLabel(closeAt, user.timezone)}
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <div>
                <dt className="text-xs text-muted">{dict.lot.bidCount}</dt>
                <dd className="tnum text-xl font-bold text-ink">{lot.bids.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{dict.lot.quantity}</dt>
                <dd className="tnum text-xl font-bold text-ink">
                  {formatNumber(lot.quantity, locale)}
                </dd>
              </div>
            </dl>
          </Card>

          {user.role === "BIDDER" && lot.status === "OPEN" && !isClosed && (
            <Card className="p-6">
              <h2 className="mb-4 text-base font-bold text-ink">{dict.bid.panelTitle}</h2>
              {canBid(user) ? (
                <BidPanel
                  lotId={lot.id}
                  currency={lot.currency}
                  minimumBid={lot.minimumBidCents}
                  existing={
                    myBid
                      ? {
                          submittedAt: myBid.submittedAt.toISOString(),
                          commitmentHash: myBid.commitmentHash,
                          sequence: myBid.sequence,
                        }
                      : null
                  }
                  labels={{
                    panelTitle: dict.bid.panelTitle,
                    amount: dict.bid.amount,
                    place: dict.bid.place,
                    rebid: dict.bid.rebid,
                    cancel: dict.bid.cancel,
                    yourBid: dict.bid.yourBid,
                    yourBidSealed: dict.bid.yourBidSealed,
                    sealedNotice: dict.bid.sealedNotice,
                    commitment: dict.bid.commitment,
                    submitted: dict.bid.submitted,
                    cancelled: dict.bid.cancelled,
                    extensionFired: dict.bid.extensionFired,
                    minimumBid: dict.lot.minimumBid,
                    errors: {
                      NOT_APPROVED: dict.bid.errNotApproved,
                      AMOUNT: dict.bid.errAmount,
                      CLOSED: dict.bid.errClosed,
                      MINIMUM: dict.bid.errMinimum,
                      LIMIT: dict.bid.errLimit,
                      OWN_LOT: dict.bid.errOwnLot,
                    },
                  }}
                />
              ) : (
                <p className="rounded-lg bg-warn-bg px-3 py-2.5 text-sm text-warn">
                  {dict.bid.errNotApproved}
                </p>
              )}
            </Card>
          )}

          {lot.attachments.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-3 text-base font-bold text-ink">
                {dict.lot.attachments}
              </h2>
              <ul className="space-y-2">
                {lot.attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={`/api/lots/${lot.id}/manifest`}
                      className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-brand hover:bg-surface-3"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                        <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
                        <path d="M14 3v6h6" />
                      </svg>
                      <span className="truncate">{a.fileName}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
