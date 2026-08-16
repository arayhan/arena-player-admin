import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { todayAtField } from "@/domain/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ekspor Data | Arena Player Admin",
  description: "Unduh dan ekspor data riwayat booking ke format CSV.",
};

export default async function ExportPage() {
  const today = todayAtField();

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Ekspor Data" }]} />

      <div className="flex flex-col gap-6 rounded-panel border border-border bg-surface p-6 sm:p-8">
        <div className="border-b border-border pb-4">
          <h1 className="text-xl font-bold text-ink">Ekspor Data Booking</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Unduh seluruh riwayat antrean dan transaksi pemesanan lapangan dalam format file CSV
            (kompatibel dengan Microsoft Excel & Google Spreadsheet).
          </p>
        </div>

        <form method="GET" action="/api/exports/bookings" className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="from" className="text-xs font-semibold uppercase text-ink-muted">
                Mulai Tanggal
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={today}
                className="h-11 rounded-control border border-border bg-ground px-3 text-sm font-medium text-ink focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="to" className="text-xs font-semibold uppercase text-ink-muted">
                Sampai Tanggal (Opsional)
              </label>
              <input
                id="to"
                name="to"
                type="date"
                placeholder="Semua tanggal berikutnya"
                className="h-11 rounded-control border border-border bg-ground px-3 text-sm font-medium text-ink focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase text-ink-muted">
              Filter Status Booking
            </span>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  name="status"
                  value="pending"
                  defaultChecked
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                Menunggu (Pending)
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  name="status"
                  value="confirmed"
                  defaultChecked
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                Dikonfirmasi (Confirmed)
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  name="status"
                  value="rejected"
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                Ditolak (Rejected)
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  name="status"
                  value="expired"
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                Kedaluwarsa (Expired)
              </label>
            </div>
          </div>

          <div className="rounded-control bg-ground p-4 text-xs text-ink-muted">
            <span className="font-semibold text-ink">Spesifikasi Format File:</span>
            <ul className="mt-1 list-disc pl-5 space-y-1">
              <li>
                Header kolom: ID, Tanggal Main, Jam Slot, Nama Tim, Nomor WhatsApp, Status, Catatan,
                Kunci Bukti, Waktu Dibuat.
              </li>
              <li>
                Penyandian UTF-8 BOM untuk memastikan karakter terbaca dengan benar di Excel
                Windows.
              </li>
              <li>
                Nomor telepon diformat dengan tanda kutip untuk mencegah pemotongan angka nol di
                Excel.
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center rounded-control border border-border bg-ground px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface"
            >
              Kembali
            </Link>

            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-accent px-6 py-2.5 text-sm font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
                <path
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Unduh File CSV
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
