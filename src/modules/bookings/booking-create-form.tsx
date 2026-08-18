"use client";

import { useState } from "react";
import Link from "next/link";

import { TIME_SLOTS, type TimeSlot } from "@/domain/slots";
import type { DateAvailabilityResult } from "@/server/queries";
import { createBookingAction } from "./bookings.actions";

type BookingCreateFormProps = {
  initialAvailability: DateAvailabilityResult;
  errorMessage?: string | null;
};

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function BookingCreateForm({ initialAvailability, errorMessage }: BookingCreateFormProps) {
  const [bookingDate, setBookingDate] = useState(initialAvailability.date);
  const [availability, setAvailability] = useState<DateAvailabilityResult>(initialAvailability);
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function handleDateChange(newDate: string) {
    setBookingDate(newDate);
    setSelectedSlots([]);
    setIsLoading(true);
    setFetchError(null);

    try {
      const res = await fetch(`/api/availability?date=${newDate}`);
      if (!res.ok) {
        throw new Error(`Gagal memuat ketersediaan slot: ${res.statusText}`);
      }
      const data: DateAvailabilityResult = await res.json();
      setAvailability(data);
    } catch (err) {
      console.error("Error fetching availability:", err);
      setFetchError("Gagal mengambil status ketersediaan slot untuk tanggal yang dipilih.");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleSlot(slot: TimeSlot) {
    if (selectedSlots.includes(slot)) {
      setSelectedSlots(selectedSlots.filter((s) => s !== slot));
    } else {
      const updated = [...selectedSlots, slot];
      // Keep selected slots in canonical time order
      updated.sort((a, b) => TIME_SLOTS.indexOf(a) - TIME_SLOTS.indexOf(b));
      setSelectedSlots(updated);
    }
  }

  function selectAllAvailable() {
    const availableSlots = availability.slots.filter((s) => s.selectable).map((s) => s.slot);
    setSelectedSlots(availableSlots);
  }

  function clearSelection() {
    setSelectedSlots([]);
  }

  // Price calculations
  const slotPriceMap = new Map(availability.slots.map((s) => [s.slot, s.price]));
  const totalPrice = selectedSlots.reduce((sum, slot) => sum + (slotPriceMap.get(slot) ?? 0), 0);
  const dpAmount = Math.round((totalPrice * availability.dpPercent) / 100);
  const hasPhotoPromo = selectedSlots.some((slot) => {
    const hour = parseInt(slot.split(":")[0] ?? "0", 10);
    return hour >= 16;
  });

  return (
    <div className="flex flex-col gap-6">
      {(errorMessage || fetchError) && (
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
          <span>{errorMessage || fetchError}</span>
        </div>
      )}

      <form
        action={createBookingAction}
        className="flex flex-col gap-6 rounded-panel border border-border bg-surface p-6 sm:p-8 shadow-xs"
      >
        <div className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-ink">Tambah Booking Walk-in</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Pilih tanggal dan satu atau beberapa slot jam sekaligus untuk pemesanan langsung di
                lapangan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  availability.dayType === "weekend"
                    ? "border border-amber-border bg-amber-bg text-amber-ink"
                    : "border border-border bg-ground text-ink-muted"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    availability.dayType === "weekend" ? "bg-amber" : "bg-neutral-400"
                  }`}
                />
                {availability.isHoliday
                  ? `Libur: ${availability.holidayLabel ?? "Hari Libur"}`
                  : availability.dayType === "weekend"
                    ? "Tarif Weekend"
                    : "Tarif Weekday"}
              </span>
            </div>
          </div>
        </div>

        {/* Input Details */}
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
              value={bookingDate}
              min={initialAvailability.date}
              onChange={(e) => handleDateChange(e.target.value)}
              required
              className="h-11 rounded-control border border-border bg-ground px-3 text-sm font-medium text-ink focus:border-accent focus:outline-none"
            />
          </div>

          {/* Status Awal */}
          <div className="flex flex-col gap-2">
            <label htmlFor="status" className="text-xs font-semibold uppercase text-ink-muted">
              Status Booking <span className="text-red-ink">*</span>
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

        {/* Pilihan Jam (Multi-Selection Grid) */}
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-ink">
                Pilihan Jam Operasional (Bisa Pilih Banyak Jam){" "}
                <span className="text-red-ink">*</span>
              </label>
              <p className="text-xs text-ink-muted">
                Pilih satu atau beberapa slot jam yang tersedia. Slot yang sudah terisi atau
                diblokir tidak dapat dipilih.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllAvailable}
                className="rounded-control border border-border bg-ground px-3 py-1.5 text-xs font-medium text-ink hover:bg-border transition-colors"
              >
                Pilih Semua Tersedia
              </button>
              {selectedSlots.length > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-control border border-border bg-ground px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink transition-colors"
                >
                  Reset Pilihan
                </button>
              )}
            </div>
          </div>

          {/* Selected Chips Display */}
          {selectedSlots.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-control border border-accent/30 bg-accent/5 p-3">
              <span className="text-xs font-bold text-accent">
                {selectedSlots.length} Slot Dipilih:
              </span>
              {selectedSlots.map((slot) => (
                <span
                  key={slot}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 font-mono text-xs font-semibold text-accent-ink shadow-xs"
                >
                  <span>{slot}</span>
                  <button
                    type="button"
                    onClick={() => toggleSlot(slot)}
                    aria-label={`Hapus slot ${slot}`}
                    className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/20 text-accent-ink"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Hidden inputs to send multiple slots in standard form submission */}
          {selectedSlots.map((slot) => (
            <input key={slot} type="hidden" name="time_slots" value={slot} />
          ))}

          {/* 18 Slots Grid */}
          {isLoading ? (
            <div className="flex h-48 items-center justify-center rounded-control border border-dashed border-border bg-ground/50">
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span>Memuat ketersediaan slot...</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
              {availability.slots.map((item) => {
                const isSelected = selectedSlots.includes(item.slot);

                // Badge styling
                let statusBadgeClass =
                  "bg-neutral-100 text-ink-muted border-border dark:bg-neutral-800";
                if (item.status === "available") {
                  statusBadgeClass = "bg-green-bg text-green-ink border-green-border";
                } else if (item.status === "confirmed") {
                  statusBadgeClass = "bg-red-bg text-red-ink border-red-border";
                } else if (item.status === "pending") {
                  statusBadgeClass = "bg-amber-bg text-amber-ink border-amber-border";
                } else if (item.status === "blocked") {
                  statusBadgeClass =
                    "bg-neutral-200 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300";
                }

                return (
                  <button
                    key={item.slot}
                    type="button"
                    disabled={!item.selectable}
                    onClick={() => toggleSlot(item.slot)}
                    className={`flex flex-col gap-2 rounded-control border p-3.5 text-left transition-all duration-150 ${
                      isSelected
                        ? "border-accent bg-accent/10 ring-2 ring-accent shadow-sm"
                        : item.selectable
                          ? "border-border bg-ground/60 hover:border-accent/60 hover:bg-surface cursor-pointer"
                          : "border-border/60 bg-ground/30 opacity-65 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-ink">{item.slot}</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass}`}
                      >
                        {item.status === "available" ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        ) : item.status === "confirmed" ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        ) : item.status === "pending" ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                        ) : null}
                        {isSelected ? "Dipilih ✓" : item.statusLabel}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-xs">
                      <span className="font-mono font-bold text-accent">{item.priceFormatted}</span>
                      {item.hasPhotoPromo && (
                        <span className="text-[10px] font-medium text-amber">📸 Free Foto</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Summary Calculation Box */}
        {selectedSlots.length > 0 && (
          <div className="flex flex-col gap-3 rounded-control border border-border bg-ground p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-accent" />
              <span className="text-xs font-bold uppercase text-ink">
                Ringkasan Biaya & Ketentuan DP
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
              <div className="flex flex-col rounded bg-surface p-3 border border-border">
                <span className="text-ink-muted">Total Durasi</span>
                <span className="mt-1 font-mono text-base font-bold text-ink">
                  {selectedSlots.length} Jam
                </span>
              </div>
              <div className="flex flex-col rounded bg-surface p-3 border border-border">
                <span className="text-ink-muted">Total Biaya Sewa</span>
                <span className="mt-1 font-mono text-base font-bold text-accent">
                  {formatRupiah(totalPrice)}
                </span>
              </div>
              <div className="flex flex-col rounded bg-surface p-3 border border-border">
                <span className="text-ink-muted">Ketentuan DP ({availability.dpPercent}%)</span>
                <span className="mt-1 font-mono text-base font-bold text-ink">
                  {formatRupiah(dpAmount)}
                </span>
              </div>
            </div>

            {hasPhotoPromo && (
              <div className="flex items-center gap-2 rounded bg-amber-bg/30 p-2.5 text-xs text-amber-ink border border-amber-border">
                <span>📸</span>
                <span>
                  <strong>Promo Fotografer Aktif:</strong> Gratis fotografer untuk 1 jam pertama
                  pada sesi jam 16.00 – 00.00.
                </span>
              </div>
            )}
          </div>
        )}

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
            disabled={selectedSlots.length === 0}
            className="inline-flex min-h-[44px] items-center rounded-control bg-accent px-6 py-2.5 text-sm font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedSlots.length > 0
              ? `Simpan Booking (${selectedSlots.length} Jam - ${formatRupiah(totalPrice)})`
              : "Pilih Minimal 1 Jam"}
          </button>
        </div>
      </form>
    </div>
  );
}
