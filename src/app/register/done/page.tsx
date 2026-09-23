import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { FormNotice } from "@/components/form";
import { getDictionary } from "@/i18n";
import { LOGIN_ID_PATTERN } from "@/lib/auth";

export const metadata: Metadata = { title: "仮登録を受け付けました" };

export default async function RegisterDonePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const dict = await getDictionary();
  const { id } = await searchParams;
  // Only ever echo back something shaped like an ID we would have issued.
  const loginId = id && LOGIN_ID_PATTERN.test(id) ? id : null;

  const steps = [
    { key: "PENDING", done: true },
    { key: "UNDER_REVIEW", done: false },
    { key: "APPROVED", done: false },
  ] as const;

  return (
    <AuthShell title={dict.member.doneTitle} lead={dict.member.doneLead}>
      <div className="space-y-5">
        {loginId && (
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
            <p className="text-xs font-semibold text-muted">
              {dict.member.yourLoginId}
            </p>
            <p className="select-all font-mono text-lg font-bold tracking-wide text-ink">
              {loginId}
            </p>
            <p className="mt-1 text-xs text-muted">
              {dict.member.yourLoginIdHint}
            </p>
          </div>
        )}

        <ol className="space-y-2">
          {steps.map((s) => (
            <li
              key={s.key}
              className="flex items-center gap-3 rounded-xl border border-line bg-gradient-to-r from-surface-2 to-brand-50/40 px-3.5 py-2.5"
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
