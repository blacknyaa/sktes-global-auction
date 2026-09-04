import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { FormError } from "@/components/form";
import { getDictionary } from "@/i18n";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "パスワードの再設定" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const dict = await getDictionary();

  if (!token) {
    return (
      <AuthShell title={dict.auth.resetTitle}>
        <div className="space-y-4">
          <FormError>{dict.auth.resetInvalid}</FormError>
          <Link href="/forgot-password" className="btn btn-ghost w-full">
            {dict.auth.sendLink}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={dict.auth.resetTitle}>
      <ResetForm
        token={token}
        labels={{
          newPassword: dict.auth.newPassword,
          confirm: dict.auth.confirmPassword,
          submit: dict.auth.setNewPassword,
          mismatch: dict.auth.passwordMismatch,
          policy: dict.auth.passwordPolicy,
          invalid: dict.auth.resetInvalid,
          done: dict.auth.resetDone,
          signIn: dict.auth.signIn,
        }}
      />
    </AuthShell>
  );
}
