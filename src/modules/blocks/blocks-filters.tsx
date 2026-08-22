import Link from "next/link";

import type { BlocksFilter } from "./blocks.schema";
import { todayAtField } from "@/domain/dates";

export function BlocksFilters({
  currentFilter,
  actionPath = "/blocks",
}: {
  currentFilter: BlocksFilter;
  actionPath?: string;
}) {
  const isToday = currentFilter.from === todayAtField() && !currentFilter.to;
  const isAllDates = currentFilter.from === null && currentFilter.to === null;

  const isFiltered =
    !isAllDates ||
    Boolean(currentFilter.q) ||
    currentFilter.sort !== "date" ||
    currentFilter.dir !== "asc" ||
    currentFilter.per_page !== 25;

  return (
    <form
      method="GET"
      action={actionPath}
      className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-4 text-sm text-ink shadow-xs"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
        {/* Search */}
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
          <label
            htmlFor="block-filter-q"
            className="text-xs font-semibold uppercase text-ink-muted"
          >
            Cari Alasan / Jam
          </label>
          <input
            id="block-filter-q"
            type="text"
            name="q"
            defaultValue={currentFilter.q ?? ""}
            placeholder="Cari alasan atau jam slot..."
            className="h-10 w-full rounded-control border border-input-border bg-ground px-3 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label
            htmlFor="block-filter-from"
            className="text-xs font-semibold uppercase text-ink-muted"
          >
            Mulai Tanggal
          </label>
          <input
            id="block-filter-from"
            type="date"
            name="from"
            defaultValue={currentFilter.from ?? ""}
            className="h-10 w-full rounded-control border border-input-border bg-ground px-2.5 text-xs text-ink focus:border-accent focus:outline-none"
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label
            htmlFor="block-filter-to"
            className="text-xs font-semibold uppercase text-ink-muted"
          >
            Sampai Tanggal
          </label>
          <input
            id="block-filter-to"
            type="date"
            name="to"
            defaultValue={currentFilter.to ?? ""}
            className="h-10 w-full rounded-control border border-input-border bg-ground px-2.5 text-xs text-ink focus:border-accent focus:outline-none"
          />
        </div>

        {/* Sort */}
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label
            htmlFor="block-filter-sort"
            className="text-xs font-semibold uppercase text-ink-muted"
          >
            Urutkan
          </label>
          <select
            id="block-filter-sort"
            name="sort"
            defaultValue={currentFilter.sort}
            className="h-10 w-full rounded-control border border-input-border bg-ground px-2.5 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="date">Tanggal & Jam</option>
            <option value="reason">Alasan</option>
            <option value="created">Waktu Dibuat</option>
          </select>
        </div>

        {/* Dir */}
        <div className="flex flex-col gap-1.5 lg:col-span-1">
          <label
            htmlFor="block-filter-dir"
            className="text-xs font-semibold uppercase text-ink-muted"
          >
            Arah
          </label>
          <select
            id="block-filter-dir"
            name="dir"
            defaultValue={currentFilter.dir}
            className="h-10 w-full rounded-control border border-input-border bg-ground px-2 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="asc">↑ Asc</option>
            <option value="desc">↓ Desc</option>
          </select>
        </div>

        {/* Per Page */}
        <div className="flex flex-col gap-1.5 lg:col-span-1">
          <label
            htmlFor="block-filter-per-page"
            className="text-xs font-semibold uppercase text-ink-muted"
          >
            Baris
          </label>
          <select
            id="block-filter-per-page"
            name="per_page"
            defaultValue={currentFilter.per_page}
            className="h-10 w-full rounded-control border border-input-border bg-ground px-2 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {/* Row 2: Presets & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <button
            type="submit"
            name="from"
            value="all"
            className={`rounded-control border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
              isAllDates
                ? "border-accent bg-accent/10 text-accent font-bold"
                : "border-border bg-ground text-ink hover:bg-surface"
            }`}
          >
            Semua Tanggal
          </button>
          <button
            type="submit"
            name="from"
            value={todayAtField()}
            className={`rounded-control border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
              isToday
                ? "border-accent bg-accent/10 text-accent font-bold"
                : "border-border bg-ground text-ink hover:bg-surface"
            }`}
          >
            Hari Ini & Mendatang
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex min-h-[36px] items-center rounded-control bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink transition-colors duration-150 hover:bg-accent-hover active:scale-95"
          >
            Terapkan Filter
          </button>

          {isFiltered && (
            <Link
              href={actionPath}
              className="inline-flex min-h-[36px] items-center rounded-control border border-border bg-ground px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface hover:text-ink"
            >
              Reset
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
