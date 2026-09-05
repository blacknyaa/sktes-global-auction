import clsx from "clsx";

/**
 * Charts.
 *
 * Deliberately single-hue. Every chart here shows one measure, so length and
 * position already carry the magnitude - adding a colour per category would
 * encode nothing and, when checked, the obvious status palette (green / amber /
 * red / blue / grey) failed colour-blind separation: red and amber came out
 * 2.7 ΔE apart under deuteranopia, where 8 is the floor. Identity is carried by
 * a direct label on every mark instead, which reads correctly for everyone and
 * prints in black and white.
 *
 * No chart library: these are a few dozen lines of SVG, they inherit the theme
 * tokens automatically, and they add nothing to the bundle.
 */

export type BarDatum = {
  label: string;
  value: number;
  hint?: string;
  href?: string;
};

export function BarList({
  data,
  formatValue = (n) => n.toLocaleString("en-US"),
  max,
  emptyLabel = "—",
  className,
}: {
  data: BarDatum[];
  formatValue?: (n: number) => string;
  max?: number;
  emptyLabel?: string;
  className?: string;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyLabel}</p>;
  }
  const ceiling = max ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className={clsx("space-y-2", className)}>
      {data.map((d) => {
        const pct = ceiling > 0 ? (d.value / ceiling) * 100 : 0;
        return (
          <li key={d.label} className="group">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-medium text-ink-2">
                {d.label}
              </span>
              <span className="tnum shrink-0 text-xs font-bold text-ink">
                {formatValue(d.value)}
                {d.hint && (
                  <span className="ml-1.5 font-normal text-muted">{d.hint}</span>
                )}
              </span>
            </div>
            <div
              className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-3"
              role="img"
              aria-label={`${d.label}: ${formatValue(d.value)}`}
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${Math.max(pct, d.value > 0 ? 1.5 : 0)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type TrendPoint = { label: string; value: number };

/**
 * Area + line over time, single series, so no legend - the card title names it.
 * Values are labelled at the endpoints only; a number on every point is noise.
 */
export function TrendChart({
  points,
  formatValue = (n) => n.toLocaleString("en-US"),
  height = 160,
  ariaLabel,
}: {
  points: TrendPoint[];
  formatValue?: (n: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  if (points.length < 2) {
    return <p className="py-10 text-center text-sm text-muted">—</p>;
  }

  const W = 640;
  const H = height;
  const padX = 8;
  const padTop = 18;
  const padBottom = 24;

  const max = Math.max(...points.map((p) => p.value), 1);
  const min = 0;
  const stepX = (W - padX * 2) / (points.length - 1);
  const scaleY = (v: number) =>
    H - padBottom - ((v - min) / (max - min || 1)) * (H - padTop - padBottom);

  const coords = points.map((p, i) => ({
    x: padX + i * stepX,
    y: scaleY(p.value),
    ...p,
  }));

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x},${H - padBottom} L${coords[0].x},${H - padBottom} Z`;

  const last = coords[coords.length - 1];
  const peak = coords.reduce((a, b) => (b.value > a.value ? b : a), coords[0]);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* recessive baseline */}
        <line
          x1={padX}
          x2={W - padX}
          y1={H - padBottom}
          y2={H - padBottom}
          stroke="var(--line)"
          strokeWidth="1"
        />

        <path d={area} fill="url(#trend-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {coords.map((c) => (
          <g key={c.label}>
            <circle
              cx={c.x}
              cy={c.y}
              r="4"
              fill="var(--surface)"
              stroke="var(--brand)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <title>{`${c.label}: ${formatValue(c.value)}`}</title>
          </g>
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{points[0].label}</span>
        <span className="tnum font-semibold text-ink">
          {formatValue(peak.value)} <span className="font-normal">peak</span>
        </span>
        <span>
          {last.label}{" "}
          <span className="tnum font-semibold text-ink">
            {formatValue(last.value)}
          </span>
        </span>
      </div>
    </figure>
  );
}

/** A compact horizontal proportion bar with the segments labelled beneath. */
export function ProportionBar({
  segments,
  formatValue = (n) => n.toLocaleString("en-US"),
}: {
  segments: { label: string; value: number }[];
  formatValue?: (n: number) => string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <p className="py-6 text-center text-sm text-muted">—</p>;

  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(s.value / total) * 100}%`,
              // one hue, stepped light to dark by position, so the ordering
              // itself is the encoding and no two steps rely on hue difference
              background: `color-mix(in srgb, var(--brand) ${100 - i * 13}%, var(--surface-3))`,
            }}
            title={`${s.label}: ${formatValue(s.value)}`}
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{
                background: `color-mix(in srgb, var(--brand) ${100 - i * 13}%, var(--surface-3))`,
              }}
              aria-hidden="true"
            />
            <span className="truncate text-ink-2">{s.label}</span>
            <span className="tnum ml-auto font-semibold text-ink">
              {formatValue(s.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
