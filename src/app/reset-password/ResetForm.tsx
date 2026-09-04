"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetAction, type ResetState } from "./actions";
import { FormError, FormNotice } from "@/components/form";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "..." : label}
    </button>
  );
}

export function ResetForm({
  token,
  labels,
}: {
  token: string;
  labels: {
    newPassword: string;
    confirm: string;
    submit: string;
    mismatch: string;
    policy: string;
    invalid: string;
    done: string;
    signIn: string;
  };
}) {
  const [state, action] = useActionState<ResetState, FormData>(resetAction, {});

  if (state.done) {
    return (
      <div className="space-y-4">
        <FormNotice tone="success">{labels.done}</FormNotice>
        <Link href="/login" className="btn btn-primary w-full">
          {labels.signIn}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error === "MISMATCH" && <FormError>{labels.mismatch}</FormError>}
      {state.error === "POLICY" && <FormError>{labels.policy}</FormError>}
      {state.error === "INVALID" && <FormError>{labels.invalid}</FormError>}

      <div>
        <label className="label" htmlFor="password">
          {labels.newPassword}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="input"
        />
        <p className="mt-1 text-xs text-muted">{labels.policy}</p>
      </div>

      <div>
        <label className="label" htmlFor="confirm">
          {labels.confirm}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          className="input"
        />
      </div>

      <Submit label={labels.submit} />
    </form>
  );
}
