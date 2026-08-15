import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import type { BookingRow } from "@/server/queries";
import { formatBookingDate, formatRelativeAge } from "./booking-formatters";

export function BookingCard({ booking }: { booking: BookingRow }) {
  const formattedDate = formatBookingDate(booking.booking_date);
  const age = formatRelativeAge(booking.created_at);
  const waLink = `https://wa.me/${booking.phone}`;

  return (
    <article className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4 text-ink">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-ink-muted">JADWAL</div>
          <div className="font-semibold text-ink">
            {formattedDate} · {booking.time_slot}
          </div>
        </div>
        <StatusPill status={booking.status} />
      </div>

      <div className="flex flex-col gap-1 border-t border-border pt-2 text-sm">
        <div className="flex justify-between items-baseline gap-2">
          <span className="font-medium text-ink">{booking.team_name}</span>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center text-xs font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            WhatsApp ({booking.phone})
          </a>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-ink-muted">
        <span>Dipesan {age}</span>
        <Link
          href={`/bookings/${booking.id}`}
          className="inline-flex min-h-[44px] items-center rounded-control bg-accent px-3 py-2 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
        >
          Lihat Detail
        </Link>
      </div>
    </article>
  );
}
