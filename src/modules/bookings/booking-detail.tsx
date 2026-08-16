import { StatusPill } from "@/components/status-pill";
import type { BookingRow } from "@/server/queries";
import { formatBookingDate, formatRelativeAge } from "./booking-formatters";
import { confirmBookingAction, rejectBookingAction } from "./bookings.actions";
import { ProofPanel } from "./proof-panel";

type BookingDetailProps = {
  booking: BookingRow;
  conflictMessage?: string | null;
  successMessage?: string | null;
};

export function BookingDetail({ booking, conflictMessage, successMessage }: BookingDetailProps) {
  const formattedDate = formatBookingDate(booking.booking_date);
  const age = formatRelativeAge(booking.created_at);
  const waLink = `https://wa.me/${booking.phone}`;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Conflict or Success Banner */}
      {conflictMessage && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-panel border border-amber-border bg-amber-bg p-4 text-sm font-medium text-amber-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5 flex-none">
            <path
              d="M12 9v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{conflictMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-panel border border-green-border bg-green-bg p-4 text-sm font-medium text-green-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5 flex-none">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            {successMessage === "confirmed"
              ? "Booking berhasil dikonfirmasi."
              : successMessage === "rejected"
                ? "Booking berhasil ditolak."
                : successMessage}
          </span>
        </div>
      )}

      {/* 2. Main Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Booking Info & Actions */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Header Card */}
          <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Jadwal Pertandingan
                </div>
                <h1 className="text-2xl font-bold text-ink">
                  {formattedDate} · {booking.time_slot}
                </h1>
              </div>
              <StatusPill status={booking.status} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="text-xs font-medium text-ink-muted">Nama Tim / Pemesan</span>
                <p className="text-base font-semibold text-ink">{booking.team_name}</p>
              </div>

              <div>
                <span className="text-xs font-medium text-ink-muted">Nomor WhatsApp</span>
                <p className="text-base font-semibold text-ink">
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center text-accent underline underline-offset-2 hover:text-accent-hover"
                  >
                    {booking.phone} &rarr;
                  </a>
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-ink-muted">Waktu Pemesanan</span>
                <p className="text-sm text-ink">
                  {booking.created_at} ({age})
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-ink-muted">Kunci Bukti Transfer</span>
                <p className="font-mono text-xs text-ink-muted">
                  {booking.proof_key ?? "Tidak ada"}
                </p>
              </div>
            </div>

            {/* Notes Section */}
            <div className="border-t border-border pt-4">
              <span className="text-xs font-semibold text-ink-muted uppercase">
                Catatan Pemesan
              </span>
              {booking.notes && booking.notes.trim().length > 0 ? (
                <p className="mt-1 rounded-control bg-ground p-3 text-sm text-ink whitespace-pre-wrap">
                  {booking.notes}
                </p>
              ) : (
                <p className="mt-1 text-sm text-ink-muted italic">Tidak ada catatan.</p>
              )}
            </div>
          </div>

          {/* Action Buttons Panel */}
          <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Tindakan Status
            </h2>

            {booking.status === "pending" && (
              <div className="flex flex-wrap items-center gap-3">
                <form action={confirmBookingAction}>
                  <input type="hidden" name="id" value={booking.id} />
                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] items-center rounded-control bg-accent px-6 py-2.5 text-sm font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
                  >
                    Konfirmasi Booking
                  </button>
                </form>

                <form action={rejectBookingAction}>
                  <input type="hidden" name="id" value={booking.id} />
                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] items-center rounded-control border border-red-border bg-red-bg px-6 py-2.5 text-sm font-medium text-red-ink transition-colors duration-150 hover:bg-red-border/20"
                  >
                    Tolak Booking
                  </button>
                </form>
              </div>
            )}

            {booking.status === "confirmed" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-green-ink font-medium">
                  Booking ini telah dikonfirmasi dan slot telah dikunci.
                </p>
                <form action={rejectBookingAction}>
                  <input type="hidden" name="id" value={booking.id} />
                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] items-center rounded-control border border-red-border bg-red-bg px-4 py-2 text-xs font-medium text-red-ink transition-colors duration-150 hover:bg-red-border/20"
                  >
                    Batalkan / Tolak Booking (Pembatalan 1x24 Jam)
                  </button>
                </form>
              </div>
            )}

            {booking.status === "rejected" && (
              <p className="text-sm text-ink-muted">
                Booking ini telah ditolak. Slot dibuka kembali untuk pemesan lain.
              </p>
            )}

            {booking.status === "expired" && (
              <p className="text-sm text-ink-muted">
                Booking ini telah kedaluwarsa karena tidak dikonfirmasi dalam batas waktu. Slot
                telah dibuka kembali.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Payment Proof Panel */}
        <div className="flex flex-col gap-3">
          <div className="rounded-panel border border-border bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Bukti Transfer
            </h2>
            <ProofPanel proofKey={booking.proof_key} teamName={booking.team_name} />
          </div>
        </div>
      </div>
    </div>
  );
}
