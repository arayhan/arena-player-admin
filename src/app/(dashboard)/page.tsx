import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatRelativeAge, isOlderThan24Hours } from "@/modules/bookings/booking-formatters";
import { triggerManualExpiryAction } from "@/modules/bookings/bookings.actions";
import { BookingCard } from "@/modules/bookings/booking-card";
import { BookingsTable } from "@/modules/bookings/bookings-table";
import { EmptyQueue } from "@/modules/bookings/empty-queue";
import { getDashboardMetrics, listBookings } from "@/server/queries";
import { tableExists } from "@/server/schema-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beranda | Arena Player Admin",
  description: "Dashboard antrean booking dan status operasional lapangan.",
};

type Props = {
  searchParams?: Promise<{ expired?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const expiredCount = resolvedParams?.expired ? Number(resolvedParams.expired) : null;

  const hasBookingsTable = await tableExists("bookings");

  if (!hasBookingsTable) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Beranda" }]} />
        <div>
          <h1 className="text-xl font-bold text-ink">Beranda</h1>
          <p className="text-sm text-ink-muted">
            Antrean belum tersambung ke database. Booking dari situs publik akan muncul di sini
            setelah database siap — saat ini belum ada yang bisa diproses.
          </p>
        </div>
      </div>
    );
  }

  // Fetch pending queue rows (capped at first 5 for the dashboard preview)
  const { rows: pendingBookings, totalCount } = await listBookings({
    status: ["pending"],
    limit: 5,
    sort: "when",
    dir: "asc",
  });

  // Fetch operational metrics
  const metrics = await getDashboardMetrics();

  // Calculate oldest pending age if there are items in the queue
  const oldestPending =
    pendingBookings.length > 0
      ? [...pendingBookings].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )[0]
      : null;
  const oldestAge = oldestPending ? formatRelativeAge(oldestPending.created_at) : null;

  // Dead-man's switch: is oldest pending > 24 hours?
  const isOldestPast24h = oldestPending != null && isOlderThan24Hours(oldestPending.created_at);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Breadcrumbs items={[{ label: "Beranda" }]} />

        {/* Quick Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/bookings/new"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-control bg-accent px-4 py-2 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Tambah Booking Walk-in
          </Link>

          <Link
            href="/api/exports/bookings"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-border bg-surface px-4 py-2 text-xs font-medium text-ink transition-colors duration-150 hover:bg-ground"
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
            Ekspor CSV
          </Link>
        </div>
      </div>

      {/* Expiry feedback notification */}
      {expiredCount != null && (
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
            {expiredCount > 0
              ? `${expiredCount} booking yang melewati 24 jam berhasil dilepaskan.`
              : "Tidak ada booking pending yang melewati batas 24 jam saat ini."}
          </span>
        </div>
      )}

      {/* Dead-man's switch alert */}
      {isOldestPast24h && (
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
          <span>
            Perhatian: Terdapat booking pending yang tertahan lebih dari 24 jam ({oldestAge}).
            Periksa scheduler cron atau jalankan auto-expire manual.
          </span>
        </div>
      )}

      {/* 1. Queue Section (Queue First per 6-step-01) */}
      <section className="flex flex-col gap-4" aria-labelledby="queue-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h1 id="queue-heading" className="text-xl font-bold text-ink">
              Antrean Booking
            </h1>
            <p className="text-sm text-ink-muted">
              {totalCount > 0
                ? `${totalCount} booking menunggu tindakan konfirmasi`
                : "Semua booking telah diproses"}
            </p>
          </div>
          {totalCount > 0 && (
            <Link
              href="/bookings"
              className="inline-flex min-h-[44px] items-center text-xs font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
            >
              Lihat semua booking ({totalCount}) &rarr;
            </Link>
          )}
        </div>

        {totalCount === 0 ? (
          <EmptyQueue />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Mobile cards view (<720px / md) */}
            <div className="flex flex-col gap-3 md:hidden">
              {pendingBookings.map((b) => (
                <BookingCard key={b.id} booking={b} />
              ))}
            </div>

            {/* Desktop table view (≥720px / md) */}
            <div className="hidden md:block">
              <BookingsTable bookings={pendingBookings} />
            </div>

            {totalCount > 5 && (
              <div className="text-center pt-2">
                <Link
                  href="/bookings"
                  className="inline-flex min-h-[44px] items-center rounded-control border border-border bg-surface px-4 py-2 text-xs font-medium text-ink transition-colors duration-150 hover:bg-ground"
                >
                  Buka {totalCount - 5} antrean lainnya di Konsol Booking &rarr;
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. Supporting Band Underneath Queue (Yields to the queue per 6-step-01) */}
      <section
        className="flex flex-col gap-4 border-t border-border pt-4"
        aria-labelledby="metrics-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="metrics-heading" className="text-sm font-semibold text-ink-muted">
            Ringkasan Operasional
          </h2>

          {/* Manual Expiry Action */}
          <form action={triggerManualExpiryAction}>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-control border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-ground"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
                <path
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Jalankan Auto-Expire Sekarang
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Pending Count */}
          <div className="flex flex-col gap-1 rounded-panel border border-border bg-surface p-4">
            <span className="text-xs font-medium text-ink-muted">Menunggu Konfirmasi</span>
            <span className="text-2xl font-bold text-ink">{totalCount}</span>
            <span className="text-xs text-ink-muted">
              {totalCount === 0 ? "Antrean bersih" : "Perlu segera ditindak"}
            </span>
          </div>

          {/* Card 2: Oldest Pending Age */}
          <div
            className={`flex flex-col gap-1 rounded-panel border p-4 ${
              isOldestPast24h
                ? "border-amber-border bg-amber-bg/30 text-amber-ink"
                : "border-border bg-surface text-ink"
            }`}
          >
            <span className="text-xs font-medium text-ink-muted">Antrean Tertua</span>
            <span className="text-2xl font-bold">{oldestAge ?? "—"}</span>
            <span className="text-xs text-ink-muted">
              {isOldestPast24h
                ? "Melewati batas 24 jam!"
                : oldestAge
                  ? "Sejak pembuatan booking"
                  : "Tidak ada antrean tertahan"}
            </span>
          </div>

          {/* Card 3: Today's Active Bookings */}
          <div className="flex flex-col gap-1 rounded-panel border border-border bg-surface p-4">
            <span className="text-xs font-medium text-ink-muted">Jadwal Hari Ini</span>
            <span className="text-2xl font-bold text-ink">{metrics.todayActiveCount}</span>
            <span className="text-xs text-ink-muted">Booking aktif hari ini</span>
          </div>

          {/* Card 4: Month Active Bookings */}
          <div className="flex flex-col gap-1 rounded-panel border border-border bg-surface p-4">
            <span className="text-xs font-medium text-ink-muted">Total Booking Bulan Ini</span>
            <span className="text-2xl font-bold text-ink">{metrics.monthTotalCount}</span>
            <span className="text-xs text-ink-muted">Total terkonfirmasi & pending</span>
          </div>
        </div>
      </section>
    </div>
  );
}
