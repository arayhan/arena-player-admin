import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import { SortableHeader } from "@/components/sortable-header";
import type { BookingRow, SortDir, SortKey } from "@/server/queries";
import { formatBookingDate, formatRelativeAge } from "./booking-formatters";
import { confirmBookingAction, rejectBookingAction } from "./bookings.actions";

export function BookingsTable({
  bookings,
  returnUrl,
  sort = "when",
  dir = "asc",
  baseUrl = "/bookings",
  searchParams,
}: {
  bookings: BookingRow[];
  returnUrl?: string;
  sort?: SortKey;
  dir?: SortDir;
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
                label="Jadwal"
                sortKey="when"
                currentSort={sort}
                currentDir={dir}
                baseUrl={baseUrl}
                searchParams={searchParams}
              />
            </th>
            <th scope="col" className="px-4 py-3">
              <SortableHeader
                label="Pemesan"
                sortKey="team"
                currentSort={sort}
                currentDir={dir}
                baseUrl={baseUrl}
                searchParams={searchParams}
              />
            </th>
            <th scope="col" className="px-4 py-3">
              <SortableHeader
                label="Status"
                sortKey="status"
                currentSort={sort}
                currentDir={dir}
                baseUrl={baseUrl}
                searchParams={searchParams}
              />
            </th>
            <th scope="col" className="px-4 py-3">
              <SortableHeader
                label="Umur"
                sortKey="created"
                currentSort={sort}
                currentDir={dir}
                baseUrl={baseUrl}
                searchParams={searchParams}
                defaultDir="desc"
              />
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Tindakan
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {bookings.map((booking) => {
            const formattedDate = formatBookingDate(booking.booking_date);
            const age = formatRelativeAge(booking.created_at);
            const waLink = `https://wa.me/${booking.phone}`;

            return (
              <tr key={booking.id} className="transition-colors duration-150 hover:bg-ground/50">
                <td className="whitespace-nowrap px-4 py-3 font-medium">
                  <div className="font-semibold text-ink">{formattedDate}</div>
                  <div className="font-mono text-xs text-ink-muted">{booking.time_slot}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{booking.team_name}</div>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[32px] items-center text-xs font-normal text-accent underline underline-offset-2 hover:text-accent-hover"
                  >
                    {booking.phone}
                  </a>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusPill status={booking.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-muted">{age}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {booking.status === "pending" && (
                      <>
                        <form action={confirmBookingAction} className="inline-block">
                          <input type="hidden" name="id" value={booking.id} />
                          {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
                          <button
                            type="submit"
                            title="Konfirmasi Booking (Kunci Slot)"
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-control bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors duration-150 hover:bg-green-700 active:scale-95"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              className="h-3.5 w-3.5"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Terima</span>
                          </button>
                        </form>

                        <form action={rejectBookingAction} className="inline-block">
                          <input type="hidden" name="id" value={booking.id} />
                          {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
                          <button
                            type="submit"
                            title="Tolak Booking"
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-control border border-red-border bg-red-bg px-2.5 py-1.5 text-xs font-semibold text-red-ink transition-colors duration-150 hover:bg-red-border/20 active:scale-95"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              className="h-3.5 w-3.5"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            <span>Tolak</span>
                          </button>
                        </form>
                      </>
                    )}

                    {booking.status === "confirmed" && (
                      <form action={rejectBookingAction} className="inline-block">
                        <input type="hidden" name="id" value={booking.id} />
                        {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
                        <button
                          type="submit"
                          title="Batalkan / Tolak Booking"
                          className="inline-flex min-h-[36px] items-center rounded-control border border-red-border bg-red-bg px-2.5 py-1.5 text-xs font-medium text-red-ink transition-colors duration-150 hover:bg-red-border/20 active:scale-95"
                        >
                          Batalkan
                        </button>
                      </form>
                    )}

                    <Link
                      href={`/bookings/${booking.id}`}
                      className="inline-flex min-h-[36px] items-center rounded-control border border-border bg-ground px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-surface"
                    >
                      Detail
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
