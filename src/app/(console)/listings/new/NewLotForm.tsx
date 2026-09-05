"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import {
  createLotAction,
  parseManifestAction,
  type CreateState,
  type ParseState,
} from "../actions";
import { FormError, FormNotice } from "@/components/form";
import { SubmitButton } from "@/components/SubmitButton";

export type NewLotLabels = {
  steps: [string, string, string];
  caseName: string;
  caseNameEn: string;
  description: string;
  category: string;
  condition: string;
  storageLocation: string;
  handoverLocation: string;
  uploadExcel: string;
  downloadTemplate: string;
  templateHint: string;
  parsePreview: string;
  parsedLines: string;
  parsedUnits: string;
  parseErrors: string;
  minimumBid: string;
  reserve: string;
  auctionType: string;
  sealed: string;
  openAuction: string;
  extension: string;
  extensionOn: string;
  extensionTrigger: string;
  extensionMinutes: string;
  startAt: string;
  endAt: string;
  timezoneNote: string;
  saveDraft: string;
  publish: string;
  back: string;
  next: string;
  import: string;
  timezone: string;
};

function Submit({
  label,
  name,
  value,
  variant = "btn-primary",
}: {
  label: string;
  name?: string;
  value?: string;
  variant?: string;
}) {
  return (
    <SubmitButton className={variant} name={name} value={value}>
      {label}
    </SubmitButton>
  );
}

