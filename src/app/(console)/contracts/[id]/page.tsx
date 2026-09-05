import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { Badge, Card, CONTRACT_STATUS_TONE } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { CONTRACT_STATUSES, PAYMENT_METHODS } from "@/lib/constants";
import { formatDateTime } from "@/lib/datetime";
import { convertCents, countryFlag, formatMoney } from "@/lib/format";
import {
  cardLimitCents,
  confirmPaymentAction,
  confirmReceiptAction,
  markShippedAction,
  reportDefectAction,
  requestShipmentAction,
  selectPaymentMethodAction,
} from "../actions";

export const metadata: Metadata = { title: "成約詳細" };
export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const dict = await getDictionary();
  const locale = await getLocale();

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      award: {
        include: {
          lot: { include: { country: true, sellerCompany: { include: { country: true } } } },
          winnerCompany: { include: { country: true } },
          selectedBy: true,
        },
      },
      invoices: { include: { receipt: true, payments: true } },
      shipments: { include: { defects: true } },
    },
  });
  if (!contract) notFound();

  const isSeller =
    user.role === "ADMIN" || user.companyId === contract.award.lot.sellerCompanyId;
  const isBuyer =
    user.role === "ADMIN" || user.companyId === contract.award.winnerCompanyId;
  if (!isSeller && !isBuyer) notFound();

  const invoice = contract.invoices[0];
  const shipment = contract.shipments[0];
  const limit = await cardLimitCents();
  const overLimit = invoice ? invoice.totalCents > limit : false;
  const isJapanBuyer = contract.award.winnerCompany.countryCode === "JP";

  const stepIndex = CONTRACT_STATUSES.indexOf(
    contract.status as (typeof CONTRACT_STATUSES)[number]
  );

  return (
    <>
      <PageHeader
        title={contract.contractNo}
        lead={locale === "ja" ? contract.award.lot.title : contract.award.lot.titleEn}
        actions={
          <>
            {invoice && (
              <Link
                href={`/invoice/${contract.id}`}
                className="btn btn-primary"
              >
                {dict.contract.printInvoice}
              </Link>
            )}
            <Link href="/contracts" className="btn btn-ghost">
              {dict.common.back}
            </Link>
          </>
        }
      />

      {/* status flow */}
      <Card className="mb-5 p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {dict.contract.statusFlow}
        </p>
        <ol className="flex flex-wrap gap-2">
          {CONTRACT_STATUSES.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={
                  i < stepIndex
                    ? "badge bg-success-bg text-success"
                    : i === stepIndex
                      ? "badge bg-brand text-on-brand"
                      : "badge bg-surface-3 text-muted"
                }
              >
                {i < stepIndex ? "✓ " : ""}
                {dict.contractStatus[s]}
              </span>
              {i < CONTRACT_STATUSES.length - 1 && (
                <span className="text-muted" aria-hidden="true">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {/* parties */}
          <Card className="p-6">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-muted">{dict.contract.seller}</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {countryFlag(contract.award.lot.countryCode)}{" "}
                  {locale === "ja"
                    ? contract.award.lot.sellerCompany.name
                    : contract.award.lot.sellerCompany.nameEn}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">{dict.contract.buyer}</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {countryFlag(contract.award.winnerCompany.countryCode)}{" "}
                  {locale === "ja"
                    ? contract.award.winnerCompany.name
                    : contract.award.winnerCompany.nameEn}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">{dict.contract.lot}</dt>
                <dd className="mt-0.5 text-sm">
                  <Link
                    href={`/lots/${contract.award.lotId}`}
                    className="font-mono text-brand hover:underline"
                  >
                    {contract.award.lot.lotNumber}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">{dict.contract.amount}</dt>
                <dd className="tnum mt-0.5 text-sm font-bold text-ink">
                  {formatMoney(contract.amountCents, contract.currency, locale)}
                </dd>
              </div>
              {contract.fxRate && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold text-muted">{dict.contract.fx}</dt>
                  <dd className="tnum mt-0.5 text-sm text-ink">
                    1 USD = {contract.fxRate} {contract.fxCurrency} ·{" "}
                    {formatMoney(
                      convertCents(contract.amountCents, contract.fxRate, "JPY"),
                      "JPY",
                      locale
                    )}
                  </dd>
                  <p className="mt-1 text-xs text-muted">{dict.contract.fxNote}</p>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold text-muted">
                  {dict.bid.awardReason}
                </dt>
                <dd className="mt-0.5 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
                  {contract.award.reason}
                  <span className="ml-2 text-xs text-muted">
                    ({dict.bid.rank} {contract.award.rankAmongBids})
                  </span>
                </dd>
              </div>
            </dl>
          </Card>

          {/* invoice */}
          {invoice && (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-4">
                <h2 className="text-base font-bold text-ink">{dict.contract.invoice}</h2>
                <Badge tone={invoice.status === "PAID" ? "success" : "warn"} dot>
                  {dict.invoiceStatus[invoice.status as keyof typeof dict.invoiceStatus] ?? invoice.status}
                </Badge>
              </div>

              <div className="space-y-3 p-6">
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between sm:block">
                    <dt className="text-xs text-muted">{dict.contract.invoiceNo}</dt>
                    <dd className="font-mono text-ink">{invoice.invoiceNo}</dd>
                  </div>
                  <div className="flex justify-between sm:block">
                    <dt className="text-xs text-muted">{dict.contract.dueAt}</dt>
                    <dd className="text-ink">
                      {formatDateTime(invoice.dueAt, user.timezone, locale)}
                    </dd>
                  </div>
                </dl>

                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1 text-muted">{dict.contract.subtotal}</td>
                      <td className="tnum py-1 text-right text-ink">
                        {formatMoney(invoice.subtotalCents, invoice.currency, locale)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 text-muted">
                        {invoice.taxTreatment === "DOMESTIC_JP_10"
                          ? dict.contract.taxDomestic
                          : dict.contract.taxExport}
                      </td>
                      <td className="tnum py-1 text-right text-ink">
                        {formatMoney(invoice.taxCents, invoice.currency, locale)}
                      </td>
                    </tr>
                    <tr className="border-t border-line">
                      <td className="py-2 font-bold text-ink">{dict.contract.total}</td>
                      <td className="tnum py-2 text-right text-lg font-bold text-ink">
                        {formatMoney(invoice.totalCents, invoice.currency, locale)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {invoice.qualifiedInvoiceNo && (
                  <p className="rounded-lg bg-info-bg px-3 py-2 text-xs text-info">
                    {dict.contract.qualifiedInvoiceNo}: {invoice.qualifiedInvoiceNo}
                  </p>
                )}
                <p className="text-xs leading-relaxed text-muted">
                  {dict.contract.qualifiedNote}
                </p>

                {invoice.receipt && (
                  <p className="rounded-lg bg-success-bg px-3 py-2 text-xs text-success">
                    {dict.contract.receipt}: {invoice.receipt.receiptNo}
                    {invoice.receipt.isQualified && ` · ${dict.contract.qualifiedReceipt}`}
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* logistics */}
          <Card className="overflow-hidden">
            <div className="border-b border-line px-6 py-4">
              <h2 className="text-base font-bold text-ink">{dict.contract.logistics}</h2>
            </div>

            <div className="space-y-4 p-6">
              {!shipment ? (
                isSeller ? (
                  <form action={requestShipmentAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="contractId" value={contract.id} />
                    <div>
                      <label className="label" htmlFor="carrier">
                        {dict.contract.carrier}
                      </label>
                      <input
                        id="carrier"
                        name="carrier"
                        className="input w-44"
                        placeholder="DHL"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="incoterms">
                        {dict.contract.incoterms}
                      </label>
                      <select id="incoterms" name="incoterms" className="input w-28">
                        <option>EXW</option>
                        <option>FOB</option>
                        <option>CIF</option>
                        <option>DAP</option>
                      </select>
                    </div>
                    <SubmitButton pendingLabel={dict.common.processing}>{dict.contract.requestShipment}</SubmitButton>
                  </form>
                ) : (
                  <p className="text-sm text-muted">{dict.common.noData}</p>
                )
              ) : (
                <>
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted">{dict.common.status}</dt>
                      <dd className="text-ink">
                        {dict.shipmentStatus[shipment.status as keyof typeof dict.shipmentStatus] ?? shipment.status}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">{dict.contract.carrier}</dt>
                      <dd className="text-ink">{shipment.carrier ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">{dict.contract.trackingNo}</dt>
                      <dd className="font-mono text-ink">{shipment.trackingNo ?? "—"}</dd>
                    </div>
                  </dl>

                  {isSeller && shipment.status === "REQUESTED" && (
                    <form action={markShippedAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="contractId" value={contract.id} />
                      <input type="hidden" name="shipmentId" value={shipment.id} />
                      <div>
                        <label className="label" htmlFor="carrier2">
                          {dict.contract.carrier}
                        </label>
                        <input
                          id="carrier2"
                          name="carrier"
                          defaultValue={shipment.carrier ?? ""}
                          className="input w-40"
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor="trackingNo">
                          {dict.contract.trackingNo}
                        </label>
                        <input id="trackingNo" name="trackingNo" className="input w-44" />
                      </div>
                      <SubmitButton confirm={dict.contract.confirmShippedDialog} pendingLabel={dict.common.processing}>{dict.contract.markShipped}</SubmitButton>
                    </form>
                  )}

                  {isBuyer && shipment.status === "SHIPPED" && (
                    <form action={confirmReceiptAction}>
                      <input type="hidden" name="contractId" value={contract.id} />
                      <input type="hidden" name="shipmentId" value={shipment.id} />
                      <SubmitButton confirm={dict.contract.confirmReceiptDialog} pendingLabel={dict.common.processing}>{dict.contract.confirmReceipt}</SubmitButton>
                    </form>
                  )}

                  {shipment.defects.length > 0 && (
                    <div className="rounded-lg border border-danger/25 bg-danger-bg p-3">
                      <p className="text-xs font-bold text-danger">
                        {dict.contract.defects}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {shipment.defects.map((d) => (
                          <li key={d.id} className="text-xs text-danger">
                            {d.body} （{dict.defectStatus[d.status as keyof typeof dict.defectStatus] ?? d.status}）
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isBuyer && shipment.status !== "REQUESTED" && (
                    <form action={reportDefectAction} className="space-y-2 border-t border-line pt-4">
                      <input type="hidden" name="contractId" value={contract.id} />
                      <input type="hidden" name="shipmentId" value={shipment.id} />
                      <label className="label" htmlFor="defect">
                        {dict.contract.defectBody}
                      </label>
                      <textarea
                        id="defect"
                        name="body"
                        rows={2}
                        required
                        className="input resize-y"
                      />
                      <SubmitButton className="btn-danger" pendingLabel={dict.common.processing}>{dict.contract.reportDefect}</SubmitButton>
                    </form>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* right rail */}
        <div className="space-y-5">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {dict.common.status}
            </p>
            <Badge
              tone={CONTRACT_STATUS_TONE[contract.status] ?? "neutral"}
              className="mt-2"
              dot
            >
              {dict.contractStatus[contract.status as keyof typeof dict.contractStatus]}
            </Badge>
          </Card>

          {invoice && (
            <Card className="p-6">
              <h2 className="text-base font-bold text-ink">
                {dict.contract.paymentMethod}
              </h2>

              {invoice.paymentMethod && (
                <p className="mt-2 text-sm font-semibold text-ink">
                  {dict.paymentMethod[
                    invoice.paymentMethod as keyof typeof dict.paymentMethod
                  ] ?? invoice.paymentMethod}
                </p>
              )}

              {isBuyer && invoice.status !== "PAID" && (
                <form action={selectPaymentMethodAction} className="mt-3 space-y-2">
                  <input type="hidden" name="contractId" value={contract.id} />
                  {PAYMENT_METHODS.map((m) => {
                    const blocked =
                      (m === "CREDIT_CARD" || m === "PAYPAL") && overLimit;
                    return (
                      <SubmitButton
                        key={m}
                        name="method"
                        value={m}
                        disabled={blocked}
                        className={
                          blocked
                            ? "btn-subtle w-full cursor-not-allowed"
                            : "btn-ghost w-full"
                        }
                        title={blocked ? dict.contract.cardBlocked : undefined}
                        pendingLabel={dict.common.processing}
                      >
                        {dict.paymentMethod[m]}
                        {blocked && (
                          <span className="text-[11px] font-normal opacity-70">
                            （{dict.contract.cardLimit}）
                          </span>
                        )}
                      </SubmitButton>
                    );
                  })}
                </form>
              )}

              <div className="mt-4 rounded-lg bg-warn-bg px-3 py-2.5">
                <p className="text-xs font-semibold text-warn">
                  {dict.contract.cardLimit}:{" "}
                  {formatMoney(limit, invoice.currency, locale)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-warn">
                  {overLimit ? dict.contract.cardBlocked : dict.contract.cardFeeNote}
                </p>
              </div>

              {isSeller && invoice.status !== "PAID" && (
                <form action={confirmPaymentAction} className="mt-4 space-y-2 border-t border-line pt-4">
                  <input type="hidden" name="contractId" value={contract.id} />
                  <label className="label" htmlFor="reference">
                    {dict.contract.remarks}
                  </label>
                  <input
                    id="reference"
                    name="reference"
                    className="input"
                    placeholder="REF123456"
                  />
                  <SubmitButton className="btn-primary w-full" confirm={dict.contract.confirmPaymentDialog} pendingLabel={dict.common.processing}>{dict.contract.confirmPayment}</SubmitButton>
                </form>
              )}

              {invoice.paidAt && (
                <p className="mt-3 rounded-lg bg-success-bg px-3 py-2 text-xs text-success">
                  {dict.contract.paidAt}:{" "}
                  {formatDateTime(invoice.paidAt, user.timezone, locale)}
                </p>
              )}
            </Card>
          )}

          {isJapanBuyer && (
            <Card className="p-6">
              <p className="text-xs leading-relaxed text-ink-2">
                国内バイヤーのため、適格請求書（インボイス）と適格請求書対応の領収書を発行します。
                海外バイヤーの場合は輸出免税となり、同じ画面から異なる書式が出ます。
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
