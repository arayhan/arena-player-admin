import type { BookingsFilter } from "./bookings.schema";
import { todayAtField } from "@/domain/dates";

export function BookingsFilters({ currentFilter }: { currentFilter: BookingsFilter }) {
  const isToday = currentFilter.from === todayAtField() && !currentFilter.to;
  const isAllDates = currentFilter.from === null && currentFilter.to === null;

  return (
    <form
      method="GET"
      action="/bookings"
      className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-4 text-sm text-ink"
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Search text input */}
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={currentFilter.q ?? ""}
            placeholder="Cari tim atau no HP..."
            aria-label="Cari nama tim atau nomor HP"
            className="w-full rounded-control border border-input-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>

        {/* Date presets */}
        <div className="flex items-center gap-1 rounded-control border border-border p-1">
          <button
            type="submit"
            name="from"
            value={todayAtField()}
            className={`rounded-control px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              isToday ? "bg-accent text-accent-ink" : "text-ink hover:bg-ground"
            }`}
          >
            Hari Ini
          </button>
          <button
            type="submit"
            name="from"
            value="all"
            className={`rounded-control px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
              isAllDates ? "bg-accent text-accent-ink" : "text-ink hover:bg-ground"
            }`}
          >
            Semua Tanggal
          </button>
        </div>

        {/* Submit search button */}
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center rounded-control bg-accent px-4 py-2 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
        >
          Terapkan
        </button>
      </div>

      {/* Status Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs font-semibold text-ink-muted">STATUS:</span>
        {(
          [
            { label: "Menunggu", value: "pending" },
            { label: "Dikonfirmasi", value: "confirmed" },
            { label: "Ditolak", value: "rejected" },
            { label: "Kedaluwarsa", value: "expired" },
          ] as const
        ).map((item) => {
          const isSelected = currentFilter.status.includes(item.value);
          return (
            <button
              key={item.value}
              type="submit"
              name="status"
              value={item.value}
              className={`rounded-control border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                isSelected
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-border bg-surface text-ink hover:bg-ground"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </form>
  );
}
