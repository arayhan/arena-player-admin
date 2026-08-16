import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import type { BookingRow } from "@/server/queries";
import { formatBookingDate, formatRelativeAge } from "./booking-formatters";

export function BookingsTable({ bookings }: { bookings: BookingRow[] }) {
  return (
    <div className="w-full overflow-x-auto rounded-panel border border-border bg-surface">
      <table className="w-full text-left text-sm text-ink">
        <thead className="border-b border-border bg-sidebar text-xs font-semibold uppercase tracking-wider text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-3">
              Jadwal
            </th>
            <th scope="col" className="px-4 py-3">
              Pemesan
            </th>
            <th scope="col" className="px-4 py-3">
              Status
            </th>
            <th scope="col" className="px-4 py-3">
              Umur
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
                  <div className="text-xs text-ink-muted">{booking.time_slot}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{booking.team_name}</div>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center text-xs font-normal text-accent underline underline-offset-2 hover:text-accent-hover"
                  >
                    {booking.phone}
                  </a>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusPill status={booking.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-muted">{age}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="inline-flex min-h-[44px] items-center rounded-control bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
                  >
                    Detail
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
