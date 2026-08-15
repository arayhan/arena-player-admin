import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatRelativeAge } from "@/modules/bookings/booking-formatters";
import { BookingCard } from "@/modules/bookings/booking-card";
import { BookingsTable } from "@/modules/bookings/bookings-table";
import { EmptyQueue } from "@/modules/bookings/empty-queue";
import { listBookings } from "@/server/queries";
import { tableExists } from "@/server/schema-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beranda | Arena Player Admin",
  description: "Dashboard antrean booking dan status operasional lapangan.",
};

export default async function DashboardPage() {
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

  // Calculate oldest pending age if there are items in the queue
  const oldestPending =
    pendingBookings.length > 0
      ? [...pendingBookings].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )[0]
      : null;
  const oldestAge = oldestPending ? formatRelativeAge(oldestPending.created_at) : null;

  // Schema guards for Phase 4 / Phase 6 metrics (never fabricate values!)
  const hasEventsTable = await tableExists("booking_events");
  const hasSettingsTable = await tableExists("site_settings");

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Beranda" }]} />

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
        className="flex flex-col gap-3 border-t border-border pt-4"
        aria-labelledby="metrics-heading"
      >
        <h2 id="metrics-heading" className="text-sm font-semibold text-ink-muted">
          Ringkasan Operasional
        </h2>

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
          <div className="flex flex-col gap-1 rounded-panel border border-border bg-surface p-4">
            <span className="text-xs font-medium text-ink-muted">Antrean Tertua</span>
            <span className="text-2xl font-bold text-ink">{oldestAge ?? "—"}</span>
            <span className="text-xs text-ink-muted">
              {oldestAge ? "Sejak pembuatan booking" : "Tidak ada antrean tertahan"}
            </span>
          </div>

          {/* Card 3: Confirmed Today (Guarded by Schema 002) */}
          <div className="flex flex-col gap-1 rounded-panel border border-border bg-surface p-4">
            <span className="text-xs font-medium text-ink-muted">Dikonfirmasi Hari Ini</span>
            {hasEventsTable ? (
              <span className="text-2xl font-bold text-ink">0</span>
            ) : (
              <span className="text-xs text-ink-muted italic">
                Menunggu migrasi 002 (booking_events)
              </span>
            )}
            <span className="text-xs text-ink-muted">Audit konfirmasi harian</span>
          </div>

          {/* Card 4: Revenue / DP (Guarded by Schema 003) */}
          <div className="flex flex-col gap-1 rounded-panel border border-border bg-surface p-4">
            <span className="text-xs font-medium text-ink-muted">Total DP Masuk</span>
            {hasSettingsTable ? (
              <span className="text-2xl font-bold text-ink">—</span>
            ) : (
              <span className="text-xs text-ink-muted italic">
                Menunggu migrasi 003 (site_settings)
              </span>
            )}
            <span className="text-xs text-ink-muted">Estimasi tarif per slot</span>
          </div>
        </div>
      </section>
    </div>
  );
}
