"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { registerAction, type RegisterState } from "./actions";
import { FormError } from "@/components/form";
import { SubmitButton } from "@/components/SubmitButton";

export type CountryOption = { code: string; name: string; region: string };

export type WizardLabels = {
  steps: [string, string, string];
  companyName: string;
  companyNameEn: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  corporateNumber: string;
  corporateNumberHint: string;
  hqAddress: string;
  branchAddress: string;
  exportDestinations: string;
  exportDestinationsHint: string;
  hasImportLicense: string;
  licenseYes: string;
  licenseNo: string;
  antiqueLicense: string;
  antiqueHint: string;
  password: string;
  passwordPolicy: string;
  docsLead: string;
  docRequired: string;
  docConditional: string;
  documents: Record<string, string>;
  agreeTerms: string;
  terms: string;
  submit: string;
  back: string;
  next: string;
  optional: string;
};

function Submit({ label }: { label: string }) {
  return <SubmitButton>{label}</SubmitButton>;
}

export function RegisterWizard({
  countries,
  labels,
}: {
  countries: CountryOption[];
  labels: WizardLabels;
}) {
  const [state, action] = useActionState<RegisterState, FormData>(
    registerAction,
    {}
  );
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState("");
  const [importLicense, setImportLicense] = useState<"yes" | "no">("no");
  const isJapan = country === "JP";

  const regions = Array.from(new Set(countries.map((c) => c.region)));

  return (
    <form action={action} className="space-y-6">
      {/* stepper */}
      <ol className="flex items-center gap-2">
        {labels.steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={clsx(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm transition-all",
                i < step
                  ? "bg-success-bg text-success"
                  : i === step
                    ? "bg-gradient-to-br from-brand-500 to-brand-600 text-white"
                    : "bg-surface-3 text-muted"
              )}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span
              className={clsx(
                "hidden text-xs font-semibold sm:block",
                i === step ? "text-ink" : "text-muted"
              )}
            >
              {s}
            </span>
            {i < labels.steps.length - 1 && (
              <span className="h-px flex-1 bg-line" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>

      {state.error && <FormError>{state.error}</FormError>}

      {/* ---------- step 1 ---------- */}
      <div className={step === 0 ? "space-y-4" : "hidden"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.companyName} required>
            <input name="companyName" required className="input" maxLength={160} />
          </Field>
          <Field label={labels.companyNameEn} required>
            <input
              name="companyNameEn"
              required
              className="input"
              maxLength={160}
              placeholder="Meridian IT Trading Pte Ltd"
            />
          </Field>
        </div>

        <Field label={labels.country} required>
          <select
            name="countryCode"
            required
            className="input"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">—</option>
            {regions.map((r) => (
              <optgroup key={r} label={r}>
                {countries
                  .filter((c) => c.region === r)
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.contactName} required>
            <input name="contactName" required className="input" />
          </Field>
          <Field label={labels.contactPhone} required>
            <input name="contactPhone" required className="input" placeholder="+65-6000-0000" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.contactEmail} required>
            <input name="contactEmail" type="email" required className="input" />
          </Field>
          <Field label={labels.password} required hint={labels.passwordPolicy}>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="input"
              autoComplete="new-password"
            />
          </Field>
        </div>

        <Field label={labels.corporateNumber} hint={labels.corporateNumberHint}>
          <input name="corporateNumber" className="input" maxLength={40} />
        </Field>

        <Field label={labels.hqAddress} required>
          <input name="hqAddress" required className="input" maxLength={240} />
        </Field>
        <Field label={labels.branchAddress} optional={labels.optional}>
          <input name="branchAddress" className="input" maxLength={240} />
        </Field>

        <Field
          label={labels.exportDestinations}
          hint={labels.exportDestinationsHint}
        >
          <select
            name="exportDestinations"
            multiple
            size={6}
            className="input h-auto"
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <fieldset>
          <legend className="label">{labels.hasImportLicense}</legend>
          <div className="flex gap-4">
            {(["yes", "no"] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm text-ink-2">
                <input
                  type="radio"
                  name="hasImportLicense"
                  value={v}
                  checked={importLicense === v}
                  onChange={() => setImportLicense(v)}
                />
                {v === "yes" ? labels.licenseYes : labels.licenseNo}
              </label>
            ))}
          </div>
        </fieldset>

        {isJapan && (
          <Field label={labels.antiqueLicense} required hint={labels.antiqueHint}>
            <input name="antiqueLicenseNo" className="input" maxLength={60} placeholder="第301234567890号" />
          </Field>
        )}

        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" onClick={() => setStep(1)}>
            {labels.next}
          </button>
        </div>
      </div>

      {/* ---------- step 2 ---------- */}
      <div className={step === 1 ? "space-y-4" : "hidden"}>
        <p className="text-sm text-ink-2">{labels.docsLead}</p>

        <DocField
          name="doc_registry"
          label={labels.documents.REGISTRY}
          tag={labels.docRequired}
          tone="required"
        />
        <DocField
          name="doc_id"
          label={labels.documents.ID_DOCUMENT}
          tag={labels.docRequired}
          tone="required"
        />
        {isJapan && (
          <DocField
            name="doc_antique"
            label={labels.documents.ANTIQUE_LICENSE}
            tag={labels.docConditional}
            tone="conditional"
          />
        )}
        {importLicense === "yes" && (
          <DocField
            name="doc_import"
            label={labels.documents.IMPORT_LICENSE}
            tag={labels.optional}
            tone="optional"
          />
        )}

        <div className="flex justify-between">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
            {labels.back}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
            {labels.next}
          </button>
        </div>
      </div>

      {/* ---------- step 3 ---------- */}
      <div className={step === 2 ? "space-y-4" : "hidden"}>
        <div className="rounded-lg border border-line bg-surface-2 p-4">
          <p className="text-sm font-semibold text-ink">{labels.terms}</p>
          <div className="mt-2 max-h-52 overflow-y-auto pr-2 text-xs leading-relaxed text-ink-2">
            <p>
              本規約は、SK TES Global Auction（以下「本サービス」）の利用条件を定めるものです。
              本サービスは、SK TESグループ各社が出品するIT機器を、審査を通過した法人バイヤーが
              入札・購入するための場を提供します。
            </p>
            <p className="mt-2">
              第1条（入札の拘束力）応札者が送信した入札は、入札締切をもって撤回できないものとし、
              落札の通知を受けた場合、応札者は当該条件で購入する義務を負います。
            </p>
            <p className="mt-2">
              第2条（落札者の決定）出品者は、必ずしも最高額の応札者を落札者としない場合があります。
              この場合、出品者は選定の理由を記録し、当社はこれを監査ログとして保管します。
            </p>
            <p className="mt-2">
              第3条（輸出入）応札者は、落札した商品の輸出入について、自国および仕向国の法令
              （輸出管理、環境規制、廃電気電子機器指令等）を遵守する責任を負います。
            </p>
            <p className="mt-2">
              第4条（古物営業法）日本国内のバイヤーは、古物営業法に基づく許可を受けていることを
              表明し、許可証の写しを提出するものとします。
            </p>
            <p className="mt-2">
              第5条（個人情報）当社は、提出された書類および担当者情報を、会員審査、取引の履行、
              および法令上の記録保持の目的に限り利用します。保存期間は最終取引から7年間です。
            </p>
            <p className="mt-2 font-semibold">
              ※ 本文はデモ用のサンプルであり、実際の契約条項ではありません。
            </p>
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-ink">
          <input type="checkbox" name="agree" className="mt-0.5" required />
          <span>{labels.agreeTerms}</span>
        </label>

        <div className="flex justify-between">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
            {labels.back}
          </button>
          <Submit label={labels.submit} />
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  required,
  optional,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: string;
  hint?: string;
}) {
  // Wrapping the control in the <label> associates the two without needing an
  // id on every field. A screen reader then announces "会社名, required, edit"
  // instead of just "edit", and clicking the caption focuses the input.
  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
        {optional && (
          <span className="ml-1 font-normal text-muted">（{optional}）</span>
        )}
      </span>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </label>
  );
}

function DocField({
  name,
  label,
  tag,
  tone,
}: {
  name: string;
  label: string;
  tag: string;
  tone: "required" | "conditional" | "optional";
}) {
  // A <label> around the whole card ties the caption to the file input, so the
  // control is announced as "会社登記簿謄本, 必須" rather than an unnamed button.
  return (
    <label className="block rounded-lg border border-line bg-surface-2 p-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span
          className={clsx(
            "badge",
            tone === "required"
              ? "bg-danger-bg text-danger"
              : tone === "conditional"
                ? "bg-warn-bg text-warn"
                : "bg-surface-3 text-muted"
          )}
        >
          {tag}
        </span>
      </div>
      <input
        type="file"
        name={name}
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-on-brand hover:file:bg-brand-hover"
      />
    </label>
  );
}
