import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/i18n";
import { PageHeader } from "@/components/console/ConsoleShell";
import { CATEGORY_CODES, CONDITIONS } from "@/lib/constants";
import { addDays, utcToLocalInput } from "@/lib/datetime";
import { NewLotForm } from "./NewLotForm";

export const metadata: Metadata = { title: "新規出品" };
export const dynamic = "force-dynamic";

export default async function NewLotPage() {
  const user = await requireRole("SELLER", "ADMIN");
  const dict = await getDictionary();

  const company = user.companyId
    ? await prisma.company.findUnique({
        where: { id: user.companyId },
        include: { country: true },
      })
    : null;

  const now = new Date();
  const defaultLocation = company
    ? `${company.country.nameEn} (${company.countryCode})`
    : "";

  return (
    <>
      <PageHeader
        title={dict.listing.newLot}
        lead={company ? company.name : undefined}
        actions={
          <>
            <a href="/api/manifest-template" className="btn btn-subtle" download>
              {dict.listing.downloadTemplate}
            </a>
            <Link href="/listings" className="btn btn-ghost">
              {dict.common.back}
            </Link>
          </>
        }
      />

      <NewLotForm
        timezone={user.timezone}
        categories={CATEGORY_CODES.map((c) => ({ value: c, label: dict.category[c] }))}
        conditions={CONDITIONS.map((c) => ({ value: c, label: dict.condition[c] }))}
        defaults={{
          startAt: utcToLocalInput(now, user.timezone),
          endAt: utcToLocalInput(addDays(now, 10), user.timezone),
          storage: defaultLocation,
          handover: defaultLocation ? `${defaultLocation} (EXW)` : "",
        }}
        labels={{
          steps: [dict.listing.step1, dict.listing.step2, dict.listing.step3],
          caseName: dict.listing.caseName,
          caseNameEn: dict.listing.caseNameEn,
          description: dict.listing.description,
          category: dict.lot.category,
          condition: dict.lot.condition,
          storageLocation: dict.listing.storageLocation,
          handoverLocation: dict.listing.handoverLocation,
          uploadExcel: dict.listing.uploadExcel,
          downloadTemplate: dict.listing.downloadTemplate,
          templateHint: dict.listing.templateHint,
          parsePreview: dict.listing.parsePreview,
          parsedLines: dict.listing.parsedLines,
          parsedUnits: dict.listing.parsedUnits,
          parseErrors: dict.listing.parseErrors,
          minimumBid: dict.listing.minimumBid,
          reserve: dict.listing.reserve,
          auctionType: dict.listing.auctionType,
          sealed: dict.listing.sealed,
          openAuction: dict.listing.openAuction,
          extension: dict.listing.extension,
          extensionOn: dict.listing.extensionOn,
          extensionTrigger: dict.listing.extensionTrigger,
          extensionMinutes: dict.listing.extensionMinutes,
          startAt: dict.listing.startAt,
          endAt: dict.listing.endAt,
          timezoneNote: dict.listing.timezoneNote,
          saveDraft: dict.listing.saveDraft,
          publish: dict.listing.publish,
          back: dict.common.back,
          next: dict.common.next,
          import: dict.listing.uploadExcel,
          timezone: dict.common.timezone,
        }}
      />
    </>
  );
}
