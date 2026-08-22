import { SortableHeader } from "@/components/sortable-header";
import { formatBookingDate } from "@/components/date-formatters";
import type { PublicHolidayRow } from "@/server/queries";
import { deletePublicHolidayAction } from "./pricing.actions";

export function HolidaysTable({
  holidays,
  sort = "date",
  dir = "asc",
  baseUrl = "/pricing",
  searchParams,
}: {
  holidays: PublicHolidayRow[];
  sort?: "date" | "label";
  dir?: "asc" | "desc";
  baseUrl?: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <div className="w-full overflow-x-auto rounded-panel border border-border bg-surface shadow-xs">
      <table className="w-full text-left text-sm text-ink">
        <thead className="border-b border-border bg-sidebar text-xs font-semibold uppercase tracking-wider text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-3">
              <SortableHeader
                label="Tanggal Libur"
                sortKey="holiday_date"
                currentSort={sort === "date" ? "holiday_date" : sort}
                currentDir={dir}
                baseUrl={baseUrl}
                searchParams={searchParams}
              />
            </th>
            <th scope="col" className="px-4 py-3">
              <SortableHeader
                label="Keterangan Hari Libur"
                sortKey="holiday_label"
                currentSort={sort === "label" ? "holiday_label" : sort}
                currentDir={dir}
                baseUrl={baseUrl}
                searchParams={searchParams}
              />
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {holidays.map((holiday) => (
            <tr key={holiday.id} className="transition-colors hover:bg-ground/50">
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                {formatBookingDate(holiday.holiday_date)}
              </td>
              <td className="px-4 py-3 text-xs text-ink">{holiday.label}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <form action={deletePublicHolidayAction} className="inline-block">
                  <input type="hidden" name="id" value={holiday.id} />
                  <button
                    type="submit"
                    className="inline-flex min-h-[36px] items-center rounded-control border border-red-border bg-red-bg px-3 py-1.5 text-xs font-medium text-red-ink transition-colors duration-150 hover:bg-red-border/20 active:scale-95"
                  >
                    Hapus
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
