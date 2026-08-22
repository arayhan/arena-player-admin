import Link from "next/link";

import type { HolidaysFilter } from "./pricing.schema";

export function HolidaysFilters({
  currentFilter,
  actionPath = "/pricing",
}: {
  currentFilter: HolidaysFilter;
  actionPath?: string;
}) {
  const isFiltered =
    Boolean(currentFilter.q) ||
    Boolean(currentFilter.from) ||
    Boolean(currentFilter.to) ||
    currentFilter.sort !== "date" ||
    currentFilter.dir !== "asc" ||
    currentFilter.per_page !== 10;

  return (
    <form
      method="GET"
      action={actionPath}
      className="flex flex-col gap-3 rounded-control border border-border bg-ground p-3 text-xs text-ink"
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
        {/* Search */}
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
          <label htmlFor="holidays-q" className="font-semibold uppercase text-ink-muted">
            Cari Hari Libur
          </label>
          <input
            id="holidays-q"
            type="text"
            name="holiday_q"
            defaultValue={currentFilter.q ?? ""}
            placeholder="Ketik nama libur atau tanggal..."
            className="h-9 w-full rounded-control border border-input-border bg-surface px-2.5 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label htmlFor="holidays-from" className="font-semibold uppercase text-ink-muted">
            Mulai Tanggal
          </label>
          <input
            id="holidays-from"
            type="date"
            name="holiday_from"
            defaultValue={currentFilter.from ?? ""}
            className="h-9 w-full rounded-control border border-input-border bg-surface px-2 text-xs text-ink focus:border-accent focus:outline-none"
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label htmlFor="holidays-to" className="font-semibold uppercase text-ink-muted">
            Sampai Tanggal
          </label>
          <input
            id="holidays-to"
            type="date"
            name="holiday_to"
            defaultValue={currentFilter.to ?? ""}
            className="h-9 w-full rounded-control border border-input-border bg-surface px-2 text-xs text-ink focus:border-accent focus:outline-none"
          />
        </div>

        {/* Sort */}
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label htmlFor="holidays-sort" className="font-semibold uppercase text-ink-muted">
            Urutkan
          </label>
          <select
            id="holidays-sort"
            name="holiday_sort"
            defaultValue={currentFilter.sort}
            className="h-9 w-full rounded-control border border-input-border bg-surface px-2 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="date">Tanggal Libur</option>
            <option value="label">Keterangan Nama</option>
          </select>
        </div>

        {/* Dir */}
        <div className="flex flex-col gap-1 lg:col-span-1">
          <label htmlFor="holidays-dir" className="font-semibold uppercase text-ink-muted">
            Arah
          </label>
          <select
            id="holidays-dir"
            name="holiday_dir"
            defaultValue={currentFilter.dir}
            className="h-9 w-full rounded-control border border-input-border bg-surface px-2 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="asc">↑ Asc</option>
            <option value="desc">↓ Desc</option>
          </select>
        </div>

        {/* Per Page */}
        <div className="flex flex-col gap-1 lg:col-span-1">
          <label htmlFor="holidays-per-page" className="font-semibold uppercase text-ink-muted">
            Baris
          </label>
          <select
            id="holidays-per-page"
            name="holiday_per_page"
            defaultValue={currentFilter.per_page}
            className="h-9 w-full rounded-control border border-input-border bg-surface px-1 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
        <button
          type="submit"
          className="inline-flex min-h-[32px] items-center rounded-control bg-accent px-3 py-1 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover active:scale-95"
        >
          Terapkan Filter Libur
        </button>

        {isFiltered && (
          <Link
            href={actionPath}
            className="rounded-control border border-border bg-surface px-2.5 py-1 text-ink-muted hover:bg-ground hover:text-ink"
          >
            Reset Filter
          </Link>
        )}
      </div>
    </form>
  );
}
