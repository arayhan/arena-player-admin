import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { formatBookingDate } from "@/modules/bookings/booking-formatters";
import { blockSlotAction, unblockSlotAction } from "@/modules/blocks/blocks.actions";
import { todayAtField } from "@/domain/dates";
import { TIME_SLOTS } from "@/domain/slots";
import { listSlotBlocks } from "@/server/queries";
import { tableExists } from "@/server/schema-guard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blokir Slot | Arena Player Admin",
  description: "Manajemen pemblokiran slot lapangan untuk perawatan atau cuaca.",
};

type Props = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function BlocksPage({ searchParams }: Props) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolvedParams?.error ? decodeURIComponent(resolvedParams.error) : null;
  const successMessage = resolvedParams?.success ? resolvedParams.success : null;

  const hasSlotBlocksTable = await tableExists("slot_blocks");
  const today = todayAtField();

  if (!hasSlotBlocksTable) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Blokir Slot" }]} />
        <div className="rounded-panel border border-amber-border bg-amber-bg/30 p-6 text-ink">
          <h1 className="text-xl font-bold">Blokir Slot Lapangan</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Tabel <code className="font-mono text-xs text-ink font-semibold">slot_blocks</code>{" "}
            belum diterapkan pada database Supabase.
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Terapkan migrasi dari{" "}
            <code className="font-mono">docs/schema-requests/001-slot-blocks.md</code> pada Supabase
            SQL Editor untuk mengaktifkan fitur ini.
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

  const blocks = await listSlotBlocks({ fromDate: today });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Beranda", href: "/" }, { label: "Blokir Slot" }]} />

      {/* Notifications */}
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
            {successMessage === "blocked"
              ? "Slot berhasil diblokir dari ketersediaan publik."
              : "Blokir slot berhasil dibuka kembali."}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Form to Block a Slot */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <form
            action={blockSlotAction}
            className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6"
          >
            <div>
              <h2 className="text-base font-bold text-ink">Blokir Slot Baru</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Tutup slot tertentu agar tidak dapat dipesan di situs publik (misal: hujan,
                maintenance).
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="block_date"
                className="text-xs font-semibold uppercase text-ink-muted"
              >
                Tanggal Main
              </label>
              <input
                id="block_date"
                name="block_date"
                type="date"
                defaultValue={today}
                min={today}
                required
                className="h-11 rounded-control border border-border bg-ground px-3 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="time_slot" className="text-xs font-semibold uppercase text-ink-muted">
                Pilihan Jam
              </label>
              <select
                id="time_slot"
                name="time_slot"
                required
                defaultValue={TIME_SLOTS[0]}
                className="h-11 rounded-control border border-border bg-ground px-3 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reason" className="text-xs font-semibold uppercase text-ink-muted">
                Alasan Blokir (Opsional)
              </label>
              <input
                id="reason"
                name="reason"
                type="text"
                maxLength={200}
                placeholder="Contoh: Perawatan rumput lapangan"
                className="h-11 rounded-control border border-border bg-ground px-3 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-control bg-accent px-4 py-2.5 text-xs font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover"
            >
              Blokir Slot Ini
            </button>
          </form>
        </div>

        {/* Right Column: Active Slot Blocks List */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h1 className="text-base font-bold text-ink">Daftar Slot Diblokir</h1>
                <p className="text-xs text-ink-muted">
                  Slot yang diblokir otomatis berstatus &ldquo;booked&rdquo; di situs publik.
                </p>
              </div>
              <span className="rounded-full border border-border bg-ground px-2.5 py-0.5 text-xs font-semibold text-ink">
                {blocks.length} slot
              </span>
            </div>

            {blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-control border border-dashed border-border p-8 text-center text-xs text-ink-muted">
                <p className="font-semibold text-ink">Tidak ada slot yang diblokir</p>
                <p className="mt-1">Semua slot lapangan tersedia sesuai jadwal normal.</p>
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-control border border-border">
                {blocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex flex-wrap items-center justify-between gap-3 bg-surface p-4 transition-colors hover:bg-ground/50"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-ink">
                        {formatBookingDate(block.block_date)} · {block.time_slot}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {block.reason ? block.reason : "Tanpa catatan alasan"}
                      </span>
                    </div>

                    <form action={unblockSlotAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <button
                        type="submit"
                        className="inline-flex min-h-[44px] items-center rounded-control border border-red-border bg-red-bg px-3 py-1.5 text-xs font-medium text-red-ink transition-colors duration-150 hover:bg-red-border/20"
                      >
                        Buka Blokir
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
