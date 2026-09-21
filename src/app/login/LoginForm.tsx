"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { FormError } from "@/components/form";
import { SubmitButton } from "@/components/SubmitButton";

type Labels = {
  loginId: string;
  password: string;
  signIn: string;
  invalid: string;
  locked: string;
  disabled: string;
  demoFill: string;
};

function Submit({ label }: { label: string }) {
  return (
    <SubmitButton className="btn-primary w-full">{label}</SubmitButton>
  );
}

export function LoginForm({
  labels,
  presets,
}: {
  labels: Labels;
  presets: { label: string; loginId: string }[];
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
        <label className="label" htmlFor="loginId">
          {labels.loginId}
        </label>
        <input
          id="loginId"
          name="loginId"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="input"
          placeholder="admin"
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
        <div className="rounded-xl border border-dashed border-brand-200 bg-gradient-to-br from-surface-2 to-brand-50/60 p-3">
          <p className="mb-2 text-xs font-semibold text-muted">
            {labels.demoFill}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.loginId}
                type="button"
                className="btn btn-subtle px-2.5 py-1 text-xs"
                onClick={() => {
                  const form = document.querySelector<HTMLFormElement>("form");
                  if (!form) return;
                  (form.elements.namedItem("loginId") as HTMLInputElement).value =
                    p.loginId;
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
