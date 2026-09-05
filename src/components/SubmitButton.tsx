"use client";

import { useFormStatus } from "react-dom";
import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Submit buttons that show they are working.
 *
 * Every server action in this app takes a round trip - opening a sealed lot
 * decrypts every bid, approving a member writes an audit row and queues a
 * notification. Without a pending state the button looks dead and people click
 * it twice, which is how duplicate awards and double payments happen.
 *
 * useFormStatus only reads the state of the form it sits inside, so each
 * button must be its own component rather than a prop on the page.
 */

function Spinner() {
  return (
    <svg
      className="size-3.5 shrink-0 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  children: ReactNode;
  /** Extra button classes, e.g. "btn-primary w-full". */
  className?: string;
  /** Shown instead of children while the action runs. */
  pendingLabel?: string;
  /** Submitted as the button value, for multi-action forms. */
  name?: string;
  value?: string;
  /** When set, the browser asks before submitting. */
  confirm?: string;
  disabled?: boolean;
  title?: string;
  /** Stable hook for the end-to-end tests, which must not depend on wording. */
  "data-testid"?: string;
};

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingLabel,
  name,
  value,
  confirm,
  disabled,
  title,
  "data-testid": testId,
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      title={title}
      data-testid={testId}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      onClick={
        confirm
          ? (e) => {
              if (!window.confirm(confirm)) e.preventDefault();
            }
          : undefined
      }
      className={clsx("btn", className)}
    >
      {pending && <Spinner />}
      <span>{pending ? (pendingLabel ?? children) : children}</span>
    </button>
  );
}

/**
 * Asks for a short piece of text before submitting and writes it into a hidden
 * field on the same form. Used for the cancellation reason on a listing, which
 * must be recorded but does not deserve a whole extra screen.
 */
export function PromptSubmitButton({
  children,
  className = "btn-danger",
  promptMessage,
  fieldName,
  required = true,
  pendingLabel,
}: Props & { promptMessage: string; fieldName: string; required?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={clsx("btn", className)}
      onClick={(e) => {
        const form = e.currentTarget.form;
        const answer = window.prompt(promptMessage);
        if (answer === null || (required && !answer.trim())) {
          e.preventDefault();
          return;
        }
        const field = form?.elements.namedItem(fieldName);
        if (field instanceof HTMLInputElement) field.value = answer;
      }}
    >
      {pending && <Spinner />}
      <span>{pending ? (pendingLabel ?? children) : children}</span>
    </button>
  );
}

/**
 * For forms whose whole point is one dangerous action. Same behaviour, but the
 * confirmation text is mandatory so it cannot be forgotten.
 */
export function DangerSubmitButton({
  children,
  confirm,
  className = "btn-danger",
  pendingLabel,
  name,
  value,
}: Props & { confirm: string }) {
  return (
    <SubmitButton
      className={className}
      confirm={confirm}
      pendingLabel={pendingLabel}
      name={name}
      value={value}
    >
      {children}
    </SubmitButton>
  );
}
