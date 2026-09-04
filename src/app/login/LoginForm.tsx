"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";
import { FormError } from "@/components/form";

type Labels = {
  email: string;
  password: string;
  signIn: string;
  invalid: string;
  locked: string;
  disabled: string;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "..." : label}
    </button>
  );
}

export function LoginForm({
  labels,
  presets,
}: {
  labels: Labels;
  presets: { label: string; email: string }[];
}) {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});

  const message =
    state.error === "LOCKED"
      ? labels.locked
      : state.error === "DISABLED"
        ? labels.disabled
        : state.error
          ? labels.invalid
          : null;

  return (
    <form action={action} className="space-y-4">
      {message && <FormError>{message}</FormError>}

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

      <div>
        <label className="label" htmlFor="password">
          {labels.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input"
          placeholder="••••••••"
        />
      </div>

      <Submit label={labels.signIn} />

      {presets.length > 0 && (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface-2 p-3">
          <p className="mb-2 text-xs font-semibold text-muted">
            Demo · one click to fill
          </p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.email}
                type="button"
                className="btn btn-subtle px-2.5 py-1 text-xs"
                onClick={() => {
                  const form = document.querySelector<HTMLFormElement>("form");
                  if (!form) return;
                  (form.elements.namedItem("email") as HTMLInputElement).value =
                    p.email;
                  (
                    form.elements.namedItem("password") as HTMLInputElement
                  ).value = "Demo!2026";
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
