import { SortableHeader } from "@/components/sortable-header";
import { formatBookingDate, formatRelativeAge } from "@/components/date-formatters";
import { unblockSlotAction } from "./blocks.actions";
import type { SlotBlockRow } from "@/server/queries";

export function BlocksTable({
  blocks,
  sort = "date",
  dir = "asc",
  baseUrl = "/blocks",
  searchParams,
}: {
  blocks: SlotBlockRow[];
  sort?: "date" | "reason" | "created";
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
                label="Jadwal Diblokir"
                sortKey="date"
                currentSort={sort}
                currentDir={dir}
                baseUrl={baseUrl}
                searchParams={searchParams}
              />
            </th>
            <th scope="col" className="px-4 py-3">
              <SortableHeader
                label="Alasan"
                sortKey="reason"
                currentSort={sort}
                currentDir={dir}
                baseUrl={baseUrl}
                searchParams={searchParams}
              />
            </th>
            <th scope="col" className="px-4 py-3">
              <SortableHeader
                label="Waktu Dibuat"
                sortKey="created"
                currentSort={sort}
                currentDir={dir}
                baseUrl={baseUrl}
                searchParams={searchParams}
                defaultDir="desc"
              />
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {blocks.map((block) => {
            const formattedDate = formatBookingDate(block.block_date);
            const age = formatRelativeAge(block.created_at);

            return (
              <tr key={block.id} className="transition-colors duration-150 hover:bg-ground/50">
                <td className="whitespace-nowrap px-4 py-3 font-medium">
                  <div className="font-semibold text-ink">{formattedDate}</div>
                  <div className="font-mono text-xs font-bold text-accent">{block.time_slot}</div>
                </td>
                <td className="px-4 py-3 text-ink">
                  {block.reason ? (
                    <span>{block.reason}</span>
                  ) : (
                    <span className="text-xs text-ink-muted italic">Tanpa catatan alasan</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-muted">{age}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <form action={unblockSlotAction} className="inline-block">
                    <input type="hidden" name="id" value={block.id} />
                    <button
                      type="submit"
                      className="inline-flex min-h-[36px] items-center rounded-control border border-red-border bg-red-bg px-3 py-1.5 text-xs font-medium text-red-ink transition-colors duration-150 hover:bg-red-border/20 active:scale-95"
                    >
                      Buka Blokir
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