export function NewLotForm({
  labels,
  categories,
  conditions,
  timezone,
  defaults,
}: {
  labels: NewLotLabels;
  categories: { value: string; label: string }[];
  conditions: { value: string; label: string }[];
  timezone: string;
  defaults: { startAt: string; endAt: string; storage: string; handover: string };
}) {
  const [step, setStep] = useState(0);
  const [parseState, parseAction] = useActionState<ParseState, FormData>(
    parseManifestAction,
    {}
  );
  const [createState, createAction] = useActionState<CreateState, FormData>(
    createLotAction,
    {}
  );

  const rows = parseState.rows ?? [];
  const hasRows = rows.length > 0;

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-2">
        {labels.steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={clsx(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                i < step
                  ? "bg-success-bg text-success"
                  : i === step
                    ? "bg-brand text-on-brand"
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
            {i < 2 && <span className="h-px flex-1 bg-line" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {/* ---- step 2 lives in its own form because it uploads a file ---- */}
      {step === 1 && (
        <form action={parseAction} className="card space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink">{labels.steps[1]}</h2>
            <a href="/api/manifest-template" className="btn btn-ghost" download>
              {labels.downloadTemplate}
            </a>
          </div>
          <p className="text-xs leading-relaxed text-muted">{labels.templateHint}</p>

          <input
            type="file"
            name="manifest"
            accept=".xlsx,.xls,.csv"
            required
            className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-on-brand hover:file:bg-brand-hover"
          />

          {parseState.message && <FormError>{parseState.message}</FormError>}

          <Submit label={labels.import} />

          {hasRows && (
            <div className="space-y-3 border-t border-line pt-4">
              <FormNotice tone="success">
                {labels.parsedLines}: {rows.length} · {labels.parsedUnits}:{" "}
                {(parseState.totalUnits ?? 0).toLocaleString()}
              </FormNotice>

              <div className="table-wrap max-h-72 overflow-y-auto">
                <table className="table">
                  <thead className="sticky top-0">
                    <tr>
                      <th>#</th>
                      <th>Maker</th>
                      <th>Model</th>
                      <th>CPU</th>
                      <th className="text-right">RAM</th>
                      <th>Storage</th>
                      <th>Grade</th>
                      <th className="text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((r) => (
                      <tr key={r.lineNo}>
                        <td className="tnum text-muted">{r.lineNo}</td>
                        <td className="font-medium text-ink">{r.maker}</td>
                        <td className="text-ink-2">{r.model}</td>
                        <td className="text-ink-2">{r.cpu ?? "—"}</td>
                        <td className="tnum text-right text-ink-2">
                          {r.ramGb ? `${r.ramGb}GB` : "—"}
                        </td>
                        <td className="text-ink-2">{r.storage ?? "—"}</td>
                        <td className="text-ink-2">{r.grade ?? "—"}</td>
                        <td className="tnum text-right font-semibold text-ink">
                          {r.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parseState.errors && parseState.errors.length > 0 && (
                <div className="rounded-lg border border-warn/30 bg-warn-bg p-3">
                  <p className="text-xs font-bold text-warn">
                    {labels.parseErrors}: {parseState.errors.length}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {parseState.errors.slice(0, 8).map((e, i) => (
                      <li key={i} className="text-xs text-warn">
                        row {e.row}: {e.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </form>
      )}

      {/* ---- the main form carries steps 1 and 3 ---- */}
      <form action={createAction} className="space-y-6">
        <input type="hidden" name="rows" value={JSON.stringify(rows)} />
        <input type="hidden" name="storageKey" value={parseState.storageKey ?? ""} />
        <input type="hidden" name="fileName" value={parseState.fileName ?? ""} />

        {createState.error && <FormError>{createState.error}</FormError>}

        {/* step 1 */}
        <div className={step === 0 ? "card space-y-4 p-6" : "hidden"}>
          <h2 className="text-base font-bold text-ink">{labels.steps[0]}</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="title">
                {labels.caseName}
              </label>
              <input id="title" name="title" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="titleEn">
                {labels.caseNameEn}
              </label>
              <input id="titleEn" name="titleEn" required className="input" />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="description">
              {labels.description}
            </label>
            <textarea id="description" name="description" rows={3} className="input resize-y" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="categoryCode">
                {labels.category}
              </label>
              <select id="categoryCode" name="categoryCode" required className="input">
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="condition">
                {labels.condition}
              </label>
              <select id="condition" name="condition" required className="input">
                {conditions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="storageLocation">
                {labels.storageLocation}
              </label>
              <input
                id="storageLocation"
                name="storageLocation"
                required
                defaultValue={defaults.storage}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="handoverLocation">
                {labels.handoverLocation}
              </label>
              <input
                id="handoverLocation"
                name="handoverLocation"
                required
                defaultValue={defaults.handover}
                className="input"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" className="btn btn-primary" onClick={() => setStep(1)}>
              {labels.next}
            </button>
          </div>
        </div>

        {/* step 2 navigation */}
        {step === 1 && (
          <div className="flex justify-between">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
              {labels.back}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!hasRows}
              onClick={() => setStep(2)}
            >
              {labels.next}
            </button>
          </div>
        )}

        {/* step 3 */}
        <div className={step === 2 ? "card space-y-4 p-6" : "hidden"}>
          <h2 className="text-base font-bold text-ink">{labels.steps[2]}</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="minimumBid">
                {labels.minimumBid} (USD)
              </label>
              <input
                id="minimumBid"
                name="minimumBid"
                type="number"
                min={0}
                step={100}
                defaultValue={0}
                className="input tnum"
              />
            </div>
            <div>
              <label className="label" htmlFor="reserve">
                {labels.reserve} (USD)
              </label>
              <input
                id="reserve"
                name="reserve"
                type="number"
                min={0}
                step={100}
                className="input tnum"
              />
            </div>
          </div>

          <fieldset>
            <legend className="label">{labels.auctionType}</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input type="radio" name="auctionType" value="SEALED" defaultChecked />
                {labels.sealed}
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input type="radio" name="auctionType" value="OPEN" />
                {labels.openAuction}
              </label>
            </div>
          </fieldset>

          <div className="rounded-lg border border-line bg-surface-2 p-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input type="checkbox" name="extensionEnabled" defaultChecked />
              {labels.extensionOn}
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="extensionTriggerMin">
                  {labels.extensionTrigger}
                </label>
                <input
                  id="extensionTriggerMin"
                  name="extensionTriggerMin"
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={5}
                  className="input tnum"
                />
              </div>
              <div>
                <label className="label" htmlFor="extensionMinutes">
                  {labels.extensionMinutes}
                </label>
                <input
                  id="extensionMinutes"
                  name="extensionMinutes"
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={5}
                  className="input tnum"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="startAt">
                {labels.startAt}
              </label>
              <input
                id="startAt"
                name="startAt"
                type="datetime-local"
                required
                defaultValue={defaults.startAt}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="endAt">
                {labels.endAt}
              </label>
              <input
                id="endAt"
                name="endAt"
                type="datetime-local"
                required
                defaultValue={defaults.endAt}
                className="input"
              />
            </div>
          </div>

          <p className="rounded-lg bg-info-bg px-3 py-2 text-xs leading-relaxed text-info">
            {labels.timezoneNote} ({labels.timezone}: {timezone})
          </p>

          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
              {labels.back}
            </button>
            <div className="flex gap-2">
              <Submit label={labels.saveDraft} name="publish" value="0" variant="btn-ghost" />
              <Submit label={labels.publish} name="publish" value="1" />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
