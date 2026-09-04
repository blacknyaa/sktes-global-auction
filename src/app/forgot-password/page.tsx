import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { getDictionary } from "@/i18n";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "パスワードの再設定" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const dict = await getDictionary();
  return (
    <AuthShell
      title={dict.auth.resetTitle}
      lead={dict.auth.resetLead}
      footer={
        <Link href="/login" className="text-muted hover:text-brand hover:underline">
          {dict.auth.signIn}
        </Link>
      }
    >
      <ForgotForm
        labels={{
          email: dict.auth.email,
          send: dict.auth.sendLink,
          sent: dict.auth.resetSent,
          invalid: dict.auth.invalidCredentials,
          demoNotice: dict.auth.demoLinkNotice,
        }}
      />
    </AuthShell>
  );
}
