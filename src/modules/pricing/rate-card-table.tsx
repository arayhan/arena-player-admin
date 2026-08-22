import Link from "next/link";

import { Pagination } from "@/components/pagination";
import { SortableHeader } from "@/components/sortable-header";
import { TIME_SLOTS } from "@/domain/slots";
import type { RateCardRow } from "@/server/queries";
import { updateRatePriceAction } from "./pricing.actions";
import type { RateCardFilter } from "./pricing.schema";

export type SlotPricingItem = {
  slot: string;
  hour: number;
  isPhotoSlot: boolean;
  tierLabel: string;
  category: "morning" | "afternoon" | "night";
  weekdayPrice: number;
  weekendPrice: number;
};

export function RateCardTable({
  rateCard,
  filter,
  searchParams,
  baseUrl = "/pricing",
}: {
  rateCard: RateCardRow[];
  filter: RateCardFilter;
  searchParams?: Record<string, string | string[] | undefined>;
  baseUrl?: string;
}) {
  const priceFor = (slot: string, dayType: "weekday" | "weekend"): number => {
    const row = rateCard.find((r: RateCardRow) => r.time_slot === slot && r.day_type === dayType);
    return row ? row.price_rupiah : 200000;
  };

  // Build full list of items
  const allItems: SlotPricingItem[] = TIME_SLOTS.map((slot) => {
    const hour = parseInt(slot.split(":")[0] ?? "0", 10);
    const isPhotoSlot = hour >= 16;
    const category: "morning" | "afternoon" | "night" =
      hour < 16 ? "morning" : hour < 18 ? "afternoon" : "night";
    const tierLabel = hour < 16 ? "Pagi / Siang" : hour < 18 ? "Sore" : "Malam (Prime Time)";

    return {
      slot,
      hour,
      isPhotoSlot,
      tierLabel,
      category,
      weekdayPrice: priceFor(slot, "weekday"),
      weekendPrice: priceFor(slot, "weekend"),
    };
  });

  // Filter
  const filteredItems = allItems.filter((item) => {
    if (filter.q) {
      const qLower = filter.q.toLowerCase();
      const matchSlot = item.slot.toLowerCase().includes(qLower);
      const matchTier = item.tierLabel.toLowerCase().includes(qLower);
      const matchPromo = item.isPhotoSlot && "foto fotografer".includes(qLower);
      if (!matchSlot && !matchTier && !matchPromo) return false;
    }

    if (filter.category && filter.category !== "all") {
      if (filter.category === "photo" && !item.isPhotoSlot) return false;
      if (filter.category !== "photo" && item.category !== filter.category) return false;
    }

    return true;
  });

  // Sort
  const sortedItems = [...filteredItems].sort((a, b) => {
    let cmp = 0;
    if (filter.sort === "weekday") {
      cmp = a.weekdayPrice - b.weekdayPrice;
    } else if (filter.sort === "weekend") {
      cmp = a.weekendPrice - b.weekendPrice;
    } else {
      cmp = a.hour - b.hour;
    }
    return filter.dir === "desc" ? -cmp : cmp;
  });

  // Pagination
  const totalCount = sortedItems.length;
  const offset = (filter.page - 1) * filter.per_page;
  const paginatedItems = sortedItems.slice(offset, offset + filter.per_page);

  const isFiltered =
    Boolean(filter.q) ||
    filter.category !== "all" ||
    filter.sort !== "slot" ||
    filter.dir !== "asc" ||
    filter.per_page !== 18;

  return (
    <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
        <div>
          <h2 className="text-base font-bold text-ink">Daftar Slot Jam Operasional</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Ubah tarif per jam secara spesifik bila terdapat penyesuaian khusus pada slot tertentu.
          </p>
        </div>
        <span className="rounded-full border border-border bg-ground px-2.5 py-0.5 text-xs font-semibold text-ink">
          Total {totalCount} slot
        </span>
      </div>

      {/* Filter and Sort Toolbar */}
      <form
        method="GET"
        action={baseUrl}
        className="flex flex-col gap-3 rounded-control border border-border bg-ground p-3 text-xs text-ink"
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          {/* Search */}
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
            <label htmlFor="rate-q" className="font-semibold uppercase text-ink-muted">
              Cari Slot / Kategori
            </label>
            <input
              id="rate-q"
              type="text"
              name="q"
              defaultValue={filter.q ?? ""}
              placeholder="Contoh: 18:00, Malam, Foto..."
              className="h-9 w-full rounded-control border border-input-border bg-surface px-2.5 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1 lg:col-span-3">
            <label htmlFor="rate-cat" className="font-semibold uppercase text-ink-muted">
              Kategori Slot
            </label>
            <select
              id="rate-cat"
              name="category"
              defaultValue={filter.category}
              className="h-9 w-full rounded-control border border-input-border bg-surface px-2 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="all">Semua Kategori (18 Jam)</option>
              <option value="morning">Pagi / Siang (06.00–16.00)</option>
              <option value="afternoon">Sore (16.00–18.00)</option>
              <option value="night">Malam / Prime Time (18.00–24.00)</option>
              <option value="photo">📸 Free Fotografer Saja</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex flex-col gap-1 lg:col-span-2">
            <label htmlFor="rate-sort" className="font-semibold uppercase text-ink-muted">
              Urutkan
            </label>
            <select
              id="rate-sort"
              name="sort"
              defaultValue={filter.sort}
              className="h-9 w-full rounded-control border border-input-border bg-surface px-2 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="slot">Slot Jam</option>
              <option value="weekday">Harga Weekday</option>
              <option value="weekend">Harga Weekend</option>
            </select>
          </div>

          {/* Dir */}
          <div className="flex flex-col gap-1 lg:col-span-1">
            <label htmlFor="rate-dir" className="font-semibold uppercase text-ink-muted">
              Arah
            </label>
            <select
              id="rate-dir"
              name="dir"
              defaultValue={filter.dir}
              className="h-9 w-full rounded-control border border-input-border bg-surface px-2 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="asc">↑ Asc</option>
              <option value="desc">↓ Desc</option>
            </select>
          </div>

          {/* Per Page */}
          <div className="flex flex-col gap-1 lg:col-span-2">
            <label htmlFor="rate-per-page" className="font-semibold uppercase text-ink-muted">
              Baris
            </label>
            <div className="flex items-center gap-1.5">
              <select
                id="rate-per-page"
                name="per_page"
                defaultValue={filter.per_page}
                className="h-9 w-full rounded-control border border-input-border bg-surface px-2 text-xs text-ink focus:border-accent focus:outline-none"
              >
                <option value="6">6 baris</option>
                <option value="10">10 baris</option>
                <option value="18">18 baris (Semua)</option>
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
              href={baseUrl}
              className="rounded-control border border-border bg-surface px-2.5 py-1 text-ink-muted hover:bg-ground hover:text-ink"
            >
              Reset Filter
            </Link>
          </div>
        )}
      </form>

      {paginatedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-control border border-dashed border-border p-8 text-center text-xs text-ink-muted">
          <p className="font-semibold text-ink">Tidak ada slot yang cocok</p>
          <p className="mt-1">Coba sesuaikan kata kunci pencarian atau kategori filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-muted">
                <th className="py-2.5 pr-4">
                  <SortableHeader
                    label="Slot Jam"
                    sortKey="slot"
                    currentSort={filter.sort}
                    currentDir={filter.dir}
                    baseUrl={baseUrl}
                    searchParams={searchParams}
                  />
                </th>
                <th className="py-2.5 pr-4">Kategori & Promo</th>
                <th className="py-2.5 pr-4">
                  <SortableHeader
                    label="Weekday (Senin–Jumat)"
                    sortKey="weekday"
                    currentSort={filter.sort}
                    currentDir={filter.dir}
                    baseUrl={baseUrl}
                    searchParams={searchParams}
                  />
                </th>
                <th className="py-2.5 pr-4">
                  <SortableHeader
                    label="Weekend / Libur"
                    sortKey="weekend"
                    currentSort={filter.sort}
                    currentDir={filter.dir}
                    baseUrl={baseUrl}
                    searchParams={searchParams}
                  />
                </th>
                <th className="py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedItems.map((item) => (
                <tr key={item.slot} className="transition-colors hover:bg-ground/40">
                  <td className="py-3 pr-4 font-mono text-xs font-bold text-ink">{item.slot}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-ground px-2 py-0.5 text-[11px] font-medium text-ink-muted border border-border">
                        {item.tierLabel}
                      </span>
                      {item.isPhotoSlot && (
                        <span className="rounded bg-amber-bg px-1.5 py-0.5 text-[10px] font-semibold text-amber-ink">
                          📸 Fotografer
                        </span>
                      )}
                    </div>
                  </td>
                  <td colSpan={3} className="py-3">
                    <form
                      action={updateRatePriceAction}
                      className="flex items-center justify-between gap-3"
                    >
                      <input type="hidden" name="time_slot" value={item.slot} />

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-ink-muted">Rp</span>
                        <input
                          type="number"
                          name="price_weekday"
                          min={1}
                          step={1000}
                          defaultValue={item.weekdayPrice}
                          required
                          aria-label={`Harga weekday untuk slot ${item.slot}`}
                          className="h-9 w-28 rounded-control border border-border bg-ground px-2.5 font-mono text-xs font-semibold text-ink focus:border-accent focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-ink-muted">Rp</span>
                        <input
                          type="number"
                          name="price_weekend"
                          min={1}
                          step={1000}
                          defaultValue={item.weekendPrice}
                          required
                          aria-label={`Harga weekend atau libur untuk slot ${item.slot}`}
                          className="h-9 w-28 rounded-control border border-border bg-ground px-2.5 font-mono text-xs font-semibold text-ink focus:border-accent focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="inline-flex min-h-[36px] items-center rounded-control bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
                      >
                        Simpan
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <Pagination
        page={filter.page}
        perPage={filter.per_page}
        totalCount={totalCount}
        baseUrl={baseUrl}
        searchParams={searchParams}
        perPageOptions={[6, 10, 18]}
      />
    </div>
  );
}
