"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cancelBidAction, placeBidAction, type BidState } from "./actions";
import { FormError, FormNotice } from "@/components/form";

export type BidLabels = {
  panelTitle: string;
  amount: string;
  place: string;
  rebid: string;
  cancel: string;
  yourBid: string;
  yourBidSealed: string;
  sealedNotice: string;
  commitment: string;
  submitted: string;
  cancelled: string;
  extensionFired: string;
  minimumBid: string;
  errors: Record<string, string>;
};

function Submit({ label, variant = "btn-primary" }: { label: string; variant?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn ${variant} w-full`} disabled={pending}>
      {pending ? "..." : label}
    </button>
  );
}

export function BidPanel({
  lotId,
  labels,
  minimumBid,
  currency,
  existing,
}: {
  lotId: string;
  labels: BidLabels;
  minimumBid: number;
  currency: string;
  existing: { submittedAt: string; commitmentHash: string; sequence: number } | null;
}) {
  const [state, action] = useActionState<BidState, FormData>(placeBidAction, {});
  const [cancelState, cancelAction] = useActionState<BidState, FormData>(
    cancelBidAction,
    {}
  );

  const err = state.error ?? cancelState.error;

  return (
    <div className="space-y-4">
      {err && <FormError>{labels.errors[err] ?? labels.errors.AMOUNT}</FormError>}
      {state.ok === "SUBMITTED" && (
        <FormNotice tone="success">{labels.submitted}</FormNotice>
      )}
      {state.ok === "EXTENDED" && (
        <FormNotice tone="warn">
          {labels.submitted} {labels.extensionFired}
        </FormNotice>
      )}
      {cancelState.ok === "CANCELLED" && (
        <FormNotice tone="success">{labels.cancelled}</FormNotice>
      )}

      {existing && (
        <div className="rounded-lg border border-seal/25 bg-seal-bg p-3.5">
          <p className="flex items-center gap-2 text-sm font-bold text-seal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
            </svg>
            {labels.yourBid} #{existing.sequence}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-seal/90">
            {labels.yourBidSealed}
          </p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-seal/70">
            {labels.commitment}
          </p>
          <p className="break-all font-mono text-[11px] text-seal">
            {existing.commitmentHash}
          </p>
        </div>
      )}

      <form action={action} className="space-y-3">
        <input type="hidden" name="lotId" value={lotId} />
        <div>
          <label className="label" htmlFor="amount">
            {labels.amount} ({currency})
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min={minimumBid / 100}
            step="0.01"
            required
            className="input tnum text-lg font-bold"
            placeholder={String(Math.round(minimumBid / 100))}
          />
          <p className="mt-1 text-xs text-muted">
            {labels.minimumBid}:{" "}
            <span className="tnum">
              {(minimumBid / 100).toLocaleString()} {currency}
            </span>
          </p>
        </div>
        <Submit label={existing ? labels.rebid : labels.place} />
      </form>

      {existing && (
        <form action={cancelAction}>
          <input type="hidden" name="lotId" value={lotId} />
          <Submit label={labels.cancel} variant="btn-danger" />
        </form>
      )}

      <p className="rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">
        {labels.sealedNotice}
      </p>
    </div>
  );
}
