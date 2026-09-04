import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { getDictionary } from "@/i18n";
import { readMfaTicket } from "@/lib/auth";
import { MfaForm } from "./MfaForm";

export const metadata: Metadata = { title: "多要素認証" };
export const dynamic = "force-dynamic";

export default async function MfaPage() {
  const pending = await readMfaTicket();
  if (!pending) redirect("/login");
  const dict = await getDictionary();

  return (
    <AuthShell
      title={dict.auth.mfaTitle}
      lead={dict.auth.mfaLead}
      footer={
        <Link href="/login" className="text-muted hover:text-brand hover:underline">
          {dict.common.back}
        </Link>
      }
    >
      <MfaForm
        labels={{
          code: dict.auth.code,
          verify: dict.auth.verify,
          invalid: dict.auth.mfaInvalid,
          expired: dict.auth.mfaExpired,
        }}
      />
    </AuthShell>
  );
}
