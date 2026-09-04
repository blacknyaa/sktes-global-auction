import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { FormError } from "@/components/form";
import { getDictionary } from "@/i18n";

export const metadata: Metadata = { title: "アクセス権限がありません" };

export default async function DeniedPage() {
  const dict = await getDictionary();
  return (
    <AuthShell title="403">
      <div className="space-y-4">
        <FormError>
          このページを表示する権限がありません。別の役割のアカウントでお試しください。
        </FormError>
        <Link href="/dashboard" className="btn btn-primary w-full">
          {dict.nav.dashboard}
        </Link>
      </div>
    </AuthShell>
  );
}
