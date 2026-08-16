import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatBookingDate } from "@/modules/bookings/booking-formatters";
import { getStatsData } from "@/server/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Statistik & Utilisasi | Arena Player Admin",
  description: "Laporan performa pemesanan lapangan, utilisasi slot, dan distribusi status.",
};

export default async function StatsPage() {
  const stats = await getStatsData();

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Statistik & Utilisasi" }]} />

      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-bold text-ink">Statistik & Analisis Lapangan</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Ringkasan performa operasional, utilisasi jam sewa, dan distribusi status pemesanan.
        </p>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-panel border border-border bg-surface p-4">
          <span className="text-xs font-semibold uppercase text-ink-muted">Total Dikonfirmasi</span>
          <p className="mt-1 font-mono text-2xl font-bold text-green-ink">
            {stats.statusBreakdown.confirmed}
          </p>
          <span className="text-[11px] text-ink-muted">Booking berhasil main</span>
        </div>

        <div className="rounded-panel border border-border bg-surface p-4">
          <span className="text-xs font-semibold uppercase text-ink-muted">Menunggu Review</span>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-ink">
            {stats.statusBreakdown.pending}
          </p>
          <span className="text-[11px] text-ink-muted">Antrean pending</span>
        </div>

        <div className="rounded-panel border border-border bg-surface p-4">
          <span className="text-xs font-semibold uppercase text-ink-muted">Ditolak</span>
          <p className="mt-1 font-mono text-2xl font-bold text-red-ink">
            {stats.statusBreakdown.rejected}
          </p>
          <span className="text-[11px] text-ink-muted">Bukti tidak valid</span>
        </div>

        <div className="rounded-panel border border-border bg-surface p-4">
          <span className="text-xs font-semibold uppercase text-ink-muted">Kedaluwarsa</span>
          <p className="mt-1 font-mono text-2xl font-bold text-ink-muted">
            {stats.statusBreakdown.expired}
          </p>
          <span className="text-[11px] text-ink-muted">Auto-release &gt;24 jam</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Slot Popularity */}
        <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6">
          <div>
            <h2 className="text-base font-bold text-ink">Jam Slot Paling Diminati</h2>
            <p className="text-xs text-ink-muted">
              Slot waktu dengan volume booking tertinggi (confirmed & pending).
            </p>
          </div>

          {stats.popularSlots.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink-muted">Belum ada data booking.</div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-control border border-border">
              {stats.popularSlots.map((slot, idx) => (
                <div
                  key={slot.time_slot}
                  className="flex items-center justify-between p-3.5 transition-colors hover:bg-ground/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ground font-mono text-xs font-bold text-ink">
                      {idx + 1}
                    </span>
                    <span className="font-mono text-sm font-semibold text-ink">
                      {slot.time_slot}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-accent">
                    {slot.count} kali dipesan
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Next 7 Days Load */}
        <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6">
          <div>
            <h2 className="text-base font-bold text-ink">Beban Jadwal Mendatang</h2>
            <p className="text-xs text-ink-muted">
              Jumlah booking aktif untuk jadwal 7 hari ke depan.
            </p>
          </div>

          {stats.recentDays.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink-muted">
              Tidak ada booking aktif untuk 7 hari ke depan.
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-control border border-border">
              {stats.recentDays.map((d) => (
                <div
                  key={d.date}
                  className="flex items-center justify-between p-3.5 transition-colors hover:bg-ground/50"
                >
                  <span className="text-sm font-medium text-ink">{formatBookingDate(d.date)}</span>
                  <div className="flex items-center gap-2">
                    {d.confirmedCount > 0 && (
                      <span className="rounded-full bg-green-bg px-2.5 py-0.5 text-xs font-semibold text-green-ink border border-green-border">
                        {d.confirmedCount} fix
                      </span>
                    )}
                    {d.pendingCount > 0 && (
                      <span className="rounded-full bg-amber-bg px-2.5 py-0.5 text-xs font-semibold text-amber-ink border border-amber-border">
                        {d.pendingCount} pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
