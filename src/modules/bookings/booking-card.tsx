import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import type { BookingRow } from "@/server/queries";
import { formatBookingDate, formatRelativeAge } from "./booking-formatters";
import { confirmBookingAction, rejectBookingAction } from "./bookings.actions";

export function BookingCard({ booking, returnUrl }: { booking: BookingRow; returnUrl?: string }) {
  const formattedDate = formatBookingDate(booking.booking_date);
  const age = formatRelativeAge(booking.created_at);
  const waLink = `https://wa.me/${booking.phone}`;

  return (
    <article className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4 text-ink shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-ink-muted">JADWAL</div>
          <div className="font-semibold text-ink">
            {formattedDate} · <span className="font-mono text-sm">{booking.time_slot}</span>
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
            className="inline-flex min-h-[32px] items-center text-xs font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            WhatsApp ({booking.phone})
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs text-ink-muted">
        <span>Dipesan {age}</span>
        <div className="flex items-center gap-1.5">
          {booking.status === "pending" && (
            <>
              <form action={confirmBookingAction}>
                <input type="hidden" name="id" value={booking.id} />
                {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
                <button
                  type="submit"
                  title="Konfirmasi Booking"
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

              <form action={rejectBookingAction}>
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
            <form action={rejectBookingAction}>
              <input type="hidden" name="id" value={booking.id} />
              {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
              <button
                type="submit"
                title="Batalkan Booking"
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
      </div>
    </article>
  );
}
