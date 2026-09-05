import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/i18n";
import { LogoMark } from "@/components/Logo";
import { PrintButton } from "@/components/PrintButton";
import { formatDate } from "@/lib/datetime";
import { convertCents, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "請求書" };
export const dynamic = "force-dynamic";

/**
 * Printable invoice.
 *
 * Two entirely different documents come out of this one page: a Japanese
 * qualified invoice with a 10% tax line and a registration number, or an
 * export-exempt invoice with a zero tax line and a customs note. Trying to
 * serve both from one template with an if-statement around the tax row is how
 * accounting teams end up correcting documents by hand.
 */
export default async function InvoicePage({
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
          lot: {
            include: {
              sellerCompany: { include: { country: true } },
              country: true,
            },
          },
          winnerCompany: { include: { country: true } },
        },
      },
      invoices: { include: { receipt: true } },
    },
  });
  if (!contract) notFound();

  const allowed =
    user.role === "ADMIN" ||
    user.companyId === contract.award.lot.sellerCompanyId ||
    user.companyId === contract.award.winnerCompanyId;
  if (!allowed) notFound();

  const invoice = contract.invoices[0];
  if (!invoice) notFound();

  const isDomestic = invoice.taxTreatment === "DOMESTIC_JP_10";
  const seller = contract.award.lot.sellerCompany;
  const buyer = contract.award.winnerCompany;

  return (
    <div className="min-h-dvh bg-surface-3 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link href={`/contracts/${contract.id}`} className="btn btn-ghost">
            {dict.common.back}
          </Link>
          <PrintButton label={dict.contract.printInvoice} />
        </div>

        <article className="rounded-xl bg-white p-10 text-[#0f1b2d] shadow-lg print:rounded-none print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-6 border-b-2 border-[#1a48ad] pb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <LogoMark size={34} />
                <div>
                  <p className="text-sm font-bold">SK TES Global Auction</p>
                  <p className="text-[10px] uppercase tracking-widest text-[#64748b]">
                    {isDomestic ? "適格請求書" : "Commercial Invoice"}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold tracking-tight">
                {isDomestic ? "請求書" : "INVOICE"}
              </h1>
              <p className="mt-1 font-mono text-sm">{invoice.invoiceNo}</p>
              <p className="text-xs text-[#64748b]">
                {dict.contract.issuedAt}:{" "}
                {formatDate(invoice.issuedAt, user.timezone, locale)}
              </p>
              <p className="text-xs text-[#64748b]">
                {dict.contract.dueAt}:{" "}
                {formatDate(invoice.dueAt, user.timezone, locale)}
              </p>
            </div>
          </header>

          <section className="grid gap-8 py-6 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748b]">
                {dict.contract.invoiceFor}
              </p>
              <p className="mt-1.5 text-sm font-bold">
                {locale === "ja" ? buyer.name : buyer.nameEn}
              </p>
              <p className="text-xs leading-relaxed text-[#33445c]">
                {buyer.hqAddress}
                <br />
                {locale === "ja" ? buyer.country.nameJa : buyer.country.nameEn}
                <br />
                {buyer.contactName} · {buyer.contactEmail}
              </p>
              {isDomestic && buyer.corporateNumber && (
                <p className="mt-1 text-xs text-[#64748b]">
                  法人番号: {buyer.corporateNumber}
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748b]">
                {dict.contract.invoiceFrom}
              </p>
              <p className="mt-1.5 text-sm font-bold">
                {locale === "ja" ? seller.name : seller.nameEn}
              </p>
              <p className="text-xs leading-relaxed text-[#33445c]">
                {seller.hqAddress}
                <br />
                {locale === "ja" ? seller.country.nameJa : seller.country.nameEn}
              </p>
              {isDomestic && invoice.qualifiedInvoiceNo && (
                <p className="mt-1 text-xs font-semibold">
                  {dict.contract.qualifiedInvoiceNo}
                  <br />
                  {invoice.qualifiedInvoiceNo}
                </p>
              )}
            </div>
          </section>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#eef5ff]">
                <th className="border border-[#dde5ef] px-3 py-2 text-left text-xs font-bold">
                  {dict.contract.lot}
                </th>
                <th className="border border-[#dde5ef] px-3 py-2 text-right text-xs font-bold">
                  {dict.common.quantity}
                </th>
                <th className="border border-[#dde5ef] px-3 py-2 text-right text-xs font-bold">
                  {dict.common.amount}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-[#dde5ef] px-3 py-3">
                  <p className="font-semibold">
                    {locale === "ja"
                      ? contract.award.lot.title
                      : contract.award.lot.titleEn}
                  </p>
                  <p className="font-mono text-xs text-[#64748b]">
                    {contract.award.lot.lotNumber} ·{" "}
                    {contract.award.lot.handoverLocation}
                  </p>
                </td>
                <td className="border border-[#dde5ef] px-3 py-3 text-right tabular-nums">
                  {contract.award.lot.quantity.toLocaleString("en-US")}
                </td>
                <td className="border border-[#dde5ef] px-3 py-3 text-right font-semibold tabular-nums">
                  {formatMoney(invoice.subtotalCents, invoice.currency, locale)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <table className="w-full max-w-xs text-sm">
              <tbody>
                <tr>
                  <td className="py-1 text-[#64748b]">{dict.contract.subtotal}</td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(invoice.subtotalCents, invoice.currency, locale)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-[#64748b]">
                    {isDomestic ? dict.contract.taxDomestic : dict.contract.taxExport}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatMoney(invoice.taxCents, invoice.currency, locale)}
                  </td>
                </tr>
                <tr className="border-t-2 border-[#0f1b2d]">
                  <td className="py-2 font-bold">{dict.contract.total}</td>
                  <td className="py-2 text-right text-lg font-bold tabular-nums">
                    {formatMoney(invoice.totalCents, invoice.currency, locale)}
                  </td>
                </tr>
                {contract.fxRate && (
                  <tr>
                    <td className="py-1 text-xs text-[#64748b]">
                      {dict.contract.fx} 1 USD = {contract.fxRate}{" "}
                      {contract.fxCurrency}
                    </td>
                    <td className="py-1 text-right text-xs tabular-nums text-[#64748b]">
                      {formatMoney(
                        convertCents(invoice.totalCents, contract.fxRate, "JPY"),
                        "JPY",
                        locale
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <section className="mt-8 space-y-3 border-t border-[#dde5ef] pt-5 text-xs leading-relaxed text-[#33445c]">
            <div>
              <p className="font-bold">{dict.contract.bankDetails}</p>
              <p>
                Bank: SKTES Demo Bank, Tokyo · SWIFT: SKTEJPJT
                <br />
                Account: 1234567 (USD) · Beneficiary: SK TES Japan K.K.
              </p>
            </div>
            <div>
              <p className="font-bold">{dict.contract.remarks}</p>
              {isDomestic ? (
                <p>
                  本請求書は適格請求書等保存方式（インボイス制度）に対応しています。
                  消費税は10%（標準税率）を適用しています。
                </p>
              ) : (
                <p>
                  This supply is a zero-rated export under Japanese consumption tax
                  law. No consumption tax is charged. The buyer is responsible for
                  any import duty, VAT or clearance charges in the destination
                  country.
                </p>
              )}
              <p className="mt-2 font-semibold text-[#9a5b06]">
                ※ {dict.footer.demoNotice} — この書類はデモ用のサンプルです。
              </p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}

