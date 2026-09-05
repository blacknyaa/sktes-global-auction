"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  enableMfaAction,
  type SecurityState,
} from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

function Submit({ label, variant = "btn-primary" }: { label: string; variant?: string }) {
  return <SubmitButton className={variant}>{label}</SubmitButton>;
}

export function EnableMfaForm({
  labels,
}: {
  labels: { code: string; enable: string; invalid: string; enrolled: string };
}) {
  const [state, action] = useActionState<SecurityState, FormData>(
    enableMfaAction,
    {}
  );
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="mfa-code">
          {labels.code}
        </label>
        <input
          id="mfa-code"
          name="code"
          inputMode="numeric"
          maxLength={6}
          required
          className="input tnum w-36 text-center text-lg font-bold tracking-[0.3em]"
          placeholder="000000"
        />
      </div>
      <Submit label={labels.enable} />
      {state.error === "INVALID" && (
        <p className="w-full text-sm font-medium text-danger">{labels.invalid}</p>
      )}
      {state.ok && (
        <p className="w-full text-sm font-medium text-success">{labels.enrolled}</p>
      )}
    </form>
  );
}

export function ChangePasswordForm({
  labels,
}: {
  labels: {
    current: string;
    next: string;
    confirm: string;
    submit: string;
    mismatch: string;
    policy: string;
    wrongCurrent: string;
    changed: string;
  };
}) {
  const [state, action] = useActionState<SecurityState, FormData>(
    changePasswordAction,
    {}
  );
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="cur">
            {labels.current}
          </label>
          <input id="cur" name="current" type="password" required className="input" autoComplete="current-password" />
        </div>
        <div>
          <label className="label" htmlFor="nxt">
            {labels.next}
          </label>
          <input id="nxt" name="next" type="password" required className="input" autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="cfm">
            {labels.confirm}
          </label>
          <input id="cfm" name="confirm" type="password" required className="input" autoComplete="new-password" />
        </div>
      </div>
      <p className="text-xs text-muted">{labels.policy}</p>
      <div className="flex items-center gap-3">
        <Submit label={labels.submit} variant="btn-ghost" />
        {state.error === "MISMATCH" && (
          <span className="text-sm text-danger">{labels.mismatch}</span>
        )}
        {state.error === "POLICY" && (
          <span className="text-sm text-danger">{labels.policy}</span>
        )}
        {state.error === "CURRENT" && (
          <span className="text-sm text-danger">{labels.wrongCurrent}</span>
        )}
        {state.ok && <span className="text-sm text-success">{labels.changed}</span>}
      </div>
    </form>
  );
}
