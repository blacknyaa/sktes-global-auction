"use client";

import { useActionState } from "react";
import { mfaAction, type MfaState } from "../actions";
import { FormError } from "@/components/form";
import { SubmitButton } from "@/components/SubmitButton";

function Submit({ label }: { label: string }) {
  return (
    <SubmitButton className="btn-primary w-full">{label}</SubmitButton>
  );
}

export function MfaForm({
  labels,
}: {
  labels: { code: string; verify: string; invalid: string; expired: string };
}) {
  const [state, action] = useActionState<MfaState, FormData>(mfaAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error === "EXPIRED" && <FormError>{labels.expired}</FormError>}
      {state.error === "INVALID" && <FormError>{labels.invalid}</FormError>}

      <div>
        <label className="label" htmlFor="code">
          {labels.code}
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoFocus
          className="input tnum text-center text-2xl font-bold tracking-[0.4em]"
          placeholder="000000"
        />
      </div>

      <Submit label={labels.verify} />
    </form>
  );
}
