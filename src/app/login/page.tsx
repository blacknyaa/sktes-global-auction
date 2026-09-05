import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { FormNotice } from "@/components/form";
import { getDictionary } from "@/i18n";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "ログイン" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const dict = await getDictionary();
  const { reset } = await searchParams;

  return (
    <AuthShell
      title={dict.auth.loginTitle}
      lead={dict.auth.loginLead}
      footer={
        <div className="space-y-1.5">
          <p>
            <Link href="/forgot-password" className="font-medium text-brand hover:underline">
              {dict.auth.forgot}
            </Link>
          </p>
          <p className="text-muted">
            {dict.auth.noAccount}{" "}
            <Link href="/register" className="font-medium text-brand hover:underline">
              {dict.auth.registerLink}
            </Link>
          </p>
        </div>
      }
    >
      {reset === "1" && (
        <div className="mb-4">
          <FormNotice tone="success">{dict.auth.demoResetDone}</FormNotice>
        </div>
      )}

      <LoginForm
        labels={{
          email: dict.auth.email,
          password: dict.auth.password,
          signIn: dict.auth.signIn,
          invalid: dict.auth.invalidCredentials,
          locked: dict.auth.accountLocked,
          disabled: dict.auth.accountDisabled,
        }}
        presets={[
          { label: dict.role.ADMIN, email: "admin@sktes-demo.com" },
          { label: dict.role.SELLER, email: "seller@sktes-demo.com" },
          { label: dict.role.BIDDER, email: "buyer@sktes-demo.com" },
        ]}
      />
    </AuthShell>
  );
}
