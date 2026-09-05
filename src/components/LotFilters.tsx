import Link from "next/link";
import { Card } from "./ui";

export type FilterOption = { value: string; label: string; count?: number };

export type FilterLabels = {
  keyword: string;
  keywordHint: string;
  specTitle: string;
  specLead: string;
  maker: string;
  model: string;
  cpu: string;
  minRam: string;
  hasGpu: string;
  category: string;
  condition: string;
  country: string;
  status: string;
  all: string;
  search: string;
  clear: string;
  sort: string;
  sortOptions: { value: string; label: string }[];
};

export function LotFilters({
  labels,
  categories,
  conditions,
  countries,
  statuses,
  current,
  action = "/lots",
  showStatus = true,
}: {
  labels: FilterLabels;
  categories: FilterOption[];
  conditions: FilterOption[];
  countries: FilterOption[];
  statuses: FilterOption[];
  current: Record<string, string | undefined>;
  action?: string;
  showStatus?: boolean;
}) {
  const specActive = Boolean(
    current.maker || current.model || current.cpu || current.minRam || current.gpuOnly
  );

  return (
    <Card as="section" className="mb-6 overflow-hidden">
      <form action={action} className="divide-y divide-line">
        <div className="h-0.5 bg-gradient-to-r from-brand-500 via-brand-300 to-transparent" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="q">
              {labels.keyword}
            </label>
            <input
              id="q"
              name="q"
              defaultValue={current.q ?? ""}
              className="input"
              placeholder={labels.keywordHint}
            />
          </div>

          <div>
            <label className="label" htmlFor="category">
              {labels.category}
            </label>
            <select id="category" name="category" defaultValue={current.category ?? ""} className="input">
              <option value="">{labels.all}</option>
              {categories.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                  {o.count !== undefined ? ` (${o.count})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="condition">
              {labels.condition}
            </label>
            <select id="condition" name="condition" defaultValue={current.condition ?? ""} className="input">
              <option value="">{labels.all}</option>
              {conditions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="country">
              {labels.country}
            </label>
            <select id="country" name="country" defaultValue={current.country ?? ""} className="input">
              <option value="">{labels.all}</option>
              {countries.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                  {o.count !== undefined ? ` (${o.count})` : ""}
                </option>
              ))}
            </select>
          </div>

          {showStatus && (
            <div>
              <label className="label" htmlFor="status">
                {labels.status}
              </label>
              <select id="status" name="status" defaultValue={current.status ?? ""} className="input">
                <option value="">{labels.all}</option>
                {statuses.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label" htmlFor="sort">
              {labels.sort}
            </label>
            <select id="sort" name="sort" defaultValue={current.sort ?? "endSoon"} className="input">
              {labels.sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* spec filter — the differentiator */}
        <details open={specActive} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 bg-brand-50 px-4 py-3 text-sm font-bold text-brand-800 hover:bg-brand-100">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="transition-transform group-open:rotate-90"
              aria-hidden="true"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
            {labels.specTitle}
            {specActive && (
              <span className="badge bg-brand text-on-brand">ON</span>
            )}
          </summary>

          <div className="border-t border-brand-100 bg-brand-50/60 px-4 pb-4 pt-3">
            <p className="mb-3 text-xs leading-relaxed text-brand-800/80">
              {labels.specLead}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="label" htmlFor="maker">
                  {labels.maker}
                </label>
                <input id="maker" name="maker" defaultValue={current.maker ?? ""} className="input" placeholder="Dell" />
              </div>
              <div>
                <label className="label" htmlFor="model">
                  {labels.model}
                </label>
                <input id="model" name="model" defaultValue={current.model ?? ""} className="input" placeholder="Latitude" />
              </div>
              <div>
                <label className="label" htmlFor="cpu">
                  {labels.cpu}
                </label>
                <input id="cpu" name="cpu" defaultValue={current.cpu ?? ""} className="input" placeholder="Core i7" />
              </div>
              <div>
                <label className="label" htmlFor="minRam">
                  {labels.minRam}
                </label>
                <input
                  id="minRam"
                  name="minRam"
                  type="number"
                  min={0}
                  step={8}
                  defaultValue={current.minRam ?? ""}
                  className="input tnum"
                  placeholder="16"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 pb-2 text-sm font-medium text-brand-800">
                  <input
                    type="checkbox"
                    name="gpuOnly"
                    value="1"
                    defaultChecked={current.gpuOnly === "1"}
                  />
                  {labels.hasGpu}
                </label>
              </div>
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <button type="submit" className="btn btn-primary">
            {labels.search}
          </button>
          <Link href={action} className="btn btn-ghost">
            {labels.clear}
          </Link>
        </div>
      </form>
    </Card>
  );
}
