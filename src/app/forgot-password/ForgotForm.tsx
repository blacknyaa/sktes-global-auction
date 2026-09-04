"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { forgotAction, type ForgotState } from "./actions";
import { FormError, FormNotice } from "@/components/form";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "..." : label}
    </button>
  );
}

export function ForgotForm({
  labels,
}: {
  labels: {
    email: string;
    send: string;
    sent: string;
    invalid: string;
    demoNotice: string;
  };
}) {
  const [state, action] = useActionState<ForgotState, FormData>(forgotAction, {});

  if (state.sent) {
    return (
      <div className="space-y-4">
        <FormNotice tone="success">{labels.sent}</FormNotice>
        {state.demoLink && (
          <div className="rounded-lg border border-dashed border-warn/40 bg-warn-bg p-3">
            <p className="text-xs font-semibold text-warn">{labels.demoNotice}</p>
            <Link
              href={state.demoLink}
              className="mt-1.5 block break-all font-mono text-xs font-semibold text-brand hover:underline"
            >
              {state.demoLink}
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && <FormError>{labels.invalid}</FormError>}
      <div>
        <label className="label" htmlFor="email">
          {labels.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="input"
          placeholder="you@example.com"
        />
      </div>
      <Submit label={labels.send} />
    </form>
  );
}
