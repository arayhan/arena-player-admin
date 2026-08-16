import Link from "next/link";

import { todayAtField } from "@/domain/dates";
import { TIME_SLOTS } from "@/domain/slots";
import { createBookingAction } from "./bookings.actions";

type BookingCreateFormProps = {
  errorMessage?: string | null;
};

export function BookingCreateForm({ errorMessage }: BookingCreateFormProps) {
  const today = todayAtField();

  return (
    <div className="flex flex-col gap-6">
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-panel border border-red-border bg-red-bg p-4 text-sm font-medium text-red-ink"
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
          <span>{errorMessage}</span>
        </div>
      )}

      <form
        action={createBookingAction}
        className="flex flex-col gap-6 rounded-panel border border-border bg-surface p-6 sm:p-8"
      >
        <div className="border-b border-border pb-4">
          <h1 className="text-xl font-bold text-ink">Tambah Booking Walk-in</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Input pemesanan langsung di lapangan (bayar tunai di kasir tanpa lampiran bukti
            transfer).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Tanggal Booking */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="booking_date"
              className="text-xs font-semibold uppercase text-ink-muted"
            >
              Tanggal Main <span className="text-red-ink">*</span>
            </label>
            <input
              id="booking_date"
              name="booking_date"
              type="date"
              defaultValue={today}
              min={today}
              required
              className="h-11 rounded-control border border-border bg-ground px-3 text-sm font-medium text-ink focus:border-accent focus:outline-none"
            />
          </div>

          {/* Slot Waktu */}
          <div className="flex flex-col gap-2">
            <label htmlFor="time_slot" className="text-xs font-semibold uppercase text-ink-muted">
              Pilihan Jam <span className="text-red-ink">*</span>
            </label>
            <select
              id="time_slot"
              name="time_slot"
              required
              defaultValue={TIME_SLOTS[0]}
              className="h-11 rounded-control border border-border bg-ground px-3 text-sm font-medium text-ink focus:border-accent focus:outline-none"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>

          {/* Nama Tim */}
          <div className="flex flex-col gap-2">
            <label htmlFor="team_name" className="text-xs font-semibold uppercase text-ink-muted">
              Nama Tim / Pemesan <span className="text-red-ink">*</span>
            </label>
            <input
              id="team_name"
              name="team_name"
              type="text"
              placeholder="Contoh: FC Garuda Utama"
              required
              maxLength={100}
              className="h-11 rounded-control border border-border bg-ground px-3 text-sm font-medium text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          {/* Nomor WhatsApp */}
          <div className="flex flex-col gap-2">
            <label htmlFor="phone" className="text-xs font-semibold uppercase text-ink-muted">
              Nomor WhatsApp <span className="text-red-ink">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="Contoh: 081234567890"
              required
              className="h-11 rounded-control border border-border bg-ground px-3 text-sm font-medium text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Status Awal */}
        <div className="flex flex-col gap-2">
          <label htmlFor="status" className="text-xs font-semibold uppercase text-ink-muted">
            Status Booking
          </label>
          <select
            id="status"
            name="status"
            defaultValue="confirmed"
            className="h-11 rounded-control border border-border bg-ground px-3 text-sm font-medium text-ink focus:border-accent focus:outline-none"
          >
            <option value="confirmed">Langsung Dikonfirmasi (Bayar Lunas / DP di Tempat)</option>
            <option value="pending">Menunggu Konfirmasi (Pending)</option>
          </select>
          <span className="text-xs text-ink-muted">
            Booking walk-in yang sudah membayar langsung dikonfirmasi untuk mengunci slot di situs
            publik.
          </span>
        </div>

        {/* Catatan Admin */}
        <div className="flex flex-col gap-2">
          <label htmlFor="notes" className="text-xs font-semibold uppercase text-ink-muted">
            Catatan Tambahan (Opsional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Contoh: Pembayaran tunai lunas di kasir lapangan."
            maxLength={500}
            className="rounded-control border border-border bg-ground p-3 text-sm font-medium text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
          <Link
            href="/bookings"
            className="inline-flex min-h-[44px] items-center rounded-control border border-border bg-ground px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface"
          >
            Batal
          </Link>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center rounded-control bg-accent px-6 py-2.5 text-sm font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
          >
            Simpan Booking
          </button>
        </div>
      </form>
    </div>
  );
}
