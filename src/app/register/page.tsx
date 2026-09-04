import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { getDictionary, getLocale } from "@/i18n";
import { prisma } from "@/lib/prisma";
import { RegisterWizard, type CountryOption } from "./RegisterWizard";

export const metadata: Metadata = { title: "会員登録" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const locale = await getLocale();
  const dict = await getDictionary();

  const rows = await prisma.country.findMany({ orderBy: { code: "asc" } });
  const countries: CountryOption[] = rows
    .map((c) => ({
      code: c.code,
      name: locale === "ja" ? c.nameJa : locale === "zh" ? c.nameZh : c.nameEn,
      region: dict.region[c.region as keyof typeof dict.region] ?? c.region,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  return (
    <AuthShell
      wide
      title={dict.member.registerTitle}
      lead={dict.member.registerLead}
      footer={
        <Link href="/login" className="text-muted hover:text-brand hover:underline">
          {dict.auth.signIn}
        </Link>
      }
    >
      <RegisterWizard
        countries={countries}
        labels={{
          steps: [dict.member.step1, dict.member.step2, dict.member.step3],
          companyName: dict.member.companyName,
          companyNameEn: dict.member.companyNameEn,
          country: dict.member.country,
          contactName: dict.member.contactName,
          contactEmail: dict.member.contactEmail,
          contactPhone: dict.member.contactPhone,
          corporateNumber: dict.member.corporateNumber,
          corporateNumberHint: dict.member.corporateNumberHint,
          hqAddress: dict.member.hqAddress,
          branchAddress: dict.member.branchAddress,
          exportDestinations: dict.member.exportDestinations,
          exportDestinationsHint: dict.member.exportDestinationsHint,
          hasImportLicense: dict.member.hasImportLicense,
          licenseYes: dict.member.licenseYes,
          licenseNo: dict.member.licenseNo,
          antiqueLicense: dict.member.antiqueLicense,
          antiqueHint: dict.member.antiqueHint,
          password: dict.member.password,
          passwordPolicy: dict.auth.passwordPolicy,
          docsLead: dict.member.docsLead,
          docRequired: dict.member.docRequired,
          docConditional: dict.member.docConditional,
          documents: dict.documentKind,
          agreeTerms: dict.member.agreeTerms,
          terms: dict.member.terms,
          submit: dict.member.submitApplication,
          back: dict.common.back,
          next: dict.common.next,
          optional: dict.common.optional,
        }}
      />
    </AuthShell>
  );
}
