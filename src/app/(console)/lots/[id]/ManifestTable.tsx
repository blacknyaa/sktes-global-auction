"use client";

import { useMemo, useState } from "react";

export type ManifestLine = {
  lineNo: number;
  maker: string;
  model: string;
  cpu: string | null;
  ramGb: number | null;
  storage: string | null;
  gpu: string | null;
  screen: string | null;
  grade: string | null;
  quantity: number;
  note: string | null;
};

export function ManifestTable({
  lines,
  labels,
}: {
  lines: ManifestLine[];
  labels: {
    filter: string;
    maker: string;
    model: string;
    cpu: string;
    ram: string;
    storage: string;
    gpu: string;
    screen: string;
    grade: string;
    quantity: string;
    note: string;
    total: string;
    noData: string;
    lines: string;
  };
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return lines;
    return lines.filter((l) =>
      [l.maker, l.model, l.cpu, l.storage, l.gpu, l.screen, l.grade, l.note]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [lines, q]);

  const total = filtered.reduce((s, l) => s + l.quantity, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input max-w-64"
          placeholder={labels.filter}
        />
        <p className="tnum text-xs text-muted">
          {filtered.length} {labels.lines} · {total.toLocaleString()}{" "}
          {labels.quantity}
        </p>
      </div>

      <div className="table-wrap max-h-[28rem] overflow-y-auto">
        <table className="table">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-10">#</th>
              <th>{labels.maker}</th>
              <th>{labels.model}</th>
              <th>{labels.cpu}</th>
              <th className="text-right">{labels.ram}</th>
              <th>{labels.storage}</th>
              <th>{labels.gpu}</th>
              <th>{labels.screen}</th>
              <th>{labels.grade}</th>
              <th className="text-right">{labels.quantity}</th>
              <th>{labels.note}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.lineNo}>
                <td className="tnum text-muted">{l.lineNo}</td>
                <td className="whitespace-nowrap font-medium text-ink">{l.maker}</td>
                <td className="whitespace-nowrap text-ink-2">{l.model}</td>
                <td className="whitespace-nowrap text-ink-2">{l.cpu ?? "—"}</td>
                <td className="tnum text-right text-ink-2">
                  {l.ramGb ? `${l.ramGb}GB` : "—"}
                </td>
                <td className="whitespace-nowrap text-ink-2">{l.storage ?? "—"}</td>
                <td className="whitespace-nowrap text-ink-2">{l.gpu ?? "—"}</td>
                <td className="whitespace-nowrap text-ink-2">{l.screen ?? "—"}</td>
                <td>
                  {l.grade ? (
                    <span
                      className={
                        l.grade === "A"
                          ? "badge bg-success-bg text-success"
                          : l.grade === "B"
                            ? "badge bg-info-bg text-info"
                            : "badge bg-warn-bg text-warn"
                      }
                    >
                      {l.grade}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="tnum text-right font-semibold text-ink">
                  {l.quantity.toLocaleString()}
                </td>
                <td className="max-w-40 truncate text-xs text-muted">{l.note ?? ""}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="py-10 text-center text-muted">
                  {labels.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
