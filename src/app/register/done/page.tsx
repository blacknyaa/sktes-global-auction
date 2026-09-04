import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { FormNotice } from "@/components/form";
import { getDictionary } from "@/i18n";

export const metadata: Metadata = { title: "仮登録を受け付けました" };

export default async function RegisterDonePage() {
  const dict = await getDictionary();

  const steps = [
    { key: "PENDING", done: true },
    { key: "UNDER_REVIEW", done: false },
    { key: "APPROVED", done: false },
  ] as const;

  return (
    <AuthShell title={dict.member.doneTitle} lead={dict.member.doneLead}>
      <div className="space-y-5">
        <ol className="space-y-2">
          {steps.map((s) => (
            <li
              key={s.key}
              className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5"
            >
              <span
                className={
                  s.done
                    ? "flex size-6 items-center justify-center rounded-full bg-success-bg text-xs font-bold text-success"
                    : "flex size-6 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-muted"
                }
              >
                {s.done ? "✓" : "·"}
              </span>
              <span className="text-sm font-medium text-ink">
                {dict.companyStatus[s.key]}
              </span>
            </li>
          ))}
        </ol>

        <FormNotice tone="warn">{dict.home.noticeBody}</FormNotice>

        <Link href="/login" className="btn btn-primary w-full">
          {dict.auth.signIn}
        </Link>
      </div>
    </AuthShell>
  );
}
