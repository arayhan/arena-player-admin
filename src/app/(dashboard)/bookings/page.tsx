import type { Metadata } from "next";
import Link from "next/link";

import { BOOKING_STATUSES } from "@/domain/status";
import { parseBookingsFilter } from "@/modules/bookings/bookings.schema";
import { BookingsFilters } from "@/modules/bookings/bookings-filters";
import { BookingsTable } from "@/modules/bookings/bookings-table";
import { BookingCard } from "@/modules/bookings/booking-card";
import { EmptyQueue } from "@/modules/bookings/empty-queue";
import { listBookings } from "@/server/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daftar Booking | Arena Player Admin",
  description: "Daftar antrean dan riwayat booking lapangan.",
};

const PAGE_SIZE = 50;

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingsPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const filter = parseBookingsFilter(resolvedParams);

  const offset = (filter.page - 1) * PAGE_SIZE;
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

  const successMessage =
    typeof resolvedParams?.success === "string" ? resolvedParams.success : null;
  const conflictMessage =
    typeof resolvedParams?.conflict === "string"
      ? decodeURIComponent(resolvedParams.conflict)
      : null;
  const errorMessage =
    typeof resolvedParams?.error === "string" ? decodeURIComponent(resolvedParams.error) : null;

  // Reconstruct return URL with current filter query
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
  const returnUrl = `/bookings${queryParts.length > 0 ? `?${queryParts.join("&")}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
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

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Daftar Booking</h1>
          <p className="text-sm text-ink-muted">
            Total {totalCount} booking {isFiltered ? "ditemukan" : "dalam antrean"}
          </p>
        </div>

        {/* Quick actions: Create Walk-in & Export CSV */}
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
            Tambah Booking
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

      {/* Filter Bar */}
      <BookingsFilters currentFilter={filter} />

      {/* Main Content Area: Queue List / Table or Empty State */}
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
                    href={`/bookings?page=${filter.page - 1}`}
                    className="inline-flex min-h-[44px] items-center rounded-control border border-border px-3 py-1.5 font-medium text-ink hover:bg-ground"
                  >
                    Sebelumnya
                  </Link>
                )}
                {filter.page < totalPages && (
                  <Link
                    href={`/bookings?page=${filter.page + 1}`}
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
    </div>
  );
}
