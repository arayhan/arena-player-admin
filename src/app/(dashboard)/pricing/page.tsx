import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatBookingDate } from "@/modules/bookings/booking-formatters";
import {
  addPublicHolidayAction,
  applyStandardPricelistAction,
  deletePublicHolidayAction,
  updateRatePriceAction,
} from "@/modules/pricing/pricing.actions";
import { todayAtField } from "@/domain/dates";
import { TIME_SLOTS } from "@/domain/slots";
import { getPublicHolidays, getRateCard, type RateCardRow } from "@/server/queries";
import { tableExists } from "@/server/schema-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tarif & Slot | Arena Player Admin",
  description: "Harga sewa per slot jam, weekday dan weekend/hari libur, serta daftar hari libur.",
};

type Props = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function PricingPage({ searchParams }: Props) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolvedParams?.error ? decodeURIComponent(resolvedParams.error) : null;
  const successMessage = resolvedParams?.success ? resolvedParams.success : null;

  const hasRateCardTable = await tableExists("rate_card");

  if (!hasRateCardTable) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Tarif & Slot" }]} />
        <div className="rounded-panel border border-amber-border bg-amber-bg/30 p-6 text-ink">
          <h1 className="text-xl font-bold">Tarif & Slot Lapangan</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Tabel <code className="font-mono text-xs text-ink font-semibold">rate_card</code> belum
            diterapkan pada database Supabase.
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Terapkan migrasi dari{" "}
            <code className="font-mono">docs/schema-requests/003-site-settings.md</code> pada
            Supabase SQL Editor untuk mengaktifkan fitur ini.
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center rounded-control bg-accent px-4 py-2 text-xs font-medium text-accent-ink hover:bg-accent-hover"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [rateCard, holidays] = await Promise.all([getRateCard(), getPublicHolidays()]);
  const today = todayAtField();

  const priceFor = (slot: string, dayType: "weekday" | "weekend"): number | null => {
    const row = rateCard.find((r: RateCardRow) => r.time_slot === slot && r.day_type === dayType);
    return row ? row.price_rupiah : null;
  };

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Tarif & Slot" }]} />

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
            {successMessage === "price_saved"
              ? "Harga slot berhasil disimpan."
              : successMessage === "tier_saved"
                ? "Rentang harga berhasil diperbarui."
                : successMessage === "standard_applied"
                  ? "Standar tarif Pricelist Mini Soccer berhasil diterapkan ke semua slot."
                  : successMessage === "holiday_added"
                    ? "Hari libur berhasil ditambahkan."
                    : successMessage === "holiday_deleted"
                      ? "Hari libur berhasil dihapus."
                      : "Perubahan berhasil disimpan."}
          </span>
        </div>
      )}

      {/* Official Pricelist Mini Soccer Card Banner */}
      <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent uppercase">
                Standar Tarif
              </span>
              <h1 className="text-lg font-bold text-ink">PRICELIST MINI SOCCER</h1>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Aturan harga sewa lapangan per jam berdasarkan kategori hari dan jam operasional.
            </p>
          </div>

          <form action={applyStandardPricelistAction}>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-accent bg-accent/10 px-4 py-2 text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-accent-ink"
            >
              <span>⚡ Terapkan Standar Pricelist</span>
            </button>
          </form>
        </div>

        {/* Tier Cards Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Card 1: Weekday */}
          <div className="flex flex-col rounded-control border border-border bg-ground/60 p-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-bold text-sm text-ink">WEEKDAY (SENIN – JUMAT)</span>
              <span className="rounded bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200">
                Hari Kerja
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between rounded bg-surface p-2.5 border border-border/60">
                <span className="font-medium text-ink">06.00 – 16.00</span>
                <span className="font-mono font-bold text-accent">Rp 200.000 / jam</span>
              </div>
              <div className="flex items-center justify-between rounded bg-surface p-2.5 border border-border/60">
                <span className="font-medium text-ink">16.00 – 18.00</span>
                <span className="font-mono font-bold text-accent">Rp 300.000 / jam</span>
              </div>
              <div className="flex items-center justify-between rounded bg-surface p-2.5 border border-border/60">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-ink">18.00 – 00.00</span>
                  <span className="text-[10px] text-amber">📸 Free Foto</span>
                </div>
                <span className="font-mono font-bold text-accent">Rp 400.000 / jam</span>
              </div>
            </div>
          </div>

          {/* Card 2: Weekend & Public Holiday */}
          <div className="flex flex-col rounded-control border border-border bg-ground/60 p-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-bold text-sm text-ink">SABTU – MINGGU & PUBLIC HOLIDAY</span>
              <span className="rounded bg-amber-bg px-2 py-0.5 text-[10px] font-semibold text-amber-ink border border-amber-border">
                Weekend / Libur
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between rounded bg-surface p-2.5 border border-border/60">
                <span className="font-medium text-ink">06.00 – 16.00</span>
                <span className="font-mono font-bold text-accent">Rp 200.000 / jam</span>
              </div>
              <div className="flex items-center justify-between rounded bg-surface p-2.5 border border-border/60">
                <span className="font-medium text-ink">16.00 – 18.00</span>
                <span className="font-mono font-bold text-accent">Rp 350.000 / jam</span>
              </div>
              <div className="flex items-center justify-between rounded bg-surface p-2.5 border border-border/60">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-ink">18.00 – 00.00</span>
                  <span className="text-[10px] text-amber">📸 Free Foto</span>
                </div>
                <span className="font-mono font-bold text-accent">Rp 450.000 / jam</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bonus Callout */}
        <div className="flex items-center gap-3 rounded-control border border-amber-border bg-amber-bg/20 p-3.5 text-xs text-ink">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber/15 text-amber text-lg">
            📷
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-ink">PLUS FREE FOTOGRAFER</span>
            <span className="text-ink-muted">
              Sejam pertama khusus untuk slot pemesanan di jam <strong>16.00 – 00.00</strong> setiap
              hari.
            </span>
          </div>
        </div>
      </div>

      {/* Edit Tarif per Slot (18 Jam) */}
      <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
          <div>
            <h2 className="text-base font-bold text-ink">Daftar Slot Jam Operasional (18 Slot)</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Ubah tarif per jam secara spesifik bila terdapat penyesuaian khusus pada slot
              tertentu.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-muted">
                <th className="py-2.5 pr-4">Slot Jam</th>
                <th className="py-2.5 pr-4">Kategori & Promo</th>
                <th className="py-2.5 pr-4">Weekday (Senin–Jumat)</th>
                <th className="py-2.5 pr-4">Weekend / Libur</th>
                <th className="py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {TIME_SLOTS.map((slot) => {
                const hour = parseInt(slot.split(":")[0] ?? "0", 10);
                const isPhotoSlot = hour >= 16;
                const tierLabel =
                  hour < 16 ? "Pagi / Siang" : hour < 18 ? "Sore" : "Malam (Prime Time)";

                const weekdayPrice = priceFor(slot, "weekday") ?? 200000;
                const weekendPrice = priceFor(slot, "weekend") ?? 200000;

                return (
                  <tr key={slot} className="transition-colors hover:bg-ground/40">
                    <td className="py-3 pr-4 font-mono text-xs font-bold text-ink">{slot}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-ground px-2 py-0.5 text-[11px] font-medium text-ink-muted border border-border">
                          {tierLabel}
                        </span>
                        {isPhotoSlot && (
                          <span className="rounded bg-amber-bg px-1.5 py-0.5 text-[10px] font-semibold text-amber-ink">
                            📸 Fotografer
                          </span>
                        )}
                      </div>
                    </td>
                    <td colSpan={3} className="py-3">
                      <form
                        action={updateRatePriceAction}
                        className="flex items-center justify-between gap-3"
                      >
                        <input type="hidden" name="time_slot" value={slot} />

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-ink-muted">Rp</span>
                          <input
                            type="number"
                            name="price_weekday"
                            min={1}
                            step={1000}
                            defaultValue={weekdayPrice}
                            required
                            aria-label={`Harga weekday untuk slot ${slot}`}
                            className="h-9 w-28 rounded-control border border-border bg-ground px-2.5 font-mono text-xs font-semibold text-ink focus:border-accent focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-ink-muted">Rp</span>
                          <input
                            type="number"
                            name="price_weekend"
                            min={1}
                            step={1000}
                            defaultValue={weekendPrice}
                            required
                            aria-label={`Harga weekend atau libur untuk slot ${slot}`}
                            className="h-9 w-28 rounded-control border border-border bg-ground px-2.5 font-mono text-xs font-semibold text-ink focus:border-accent focus:outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          className="inline-flex min-h-[36px] items-center rounded-control bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
                        >
                          Simpan
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hari libur */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <form
            action={addPublicHolidayAction}
            className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6"
          >
            <div>
              <h2 className="text-base font-bold text-ink">Tambah Hari Libur Nasional</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Tanggal yang terdaftar di sini otomatis memakai harga weekend meski jatuh pada hari
                kerja (Senin–Jumat).
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="holiday_date"
                className="text-xs font-semibold uppercase text-ink-muted"
              >
                Tanggal <span className="text-red-ink">*</span>
              </label>
              <input
                id="holiday_date"
                name="holiday_date"
                type="date"
                min={today}
                required
                className="h-11 rounded-control border border-border bg-ground px-3 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="label" className="text-xs font-semibold uppercase text-ink-muted">
                Keterangan Hari Libur <span className="text-red-ink">*</span>
              </label>
              <input
                id="label"
                name="label"
                type="text"
                maxLength={100}
                placeholder="Contoh: Tahun Baru Imlek / Idul Fitri"
                required
                className="h-11 rounded-control border border-border bg-ground px-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-control bg-accent px-4 py-2.5 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
            >
              + Tambah Hari Libur
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-base font-bold text-ink">Daftar Hari Libur Terdaftar</h2>
                <p className="text-xs text-ink-muted">
                  Tanggal yang memakai tarif weekend / libur di luar Sabtu & Minggu.
                </p>
              </div>
              <span className="rounded-full border border-border bg-ground px-2.5 py-0.5 text-xs font-semibold text-ink">
                {holidays.length} tanggal
              </span>
            </div>

            {holidays.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-control border border-dashed border-border p-8 text-center text-xs text-ink-muted">
                <p className="font-semibold text-ink">Belum ada hari libur khusus terdaftar</p>
                <p className="mt-1">
                  Hari Sabtu dan Minggu otomatis memakai tarif weekend tanpa perlu didaftarkan.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-control border border-border">
                {holidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className="flex flex-wrap items-center justify-between gap-3 bg-surface p-4 transition-colors hover:bg-ground/50"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-ink">
                        {formatBookingDate(holiday.holiday_date)}
                      </span>
                      <span className="text-xs text-ink-muted">{holiday.label}</span>
                    </div>

                    <form action={deletePublicHolidayAction}>
                      <input type="hidden" name="id" value={holiday.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-[44px] items-center rounded-control border border-red-border bg-red-bg px-3 py-1.5 text-xs font-medium text-red-ink transition-colors duration-150 hover:bg-red-border/20"
                      >
                        Hapus
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
