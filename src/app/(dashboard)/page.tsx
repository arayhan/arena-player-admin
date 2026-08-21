import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { BOOKING_STATUSES } from "@/domain/status";
import { formatRelativeAge, isOlderThan24Hours } from "@/modules/bookings/booking-formatters";
import { BookingCard } from "@/modules/bookings/booking-card";
import { ExpiryTriggerButton } from "@/modules/bookings/expiry-trigger-button";
import { BookingsFilters } from "@/modules/bookings/bookings-filters";
import { parseBookingsFilter } from "@/modules/bookings/bookings.schema";
import { BookingsTable } from "@/modules/bookings/bookings-table";
import { EmptyQueue } from "@/modules/bookings/empty-queue";
import { getDashboardMetrics, listBookings } from "@/server/queries";
import { tableExists } from "@/server/schema-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beranda | Arena Player Admin",
  description: "Dashboard antrean booking dan status operasional lapangan.",
};

const PAGE_SIZE = 50;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const expiredCount = resolvedParams?.expired ? Number(resolvedParams.expired) : null;
  const successMessage =
    typeof resolvedParams?.success === "string" ? resolvedParams.success : null;
  const conflictMessage =
    typeof resolvedParams?.conflict === "string"
      ? decodeURIComponent(resolvedParams.conflict)
      : null;
  const errorMessage =
    typeof resolvedParams?.error === "string" ? decodeURIComponent(resolvedParams.error) : null;

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

  const filter = parseBookingsFilter(resolvedParams);
  const offset = (filter.page - 1) * PAGE_SIZE;

  // Fetch all bookings according to the filter (default: all statuses)
  const { rows: bookings, totalCount } = await listBookings({
    status: filter.status,
    from: filter.from,
    to: filter.to,
    q: filter.q,
    sort: filter.sort,
    dir: filter.dir,
    limit: PAGE_SIZE,
    offset,
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const isFiltered =
    filter.status.length < BOOKING_STATUSES.length ||
    filter.from !== null ||
    filter.to !== null ||
    filter.q !== null;

  // Fetch operational metrics
  const metrics = await getDashboardMetrics();

  const oldestAge = metrics.oldestPendingCreatedAt
    ? formatRelativeAge(metrics.oldestPendingCreatedAt)
    : null;
  const isOldestPast24h =
    metrics.oldestPendingCreatedAt != null && isOlderThan24Hours(metrics.oldestPendingCreatedAt);

  // Build return URL
  const queryParts: string[] = [];
  if (filter.status.length > 0 && filter.status.length < BOOKING_STATUSES.length) {
    for (const s of filter.status) queryParts.push(`status=${encodeURIComponent(s)}`);
  }
  if (filter.from) queryParts.push(`from=${encodeURIComponent(filter.from)}`);
  if (filter.to) queryParts.push(`to=${encodeURIComponent(filter.to)}`);
  if (filter.q) queryParts.push(`q=${encodeURIComponent(filter.q)}`);
  if (filter.sort !== "when") queryParts.push(`sort=${encodeURIComponent(filter.sort)}`);
  if (filter.dir !== "asc") queryParts.push(`dir=${encodeURIComponent(filter.dir)}`);
  if (filter.page > 1) queryParts.push(`page=${filter.page}`);
  const returnUrl = `/${queryParts.length > 0 ? `?${queryParts.join("&")}` : ""}`;

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

      {/* Action Success / Conflict / Error Feedback */}
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
              ? "Booking berhasil dikonfirmasi dan slot telah dikunci."
              : successMessage === "rejected"
                ? "Booking telah ditolak dan slot dibuka kembali."
                : "Tindakan berhasil diproses."}
          </span>
        </div>
      )}

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

      {/* 1. Supporting Metrics Band */}
      <section className="flex flex-col gap-4" aria-labelledby="metrics-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="metrics-heading" className="text-sm font-semibold text-ink-muted">
            Ringkasan Operasional
          </h2>

          {/* Manual Expiry Action */}
          <ExpiryTriggerButton />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Pending Count */}
          <div className="flex flex-col gap-1 rounded-panel border border-border bg-surface p-4">
            <span className="text-xs font-medium text-ink-muted">Menunggu Konfirmasi</span>
            <span className="text-2xl font-bold text-ink">{metrics.pendingCount}</span>
            <span className="text-xs text-ink-muted">
              {metrics.pendingCount === 0 ? "Antrean bersih" : "Perlu segera ditindak"}
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

      {/* 2. All Bookings Section */}
      <section
        className="flex flex-col gap-4 border-t border-border pt-4"
        aria-labelledby="bookings-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h1 id="bookings-heading" className="text-xl font-bold text-ink">
              Daftar Semua Booking
            </h1>
            <p className="text-sm text-ink-muted">
              Total {totalCount} booking {isFiltered ? "ditemukan berdasarkan filter" : "terdaftar"}
            </p>
          </div>
          <Link
            href="/bookings"
            className="inline-flex min-h-[44px] items-center text-xs font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            Buka di Konsol Booking &rarr;
          </Link>
        </div>

        {/* Filter Bar */}
        <BookingsFilters currentFilter={filter} actionPath="/" />

        {bookings.length === 0 ? (
          <EmptyQueue isFilterActive={isFiltered} />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Mobile cards view (<720px / md) */}
            <div className="flex flex-col gap-3 md:hidden">
              {bookings.map((b) => (
                <BookingCard key={b.id} booking={b} returnUrl={returnUrl} />
              ))}
            </div>

            {/* Desktop table view (≥720px / md) */}
            <div className="hidden md:block">
              <BookingsTable bookings={bookings} returnUrl={returnUrl} />
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                aria-label="Navigasi halaman"
                className="flex items-center justify-between border-t border-border pt-4 text-xs text-ink-muted"
              >
                <span>
                  Halaman {filter.page} dari {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  {filter.page > 1 && (
                    <Link
                      href={`/?page=${filter.page - 1}`}
                      className="inline-flex min-h-[44px] items-center rounded-control border border-border px-3 py-1.5 font-medium text-ink hover:bg-ground"
                    >
                      Sebelumnya
                    </Link>
                  )}
                  {filter.page < totalPages && (
                    <Link
                      href={`/?page=${filter.page + 1}`}
                      className="inline-flex min-h-[44px] items-center rounded-control border border-border px-3 py-1.5 font-medium text-ink hover:bg-ground"
                    >
                      Selanjutnya
                    </Link>
                  )}
                </div>
              </nav>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
