import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pagination } from "@/components/pagination";
import {
  addPublicHolidayAction,
  applyStandardPricelistAction,
} from "@/modules/pricing/pricing.actions";
import { parseHolidaysFilter, parseRateCardFilter } from "@/modules/pricing/pricing.schema";
import { RateCardTable } from "@/modules/pricing/rate-card-table";
import { HolidaysFilters } from "@/modules/pricing/holidays-filters";
import { HolidaysTable } from "@/modules/pricing/holidays-table";
import { todayAtField } from "@/domain/dates";
import { getPublicHolidays, getRateCard } from "@/server/queries";
import { tableExists } from "@/server/schema-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tarif & Slot | Arena Player Admin",
  description: "Harga sewa per slot jam, weekday dan weekend/hari libur, serta daftar hari libur.",
};

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PricingPage({ searchParams }: Props) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const errorMessage =
    typeof resolvedParams?.error === "string" ? decodeURIComponent(resolvedParams.error) : null;
  const successMessage =
    typeof resolvedParams?.success === "string" ? resolvedParams.success : null;

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

  // Parse filters
  const rateFilter = parseRateCardFilter(resolvedParams);

  const holidayRawParams = resolvedParams
    ? {
        q: resolvedParams.holiday_q,
        from: resolvedParams.holiday_from,
        to: resolvedParams.holiday_to,
        sort: resolvedParams.holiday_sort === "holiday_label" ? "label" : "date",
        dir: resolvedParams.holiday_dir,
        page: resolvedParams.holiday_page,
        per_page: resolvedParams.holiday_per_page,
      }
    : undefined;

  const holidayFilter = parseHolidaysFilter(holidayRawParams);
  const holidayOffset = (holidayFilter.page - 1) * holidayFilter.per_page;

  const [rateCard, { rows: holidays, totalCount: totalHolidays }] = await Promise.all([
    getRateCard(),
    getPublicHolidays({
      from: holidayFilter.from,
      to: holidayFilter.to,
      q: holidayFilter.q,
      sort: holidayFilter.sort,
      dir: holidayFilter.dir,
      limit: holidayFilter.per_page,
      offset: holidayOffset,
    }),
  ]);

  const today = todayAtField();

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
      <RateCardTable
        rateCard={rateCard}
        filter={rateFilter}
        searchParams={resolvedParams}
        baseUrl="/pricing"
      />

      {/* Hari libur */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <form
            action={addPublicHolidayAction}
            className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6 shadow-xs"
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
              className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-control bg-accent px-4 py-2.5 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover active:scale-95"
            >
              + Tambah Hari Libur
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Holidays Filter Bar */}
          <HolidaysFilters currentFilter={holidayFilter} actionPath="/pricing" />

          <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-base font-bold text-ink">Daftar Hari Libur Terdaftar</h2>
                <p className="text-xs text-ink-muted">
                  Tanggal yang memakai tarif weekend / libur di luar Sabtu & Minggu.
                </p>
              </div>
              <span className="rounded-full border border-border bg-ground px-2.5 py-0.5 text-xs font-semibold text-ink">
                Total {totalHolidays} tanggal
              </span>
            </div>

            {holidays.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-control border border-dashed border-border p-8 text-center text-xs text-ink-muted">
                <p className="font-semibold text-ink">Belum ada hari libur khusus terdaftar</p>
                <p className="mt-1">
                  {holidayFilter.q || holidayFilter.from || holidayFilter.to
                    ? "Tidak ada hari libur yang cocok dengan filter."
                    : "Hari Sabtu dan Minggu otomatis memakai tarif weekend tanpa perlu didaftarkan."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <HolidaysTable
                  holidays={holidays}
                  sort={holidayFilter.sort}
                  dir={holidayFilter.dir}
                  baseUrl="/pricing"
                  searchParams={resolvedParams}
                />

                <Pagination
                  page={holidayFilter.page}
                  perPage={holidayFilter.per_page}
                  totalCount={totalHolidays}
                  baseUrl="/pricing"
                  searchParams={resolvedParams}
                  perPageOptions={[5, 10, 25, 50]}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
