import Link from "next/link";

import type { BankAccountsFilter } from "./bank-accounts.schema";

export function BankAccountsFilters({
  currentFilter,
  actionPath = "/settings",
}: {
  currentFilter: BankAccountsFilter;
  actionPath?: string;
}) {
  const isFiltered =
    Boolean(currentFilter.q) ||
    currentFilter.status !== "all" ||
    currentFilter.sort !== "order" ||
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
          <label htmlFor="bank-q" className="font-semibold uppercase text-ink-muted">
            Cari Rekening
          </label>
          <input
            id="bank-q"
            type="text"
            name="bank_q"
            defaultValue={currentFilter.q ?? ""}
            placeholder="Cari bank, nomor, atau nama..."
            className="h-9 w-full rounded-control border border-input-border bg-surface px-2.5 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1 lg:col-span-3">
          <label htmlFor="bank-status" className="font-semibold uppercase text-ink-muted">
            Status Rekening
          </label>
          <select
            id="bank-status"
            name="bank_status"
            defaultValue={currentFilter.status}
            className="h-9 w-full rounded-control border border-input-border bg-surface px-2 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif Saja</option>
            <option value="inactive">Nonaktif Saja</option>
          </select>
        </div>

        {/* Sort */}
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label htmlFor="bank-sort" className="font-semibold uppercase text-ink-muted">
            Urutkan
          </label>
          <select
            id="bank-sort"
            name="bank_sort"
            defaultValue={currentFilter.sort}
            className="h-9 w-full rounded-control border border-input-border bg-surface px-2 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="order">Urutan Tampilan</option>
            <option value="bank">Nama Bank</option>
            <option value="holder">Nama Pemilik</option>
            <option value="number">Nomor Rekening</option>
            <option value="status">Status Aktif</option>
          </select>
        </div>

        {/* Dir */}
        <div className="flex flex-col gap-1 lg:col-span-1">
          <label htmlFor="bank-dir" className="font-semibold uppercase text-ink-muted">
            Arah
          </label>
          <select
            id="bank-dir"
            name="bank_dir"
            defaultValue={currentFilter.dir}
            className="h-9 w-full rounded-control border border-input-border bg-surface px-2 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="asc">↑ Asc</option>
            <option value="desc">↓ Desc</option>
          </select>
        </div>

        {/* Per Page */}
        <div className="flex flex-col gap-1 lg:col-span-2">
          <label htmlFor="bank-per-page" className="font-semibold uppercase text-ink-muted">
            Baris
          </label>
          <div className="flex items-center gap-1.5">
            <select
              id="bank-per-page"
              name="bank_per_page"
              defaultValue={currentFilter.per_page}
              className="h-9 w-full rounded-control border border-input-border bg-surface px-1 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="5">5 baris</option>
              <option value="10">10 baris</option>
              <option value="25">25 baris</option>
            </select>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-control bg-accent px-3 text-xs font-semibold text-accent-ink hover:bg-accent-hover active:scale-95"
            >
              Cari
            </button>
          </div>
        </div>
      </div>

      {isFiltered && (
        <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
          <span className="text-ink-muted">Filter aktif diterapkan.</span>
          <Link
            href={actionPath}
            className="rounded-control border border-border bg-surface px-2.5 py-1 text-ink-muted hover:bg-ground hover:text-ink"
          >
            Reset Filter
          </Link>
        </div>
      )}
    </form>
  );
}
